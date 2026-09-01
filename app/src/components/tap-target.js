/**
 * An invisible box a child can actually hit.
 *
 * Clicking an animal did nothing, and the reason is the same blindness that
 * produced the giant hen: **three.js raycasts a skinned mesh against its bind
 * pose.** It tests the geometry's bounding volume and triangles as stored in
 * the file, not as the skeleton has placed them. For these models the two are
 * in different parts of the yard, so the ray sails past a cow that is plainly
 * on screen.
 *
 * Rather than raycast the skin, each animal carries a plain box the size of
 * its posed self. Boxes raycast correctly, cost nothing, and are exactly as
 * accurate as this needs to be — a three-year-old aiming at a cow is aiming at
 * a cow-sized region, not at its left ear.
 *
 * The box is transparent rather than `visible: false`, because three.js skips
 * invisible objects when raycasting — which would put us back where we started.
 */

const vertex = new THREE.Vector3();

/** Every Nth vertex. The extremes are what matter, not the surface. */
const SAMPLE_STRIDE = 11;

/** Room around the model, so a near miss still counts as a tap. */
const PADDING = 1.15;

AFRAME.registerComponent('tap-target', {
  init() {
    this.build = this.build.bind(this);
    this.el.addEventListener('model-loaded', this.build);
    this.build();
  },

  build() {
    // A frame late, so the mixer has posed the skeleton. Measuring before that
    // measures the bind pose — the very thing this exists to work around.
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      const bounds = posedBounds(mesh, this.el.object3D);
      if (!bounds) return;

      this.box ??= this.makeBox();

      const size = [0, 1, 2].map((i) => Math.max(bounds.max[i] - bounds.min[i], 0.2) * PADDING);
      this.box.setAttribute('width', size[0]);
      this.box.setAttribute('height', size[1]);
      this.box.setAttribute('depth', size[2]);
      this.box.setAttribute('position', {
        x: (bounds.min[0] + bounds.max[0]) / 2,
        y: (bounds.min[1] + bounds.max[1]) / 2,
        z: (bounds.min[2] + bounds.max[2]) / 2,
      });
    });
  },

  makeBox() {
    const box = document.createElement('a-box');

    // Invisible, but still raycastable: three.js skips `visible: false`.
    box.setAttribute('material', 'opacity: 0; transparent: true; depthWrite: false');
    box.classList.add('clickable');

    // The box is what the ray hits; the animal is what the lesson knows about.
    box.addEventListener('click', (event) => {
      event.stopPropagation();
      this.el.emit('click', null, false);
    });

    this.el.appendChild(box);
    return box;
  },

  remove() {
    cancelAnimationFrame(this.pending);
    this.el.removeEventListener('model-loaded', this.build);
    this.box?.remove();
  },
});

/** Posed bounds, in `space`. Skinned vertices are asked directly. */
function posedBounds(root, space) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let any = false;

  root.updateWorldMatrix(true, true);

  root.traverse((object) => {
    if (!object.isMesh) return;

    const positions = object.geometry?.getAttribute('position');
    if (!positions) return;

    for (let i = 0; i < positions.count; i += SAMPLE_STRIDE) {
      if (object.isSkinnedMesh) object.getVertexPosition(i, vertex);
      else vertex.fromBufferAttribute(positions, i);

      object.localToWorld(vertex);
      space.worldToLocal(vertex);

      for (let axis = 0; axis < 3; axis += 1) {
        if (vertex.getComponent(axis) < min[axis]) min[axis] = vertex.getComponent(axis);
        if (vertex.getComponent(axis) > max[axis]) max[axis] = vertex.getComponent(axis);
      }
      any = true;
    }
  });

  return any ? { min, max } : null;
}
