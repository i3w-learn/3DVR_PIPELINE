/**
 * Renderer-level look.
 *
 * The documented escape hatch in action: A-Frame exposes neither tone mapping
 * nor shadow-map type as attributes, so we reach through to the three.js
 * renderer underneath. That is the intended relationship — A-Frame is HTML over
 * three.js, and `sceneEl.renderer` is there when an attribute is not.
 *
 * **Tone mapping.** Without it, three.js clips every bright surface to flat
 * white, so a lit canopy loses all its shape at the top. ACES rolls highlights
 * off instead of cutting them. It is a setting on the existing render, not an
 * extra pass, so it is free.
 *
 * **Shadows.** One directional light casting into one shadow map. This is the
 * largest single step away from "a children's game": without contact shadows
 * everything floats, and without cast shadows nothing has volume.
 *
 * The honest cost, and it is real: a shadow map is a second render of the
 * shadow-casting geometry from the light's point of view, every frame. The
 * PRD's performance budget says no realtime shadows for exactly this reason.
 * It is on here because it is the difference the user asked for, and it is a
 * single switch — `shadows: false` puts the budget back. It has not been
 * measured on a headset. That measurement is Phase 0's job.
 */

AFRAME.registerComponent('scene-look', {
  schema: {
    exposure: { type: 'number', default: 1 },
    shadows: { type: 'boolean', default: true },
    /** Shadow map edge. 2048 is sharp on a tablet; drop to 1024 on device. */
    shadowMapSize: { type: 'number', default: 2048 },
  },

  init() {
    const apply = () => this.apply();
    if (this.el.renderer) apply();
    else this.el.addEventListener('render-target-loaded', apply, { once: true });
  },

  apply() {
    const { renderer } = this.el;
    if (!renderer) return;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.data.exposure;

    renderer.shadowMap.enabled = this.data.shadows;
    // PCF soft: a few taps around each sample instead of one. Hard shadow edges
    // are the giveaway that a scene is computer-generated.
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (this.data.shadows) this.configureSun();

    // Materials cached before these changes do not pick them up.
    this.el.object3D.traverse((object) => {
      if (object.material) object.material.needsUpdate = true;
    });
  },

  /**
   * Aim the shadow camera at the part of the world a seated child can see.
   *
   * A directional light's shadow camera is an orthographic box, and its size
   * is the whole quality/coverage trade: too large and the map's pixels are
   * spread thin and the shadows turn to mush; too small and objects outside it
   * simply have no shadow at all. Everything a lesson places sits within about
   * twenty metres, so that is the box.
   */
  configureSun() {
    const sunEl = document.querySelector('#sun');
    const light = sunEl?.getObject3D('light');
    if (!light) return;

    light.castShadow = true;
    light.shadow.mapSize.setScalar(this.data.shadowMapSize);

    // Tighter than the whole yard on purpose. A shadow camera is an
    // orthographic box, and every metre of it spends texels: at ±22 m a 2048
    // map gives ~2 cm per texel, which is why the shadows were soft blobs
    // rather than animals. ±14 m still covers everything a lesson places.
    const camera = light.shadow.camera;
    camera.left = -14;
    camera.right = 14;
    camera.top = 14;
    camera.bottom = -14;
    camera.near = 0.5;
    camera.far = 60;
    camera.updateProjectionMatrix();

    // Bias fights shadow acne — a surface shadowing itself because its own
    // depth and the map's depth disagree by less than a texel.
    //
    // But bias is also what detaches a shadow from the thing casting it, and
    // that gap is read as the object floating. `normalBias` at 0.02 pushed the
    // sample 2 cm along the surface normal, which on flat ground is 2 cm of
    // daylight under every hoof. Small enough to stop acne, small enough not
    // to lift anything off the grass.
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.004;
  },
});

/**
 * Mark an entity and everything under it as casting and receiving shadows.
 *
 * glTF models arrive with `castShadow` false on every mesh, and there is no
 * A-Frame attribute for it, so it has to be walked after the model loads.
 */
AFRAME.registerComponent('shadowed', {
  schema: {
    cast: { type: 'boolean', default: true },
    receive: { type: 'boolean', default: true },
  },

  init() {
    this.apply = this.apply.bind(this);
    this.el.addEventListener('model-loaded', this.apply);
    this.apply();
  },

  apply() {
    this.el.object3D.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = this.data.cast;
      object.receiveShadow = this.data.receive;
    });
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.apply);
  },
});
