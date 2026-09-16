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
    this.fit();
  },

  /** Match the patch to the model's footprint, not to a guess. */
  fit() {
    const mesh = this.el.getObject3D('mesh');
    const size = this.data.radius * 2;

    if (mesh) {
      const box = new THREE.Box3().setFromObject(mesh);
      // Slightly smaller than the footprint, not larger. Contact darkening is
      // tightest where the body is closest to the ground; spreading it wider
      // than the animal turns it into a second, wrong shadow.
      const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      if (footprint > 0) return this.patch.scale.set(footprint * 0.85, footprint * 0.85, 1);
    }

    this.patch.scale.set(size, size, 1);
  },

  remove() {
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
