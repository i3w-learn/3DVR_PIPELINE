/**
 * The model contract — the three corrections that must never reach a lesson.
 *
 *   1 unit = 1 metre
 *   origin at the base, centred      (feet on y = 0)
 *   facing +Z
 *
 * A model that honours these can be placed by exactly the same code as any
 * other model. A model that does not forces the scene to carry a per-model
 * `scale: 0.33` or `yaw: 90` — and those corrections leak into lesson JSON,
 * where they are permanent. Repair belongs here; placement belongs in a stage
 * kit or a lesson recipe. They are never the same field.
 *
 * The pipeline document specifies a headless Blender pass for this. It is not
 * needed: all three corrections are a single transform on a wrapper node, and
 * wrapping leaves skinned meshes and their animation clips untouched. One less
 * tool to install, and the step runs in CI.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §12.5.
 */

import { getBounds } from '@gltf-transform/core';

import { skinnedBounds } from './skinned-bounds.js';

/** How far a standardised model may miss its target height before we fail. */
const HEIGHT_TOLERANCE = 0.01; // metres

export class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Put a document on the contract, in place.
 *
 * @param {import('@gltf-transform/core').Document} document
 * @param {{targetHeight: number, yaw: number}} sidecar
 * @returns {{scale: number, yaw: number, before: object, after: object}}
 */
export function applyContract(document, { targetHeight, yaw = 0, fit = 'height' }) {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  if (!scene) {
    throw new ContractError('STD_CONTRACT', 'File has no scene.');
  }

  const before = boundsOf(scene, document);

  // A single wrapper node carries every correction. Existing nodes, skins and
  // animation channels are re-parented, not rewritten.
  const wrapper = document.createNode('contract');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrapper.addChild(child);
  }
  scene.addChild(wrapper);

  // Turn first, then measure. A bus modelled 26° off its axis has a different
  // bounding box once it is straightened, and a scale worked out from the
  // crooked box lands the straight bus at 8.4 m when 9 m was asked for.
  wrapper.setRotation(yawQuaternion(yaw));
  const turned = boundsOf(scene, document);

  // Height is the right dial for anything that stands up — an animal, a tree,
  // a fence. It is the wrong one for anything that lies flat: a boulder
  // 4.3 m across and 1.1 m tall, scaled to "1.1 m", becomes the size of a car.
  // Those set `fit: "longest"` in the sidecar and are measured across instead.
  const currentSize = fit === 'longest' ? longestSide(turned) : turned.max[1] - turned.min[1];

  if (!(currentSize > 0)) {
    throw new ContractError('STD_CONTRACT', 'Model has zero size — nothing to scale.');
  }

  const scale = targetHeight / currentSize;
  wrapper.setScale([scale, scale, scale]);

  // Translation is applied after rotation and scale, so the offset has to be
  // measured from the already-rotated, already-scaled bounds — not the original.
  const rotated = boundsOf(scene, document);
  wrapper.setTranslation([
    -(rotated.min[0] + rotated.max[0]) / 2,
    -rotated.min[1],
    -(rotated.min[2] + rotated.max[2]) / 2,
  ]);

  const after = boundsOf(scene, document);
  verify(after, targetHeight, fit);

  return { scale, yaw, fit, before, after };
}

/** Quaternion for a rotation of `degrees` about Y. */
function yawQuaternion(degrees) {
  const half = (degrees * Math.PI) / 180 / 2;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

const longestSide = (b) => Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);

/**
 * The bounds that matter: where the model will be drawn.
 *
 * For a rigged model the node hierarchy's boxes are not that. A skinned mesh
 * ignores its node's transform and is placed by the skeleton, so whenever a
 * file's inverse bind matrices disagree with its hierarchy the two answers
 * diverge — one chicken measured 0.45 m by its boxes and drew at 17 m.
 *
 * So skinning wins when there is any. Static props fall back to the boxes,
 * which for them is exactly right.
 */
function boundsOf(scene, document) {
  const skinned = document ? skinnedBounds(document) : null;
  if (skinned) return skinned;

  const b = getBounds(scene);
  return { min: [...b.min], max: [...b.max] };
}

/** The contract is not "applied", it is "true" — so check it before moving on. */
function verify(bounds, targetHeight, fit) {
  const measured = fit === 'longest' ? longestSide(bounds) : bounds.max[1] - bounds.min[1];

  if (Math.abs(measured - targetHeight) > HEIGHT_TOLERANCE) {
    throw new ContractError(
      'STD_CONTRACT',
      `${fit === 'longest' ? 'Longest side' : 'Height'} is ${measured.toFixed(3)} m after scaling, expected ${targetHeight} m.`
    );
  }

  if (Math.abs(bounds.min[1]) > HEIGHT_TOLERANCE) {
    throw new ContractError(
      'STD_CONTRACT',
      `Base sits at y = ${bounds.min[1].toFixed(3)} instead of 0 — the model would float or sink.`
    );
  }
}
