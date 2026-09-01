/**
 * Measuring a model.
 *
 * Every number in library.json that a human could get wrong is produced here,
 * by reading the file. That is the whole reason the library is generated
 * rather than written: a measured catalogue cannot drift from what is on disk.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §12.2.
 */

import { getBounds } from '@gltf-transform/core';

import { skinnedBounds } from './skinned-bounds.js';

/** Vertices per primitive mode, used to turn an index count into triangles. */
const TRIANGLE_MODES = new Set([4, 5, 6]); // TRIANGLES, STRIP, FAN

/**
 * World-space bounding box of the whole default scene.
 * @returns {{min: number[], max: number[]}}
 */
export function bounds(document) {
  // Skinning first, for the same reason the contract prefers it: a rigged
  // model is drawn by its skeleton, not by its boxes. The library must record
  // the height a lesson will actually see.
  const skinned = skinnedBounds(document);
  if (skinned) return skinned;

  return getBounds(document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0]);
}

/** Height in metres, along Y — the axis a child sees as "tall". */
export function height(document) {
  const b = bounds(document);
  return b.max[1] - b.min[1];
}

/**
 * Triangles across every primitive in the file.
 *
 * Counted per primitive, not per placement: how many times a lesson places
 * this model is the validator's problem, not the library's.
 */
export function triangles(document) {
  let total = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!TRIANGLE_MODES.has(prim.getMode())) continue;

      const indices = prim.getIndices();
      const count = indices
        ? indices.getCount()
        : (prim.getAttribute('POSITION')?.getCount() ?? 0);

      // Strips and fans emit one triangle per vertex after the first two.
      total += prim.getMode() === 4 ? count / 3 : Math.max(0, count - 2);
    }
  }

  return Math.round(total);
}

/**
 * Primitive count — our proxy for draw calls.
 *
 * A proxy, not a promise. One primitive is roughly one draw call, but the
 * renderer decides. The only honest frame-rate number comes off the headset.
 */
export function primitiveCount(document) {
  return document
    .getRoot()
    .listMeshes()
    .reduce((n, mesh) => n + mesh.listPrimitives().length, 0);
}

/** Exact animation clip names. A lesson naming a clip that is not here fails the build. */
export function clipNames(document) {
  return document.getRoot().listAnimations().map((a) => a.getName());
}

/** Longest edge of the largest texture, in pixels. The 1024 budget is checked against this. */
export function largestTextureEdge(document) {
  let largest = 0;

  for (const texture of document.getRoot().listTextures()) {
    const size = texture.getSize(); // [width, height] or null
    if (size) largest = Math.max(largest, size[0], size[1]);
  }

  return largest;
}

/** Everything the library records about one model, in one pass. */
export function measure(document) {
  const b = bounds(document);

  return {
    height: round(b.max[1] - b.min[1]),
    // Footprint. Height alone does not say how much room a model needs: a
    // 1.1 m boulder can be 4 m across. Anything laying out a scene — a stage
    // kit, the contact sheet — needs both.
    width: round(b.max[0] - b.min[0]),
    depth: round(b.max[2] - b.min[2]),
    baseY: round(b.min[1]),
    centreX: round((b.min[0] + b.max[0]) / 2),
    centreZ: round((b.min[2] + b.max[2]) / 2),
    triangles: triangles(document),
    meshes: primitiveCount(document),
    clips: clipNames(document),
    textureEdge: largestTextureEdge(document),
  };
}

const round = (n) => Math.round(n * 1000) / 1000;
