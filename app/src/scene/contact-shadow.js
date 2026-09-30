/**
 * A soft dark patch on the ground under an object.
 *
 * Without one, everything in the scene looks like it is hovering a centimetre
 * above the grass — the eye reads contact from the darkening underneath, not
 * from the geometry touching. It is the single largest gain in how solid a
 * scene feels.
 *
 * It is NOT a real shadow. A real shadow means a depth pass from the light's
 * point of view every frame, and the performance budget says no realtime
 * shadows. This is one extra transparent circle per object: it does not move
 * with the sun, it does not fall across anything, and at 1.2 m of eye height
 * looking at animals on flat ground, nobody can tell.
 */

import { posedBounds } from './posed-bounds.js';

/** Cached so N objects share one texture rather than generating N of them. */
let sharedTexture = null;

AFRAME.registerComponent('contact-shadow', {
  schema: {
    radius: { type: 'number', default: 0.6 },
    opacity: { type: 'number', default: 0.32 },
  },

  init() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      transparent: true,
      opacity: this.data.opacity,
      depthWrite: false, // never occlude the grass it sits on
      toneMapped: false,
    });

    const patch = new THREE.Mesh(geometry, material);
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.01; // clear of the ground plane, or the two z-fight

    // Draw AFTER the opaque ground. A transparent patch drawn first is simply
    // painted over — the reason this was invisible on the first attempt.
    patch.renderOrder = 1;

    this.patch = patch;
    this.el.object3D.add(patch);

    // Size it to what the model actually occupies, once the model exists.
    this.el.addEventListener('model-loaded', () => this.fit(), { once: true });

    // A thing built out of child entities — a bead, a letter card — never says
    // `model-loaded`; its parts turn up one by one over the first few frames.
    // Each says so as it arrives, and the patch is measured again once they
    // have stopped arriving.
    this.onPart = () => {
      clearTimeout(this.refit);
      this.refit = setTimeout(() => this.fit(), 80);
    };
    this.el.addEventListener('object3dset', this.onPart);

    this.fit();
  },

  /**
   * Match the patch to the model's footprint, not to a guess.
   *
   * A frame late, so the skeleton has been posed; and measured on the posed
   * vertices in the object's OWN space, for two reasons that both showed on a
   * table of insects. Measured as modelled, a grasshopper is 4.6 m long. And
   * measured in the world and then set on a patch that is scaled with its
   * object, the size was multiplied by the object's scale a second time: the
   * grasshopper, drawn three and a half times life size, stood on a dark pool
   * 13 m across.
   */
  fit() {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      const guess = this.data.radius * 2;
      const mesh = this.el.getObject3D('mesh');

      // A downloaded model is one mesh on the entity. A thing built from child
      // entities — a bead, a letter card — has none, and its parts are
      // measured instead: all but the marks hung on it afterwards.
      const marks = [this.patch, this.el.components.highlight?.ring?.object3D, this.el.components['tap-target']?.box?.object3D];
      const roots = mesh ? [mesh] : this.el.object3D.children.filter((part) => !marks.includes(part));
      const bounds = posedBounds(roots, this.el.object3D);

      // Slightly smaller than the footprint, not larger. Contact darkening is
      // tightest where the body is closest to the ground; spreading it wider
      // than the animal turns it into a second, wrong shadow.
      const footprint = bounds
        ? Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) * 0.85
        : 0;

      // A built thing only ever comes DOWN from the guess. Under a bead 6 cm
      // across the guess is a pool 1.2 m across, and twenty beads in a row
      // stacked twenty of them into a black hole in the table. But a built
      // school has always had the guess, and a patch the size of a school is
      // a dark ring thirty metres across round its walls. Only a downloaded
      // model is trusted to be as big as it measures.
      const downloaded = this.el.hasAttribute('gltf-model');
      const across = footprint > 0 && (downloaded || footprint < guess) ? footprint : guess;
      this.patch.scale.set(across, across, 1);
    });
  },

  remove() {
    cancelAnimationFrame(this.pending);
    clearTimeout(this.refit);
    this.el.removeEventListener('object3dset', this.onPart);
    this.el.object3D.remove(this.patch);
    this.patch.geometry.dispose();
  },
});

/** A soft dark blob, drawn once into a small canvas and reused by every object. */
function radialTexture() {
  if (sharedTexture) return sharedTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
  gradient.addColorStop(0.4, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  sharedTexture = new THREE.CanvasTexture(canvas);
  return sharedTexture;
}
