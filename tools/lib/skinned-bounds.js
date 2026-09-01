/**
 * Measuring a rigged model the way it will actually be drawn.
 *
 * This is the fix for the bug that kept producing giant animals, and the
 * reason it was so hard to see.
 *
 * `getBounds` walks the node hierarchy and transforms each mesh's bounding
 * box. For a rigged model that answer is wrong, because a skinned mesh does
 * not use its node's transform at all — the glTF spec says to ignore it — and
 * its vertices are placed by the skeleton instead. Whenever a file's inverse
 * bind matrices disagree with its node hierarchy, the two answers diverge:
 * one chicken measured 0.45 m by its boxes and drew at 17 m, because its
 * inverse bind matrices carry a scale of 39.
 *
 * So this does what the renderer does. For each vertex it builds the skin
 * matrix — the weighted blend of `jointWorld × inverseBind` over the joints
 * that influence it — applies it, and takes the extremes. The result is where
 * the model will be, not where its boxes claim it is.
 *
 * Cost is a build-time pass over a sample of vertices, once per model.
 */

/** Every Nth vertex. Extremes live on the surface; we do not need all of it. */
const STRIDE = 5;

/**
 * @param {import('@gltf-transform/core').Document} document
 * @returns {{min: number[], max: number[]} | null} null if nothing is skinned
 */
export function skinnedBounds(document) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!scene) return null;

  const worldOf = new Map();
  for (const child of scene.listChildren()) collectWorldMatrices(child, IDENTITY, worldOf);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let sawSkin = false;

  for (const node of worldOf.keys()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;

    sawSkin = true;

    const joints = skin.listJoints();
    const ibmAccessor = skin.getInverseBindMatrices();

    // Joint matrix = jointWorld × inverseBind. Precomputed per joint, because
    // every vertex reuses them.
    const jointMatrices = joints.map((joint, index) => {
      const world = worldOf.get(joint) ?? IDENTITY;
      const ibm = ibmAccessor ? ibmAccessor.getElement(index, []) : IDENTITY;
      return multiply(world, ibm);
    });

    for (const primitive of mesh.listPrimitives()) {
      accumulate(primitive, jointMatrices, min, max);
    }
  }

  return sawSkin ? { min, max } : null;
}

function accumulate(primitive, jointMatrices, min, max) {
  const position = primitive.getAttribute('POSITION');
  const jointsAttr = primitive.getAttribute('JOINTS_0');
  const weightsAttr = primitive.getAttribute('WEIGHTS_0');

  if (!position || !jointsAttr || !weightsAttr) return;

  const vertex = [0, 0, 0];
  const jointIds = [0, 0, 0, 0];
  const weights = [0, 0, 0, 0];
  const out = [0, 0, 0];

  for (let i = 0; i < position.getCount(); i += STRIDE) {
    position.getElement(i, vertex);
    jointsAttr.getElement(i, jointIds);
    weightsAttr.getElement(i, weights);

    out[0] = out[1] = out[2] = 0;
    let total = 0;

    for (let j = 0; j < 4; j += 1) {
      const weight = weights[j];
      if (!weight) continue;

      const matrix = jointMatrices[jointIds[j]];
      if (!matrix) continue;

      total += weight;
      out[0] += weight * (matrix[0] * vertex[0] + matrix[4] * vertex[1] + matrix[8] * vertex[2] + matrix[12]);
      out[1] += weight * (matrix[1] * vertex[0] + matrix[5] * vertex[1] + matrix[9] * vertex[2] + matrix[13]);
      out[2] += weight * (matrix[2] * vertex[0] + matrix[6] * vertex[1] + matrix[10] * vertex[2] + matrix[14]);
    }

    // Weights that do not sum to 1 are common in exported files; renormalising
    // matches what a renderer does rather than shrinking the model toward zero.
    if (total > 0 && Math.abs(total - 1) > 1e-4) {
      out[0] /= total;
      out[1] /= total;
      out[2] /= total;
    }

    for (let axis = 0; axis < 3; axis += 1) {
      if (out[axis] < min[axis]) min[axis] = out[axis];
      if (out[axis] > max[axis]) max[axis] = out[axis];
    }
  }
}

/** World matrix of every node under `node`, keyed by node. */
function collectWorldMatrices(node, parentMatrix, into) {
  const world = multiply(parentMatrix, matrixOf(node));
  into.set(node, world);

  for (const child of node.listChildren()) collectWorldMatrices(child, world, into);
}

/** A node's local matrix, column-major, from its TRS. */
function matrixOf(node) {
  const [tx, ty, tz] = node.getTranslation();
  const [qx, qy, qz, qw] = node.getRotation();
  const [sx, sy, sz] = node.getScale();

  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** a × b, both column-major. */
function multiply(a, b) {
  const out = new Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }

  return out;
}
