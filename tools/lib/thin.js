/**
 * Thinning a tree's leaves for a copy that will only ever be seen from far off.
 *
 * A scanned tree's foliage is thousands of separate little cards. A simplifier
 * cannot help with that: it merges triangles that share an edge, and a card
 * shares nothing with its neighbour — the fir went in at 7,700 triangles and
 * came out at 5,200 however hard it was asked.
 *
 * What works is what a painter does for a distant tree: fewer, bigger dabs.
 * Keep a fraction of the cards and grow each survivor about its own middle, so
 * the crown covers the same sky with a quarter of the triangles. The trunk and
 * the boughs are large connected pieces and are never touched.
 *
 * Seeded, so the same download always thins to the same tree.
 */

import { compactPrimitive, weld } from '@gltf-transform/functions';

export class ThinError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * @param {import('@gltf-transform/core').Document} document
 * @param {number | null} keep   fraction of leaf cards to keep, 0–1
 * @param {{maxIsland?: number, seed?: number}} [options]
 *   `maxIsland`: a connected piece with more triangles than this is wood, not a leaf.
 * @returns {Promise<{before: number, after: number}>}
 */
export async function thinCards(document, keep, { maxIsland = 12, seed = 7 } = {}) {
  if (keep == null) return { before: 0, after: 0 };
  if (!(keep > 0 && keep <= 1)) throw new ThinError('STD_CONTRACT', `thin must be above 0 and at most 1; got ${keep}.`);

  // Connectivity is read off shared vertices, so they have to be shared first.
  await document.transform(weld());

  const random = mulberry(seed);
  const grow = Math.min(2.5, 1 / Math.sqrt(keep));
  let before = 0, after = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const source = prim.getAttribute('POSITION');
      if (!indices || !source) continue;

      const index = indices.getArray();
      const triangles = index.length / 3;
      before += triangles;

      // Which connected piece does each vertex belong to?
      const parent = new Uint32Array(source.getCount()).map((_, i) => i);
      const find = (v) => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
      for (let t = 0; t < triangles; t += 1) {
        const a = find(index[t * 3]);
        parent[find(index[t * 3 + 1])] = a;
        parent[find(index[t * 3 + 2])] = a;
      }

      const pieces = new Map();
      for (let t = 0; t < triangles; t += 1) {
        const root = find(index[t * 3]);
        if (!pieces.has(root)) pieces.set(root, []);
        pieces.get(root).push(t);
      }

      // The accessor may be shared with another primitive; grow a private copy.
      const position = source.clone();
      prim.setAttribute('POSITION', position);

      const kept = [];
      const p = [0, 0, 0];

      for (const tris of pieces.values()) {
        const leaf = tris.length <= maxIsland;
        if (leaf && random() > keep) continue;

        for (const t of tris) kept.push(index[t * 3], index[t * 3 + 1], index[t * 3 + 2]);
        if (!leaf) continue;

        const vertices = [...new Set(tris.flatMap((t) => [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]]))];
        const middle = [0, 0, 0];
        for (const v of vertices) { position.getElement(v, p); for (let k = 0; k < 3; k += 1) middle[k] += p[k] / vertices.length; }
        for (const v of vertices) {
          position.getElement(v, p);
          position.setElement(v, p.map((value, k) => middle[k] + (value - middle[k]) * grow));
        }
      }

      after += kept.length / 3;

      prim.setIndices(
        document.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(indices.getBuffer())
      );
      compactPrimitive(prim);
    }
  }

  return { before, after };
}

/** A small seeded generator; Math.random would thin a different tree every run. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
