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
    /** Half-width of the shadow camera's box, in metres. */
    shadowExtent: { type: 'number', default: 28 },
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

    // A shadow camera is an orthographic box, and every metre of it spends
    // texels. Too tight and the main subject falls outside it and casts
    // nothing; too wide and every shadow turns to mush.
    //
    // ±28 m covers a school compound from the gate to the far wall, which is
    // what these lands are. At 2048 that is about 2.7 cm per texel — soft, but
    // a building's shadow is soft anyway. The scene is configurable so a
    // tighter land can ask for a tighter box.
    const camera = light.shadow.camera;
    const extent = this.data.shadowExtent;

    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.near = 0.5;
    camera.far = 90;
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
    // A built prop — a road, a row of shops — makes its meshes a moment after
    // it is attached, some of them on child entities. Walking once at init
    // finds nothing, and the road then took no shadow from anything standing
    // on it. `object3dset` bubbles up from every child as its mesh arrives.
    this.el.addEventListener('object3dset', this.apply);
    this.apply();
  },

  apply() {
    this.el.object3D.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = this.data.cast;
      object.receiveShadow = this.data.receive;
      // A cut-out leaf has a hard, stair-stepped edge at its alpha cutoff.
      // With multisampling on, alpha-to-coverage lets the edge dissolve
      // across the samples instead, and a canopy stops looking like paper.
      for (const material of [].concat(object.material)) {
        if (material && material.alphaTest > 0 && !material.alphaToCoverage) {
          material.alphaToCoverage = true;
          material.needsUpdate = true;
        }
      }
    });
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.apply);
    this.el.removeEventListener('object3dset', this.apply);
  },
});
