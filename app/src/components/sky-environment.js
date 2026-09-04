/**
 * The sky, and the light that comes off it.
 *
 * One captured equirectangular photograph does both jobs, and that is the whole
 * point: what the child sees overhead and what lights the cow are the same
 * pixels, so they can never disagree. A procedural gradient sky can be made to
 * look pleasant, but it lights a scene like a paint chip — evenly, from
 * nowhere. A real sky has a bright quarter around the sun, cool blue opposite
 * it, and a pale band at the horizon, and every surface picks that up.
 *
 * Two things are set on the three.js scene, and neither has an A-Frame
 * attribute, so this reaches through to `sceneEl.object3D`:
 *
 *   scene.background   the image itself, drawn by the renderer — no sky sphere,
 *                      one fewer object in the scene than `<a-sky>` needs
 *   scene.environment  the same image prefiltered by PMREMGenerator into an
 *                      irradiance map, which is what makes every PBR material
 *                      look lit rather than painted
 *
 * The prefilter runs once at load. Per frame it costs nothing.
 */

const loader = new THREE.TextureLoader();

AFRAME.registerComponent('sky-environment', {
  schema: {
    src: { type: 'string' },
    /** Lighting strength, separate from how bright the backdrop looks. */
    intensity: { type: 'number', default: 1 },
    /** Turn the sky to solid black without discarding it — the teacher's "eyes on me". */
    blackout: { type: 'boolean', default: false },

    /**
     * No sky at all, and no light from one.
     *
     * Not the same as blackout. Blackout hides the sky and keeps the world lit
     * underneath, so letting it back is instant. `space` throws the
     * environment away: in the solar system the Sun is the only light there
     * is, and an irradiance map left over from a field at noon would fill
     * every planet's night side with daylight.
     */
    space: { type: 'boolean', default: false },
  },

  init() {
    this.texture = null;
    this.envTarget = null;
    this.ready = false;

    const start = () => {
      this.ready = true;
      this.update();
    };

    if (this.el.renderer) start();
    else this.el.addEventListener('render-target-loaded', start, { once: true });
  },

  update(previous = {}) {
    if (!this.ready) return;

    const scene = this.el.object3D;

    if (this.data.space) {
      this.dispose();
      scene.background = new THREE.Color(0x000000);
      return;
    }

    if (this.data.blackout) {
      // Keep the environment: the world must stay lit underneath, so that
      // letting the sky back is instant and nothing has to be rebuilt.
      scene.background = new THREE.Color(0x000000);
      return;
    }

    if (this.data.src !== previous.src || !this.texture) this.load();
    else scene.background = this.texture;
  },

  load() {
    const scene = this.el.object3D;

    this.dispose();

    this.texture = loader.load(this.data.src, () => {
      // Equirectangular mapping tells three.js to read this flat image as a
      // full sphere of directions rather than as a rectangle.
      this.texture.mapping = THREE.EquirectangularReflectionMapping;
      this.texture.colorSpace = THREE.SRGBColorSpace;

      scene.background = this.texture;
      this.buildEnvironment();
    });
  },

  buildEnvironment() {
    const scene = this.el.object3D;
    const pmrem = new THREE.PMREMGenerator(this.el.renderer);

    this.envTarget = pmrem.fromEquirectangular(this.texture);
    scene.environment = this.envTarget.texture;
    scene.environmentIntensity = this.data.intensity;

    pmrem.dispose();
  },

  dispose() {
    const scene = this.el.object3D;

    this.envTarget?.dispose();
    this.texture?.dispose();
    this.envTarget = null;
    this.texture = null;

    scene.environment = null;
    scene.background = null;
  },

  remove() {
    this.dispose();
  },
});
