/**
 * Where a model actually is.
 *
 * `Box3.setFromObject` reads a skinned mesh as it was modelled, not as its
 * skeleton holds it — the bind pose, which for these animals can be a
 * different size in a different part of the yard. Everything that needs to
 * know how big a posed animal is asks its vertices instead: the tap box, and
 * the dark patch underneath it.
 */

const vertex = new THREE.Vector3();

/** Every Nth vertex. The extremes are what matter, not the surface. */
const SAMPLE_STRIDE = 11;

/** Posed bounds over every root, in `space`. Skinned vertices are asked directly. */
export function posedBounds(roots, space) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let any = false;

  for (const root of roots) {
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
  }

  return any ? { min, max } : null;
}
