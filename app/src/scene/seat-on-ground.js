/**
 * Drop an animated model onto the ground, and keep it there.
 *
 * The build-time contract measures a model's *bind* pose — the shape stored in
 * the file. What a lesson shows is the *animated* pose, and for a rigged model
 * the two are not the same: a clip can lift the root, so a cow whose file says
 * it stands at y = 0 floats once its idle plays.
 *
 * **The trap, and the reason the first version of this did nothing.**
 * `Box3.setFromObject` does not account for skinning. On a `SkinnedMesh` it
 * returns the bind-pose box no matter what the skeleton is doing, so measuring
 * with it produces the same number the pipeline already had — and "correcting"
 * by that number changes nothing while looking like it worked.
 *
 * The vertices have to be asked directly. `SkinnedMesh.getVertexPosition`
 * applies the skinning, so sampling it gives where the model actually is.
 *
 * It runs once per clip, not per frame — a clip change moves the feet, so a
 * walk cycle and a graze need separate measurements.
 */

/** Every Nth vertex. A foot is thousands of vertices; we need the lowest, not all of them. */
const SAMPLE_STRIDE = 7;

const vertex = new THREE.Vector3();

AFRAME.registerComponent('seat-on-ground', {
  schema: {
    /** Ignore offsets smaller than this — below it, seating is noise. */
    tolerance: { type: 'number', default: 0.02 },
  },

  init() {
    this.reseat = this.reseat.bind(this);

    this.el.addEventListener('model-loaded', this.reseat);
    this.reseat();
  },

  /**
   * A different clip stands differently — grazing and walking do not put the
   * feet in the same place — so re-measure when one changes.
   *
   * NOT on `animation-loop`. That fires every cycle, and a correction applied
   * every cycle walks the model steadily into the ground: each pass measures
   * the result of the last one and subtracts again. The cow ended up 1.6 m
   * under the grass that way.
   */
  update() {
    this.reseat();
  },

  reseat() {
    // Wait a frame: `model-loaded` fires before the mixer has posed the
    // skeleton, so measuring immediately measures the bind pose again — the
    // very thing this exists to work around.
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      // Measured in the ENTITY's space, because that is the space
      // `mesh.position` lives in. Measuring in the mesh's own space and then
      // adjusting the mesh's position mixes two frames of reference, and the
      // correction never converges.
      const lowest = lowestPoint(mesh, this.el.object3D);
      if (lowest === null) return;
      if (Math.abs(lowest) < this.data.tolerance) return;

      // Adjust inside the entity, so the entity's own position stays exactly
      // what the lesson author wrote.
      mesh.position.y -= lowest;
    });
  },

  remove() {
    cancelAnimationFrame(this.pending);
    this.el.removeEventListener('model-loaded', this.reseat);
  },
});

/**
 * The lowest point of the posed model, expressed in `space`.
 *
 * Skinned meshes are sampled through `getVertexPosition`, which applies the
 * skeleton. Ordinary meshes fall back to their geometry, which for them is
 * correct.
 */
function lowestPoint(root, space) {
  let lowest = Infinity;

  root.updateWorldMatrix(true, true);

  root.traverse((object) => {
    if (!object.isMesh) return;

    const positions = object.geometry?.getAttribute('position');
    if (!positions) return;

    for (let i = 0; i < positions.count; i += SAMPLE_STRIDE) {
      if (object.isSkinnedMesh) {
        object.getVertexPosition(i, vertex); // local, skinned
        object.localToWorld(vertex);
      } else {
        vertex.fromBufferAttribute(positions, i);
        object.localToWorld(vertex);
      }

      space.worldToLocal(vertex);
      if (vertex.y < lowest) lowest = vertex.y;
    }
  });

  return Number.isFinite(lowest) ? lowest : null;
}
