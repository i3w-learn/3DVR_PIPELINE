/**
 * Smoothing normals, so a curved surface stops showing its triangles.
 *
 * The low-poly animal packs ship flat-shaded: every triangle has its own
 * normal, so every triangle catches the light differently and the whole
 * faceted structure is visible on what should read as a curved flank. It is
 * the single loudest "this is made of polygons" signal in the scene, and it is
 * a property of the normals, not of the triangle count — the same mesh with
 * smoothed normals reads as round.
 *
 * Smoothing everything is wrong, though. A horn tip, a hoof edge and the seam
 * where a leg meets a body are *meant* to be sharp, and averaging across them
 * gives the soft, melted look of a badly imported model. So this is
 * angle-threshold smoothing, the same idea as a modelling package's smoothing
 * groups: neighbouring faces share a normal only when the angle between them
 * is gentle. Anything sharper stays a crease.
 */

import { PropertyType } from '@gltf-transform/core';

/** Faces meeting at a gentler angle than this are smoothed together. */
const DEFAULT_ANGLE = 55; // degrees

/**
 * @param {import('@gltf-transform/core').Document} document
 * @param {{angle?: number}} options
 * @returns {{primitives: number}} how many primitives were re-normalled
 */
export function smoothNormals(document, { angle = DEFAULT_ANGLE } = {}) {
  const threshold = Math.cos((angle * Math.PI) / 180);
  let touched = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) continue; // triangles only

      const position = primitive.getAttribute('POSITION');
      const normal = primitive.getAttribute('NORMAL');
      const indices = primitive.getIndices();

      if (!position || !normal || !indices) continue;

      recompute(position, normal, indices, threshold);
      touched += 1;
    }
  }

  return { primitives: touched };
}

/**
 * Two passes over the mesh.
 *
 * First, accumulate every face normal onto the vertices it touches, grouped by
 * *position* rather than by index — a flat-shaded model has split its vertices
 * already, so the same corner appears several times and the neighbours have to
 * be found geometrically.
 *
 * Second, for each vertex, average only those face normals that lie within the
 * threshold of its own face. That keeps creases sharp without needing the
 * modelling package's smoothing groups, which glTF does not carry.
 */
function recompute(position, normal, indices, threshold) {
  const count = indices.getCount();
  const faceNormals = new Float32Array((count / 3) * 3);

  // Vertices at the same point in space, keyed by rounded position.
  const byPoint = new Map();
  const key = (v) => `${round(v[0])},${round(v[1])},${round(v[2])}`;

  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];

  for (let f = 0; f < count / 3; f += 1) {
    const i0 = indices.getScalar(f * 3);
    const i1 = indices.getScalar(f * 3 + 1);
    const i2 = indices.getScalar(f * 3 + 2);

    position.getElement(i0, a);
    position.getElement(i1, b);
    position.getElement(i2, c);

    // Cross product of two edges, left unnormalised: its length is twice the
    // triangle's area, which weights big faces more than slivers. That is what
    // stops a fan of thin triangles from dominating a vertex's normal.
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

    faceNormals[f * 3] = e1[1] * e2[2] - e1[2] * e2[1];
    faceNormals[f * 3 + 1] = e1[2] * e2[0] - e1[0] * e2[2];
    faceNormals[f * 3 + 2] = e1[0] * e2[1] - e1[1] * e2[0];

    for (const [index, vertex] of [[i0, a], [i1, b], [i2, c]]) {
      const k = key(vertex);
      let bucket = byPoint.get(k);
      if (!bucket) byPoint.set(k, (bucket = []));
      bucket.push({ index, face: f });
    }
  }

  const out = [0, 0, 0];
  const own = [0, 0, 0];
  const other = [0, 0, 0];

  for (const bucket of byPoint.values()) {
    for (const { index, face } of bucket) {
      readNormalised(faceNormals, face, own);

      out[0] = 0;
      out[1] = 0;
      out[2] = 0;

      for (const neighbour of bucket) {
        readNormalised(faceNormals, neighbour.face, other);

        const alignment = own[0] * other[0] + own[1] * other[1] + own[2] * other[2];
        if (alignment < threshold) continue; // a crease — do not blend across it

        // Unnormalised again on purpose, for the same area weighting.
        out[0] += faceNormals[neighbour.face * 3];
        out[1] += faceNormals[neighbour.face * 3 + 1];
        out[2] += faceNormals[neighbour.face * 3 + 2];
      }

      normalise(out);
      normal.setElement(index, out);
    }
  }
}

function readNormalised(faceNormals, face, out) {
  out[0] = faceNormals[face * 3];
  out[1] = faceNormals[face * 3 + 1];
  out[2] = faceNormals[face * 3 + 2];
  normalise(out);
}

function normalise(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length === 0) return;
  v[0] /= length;
  v[1] /= length;
  v[2] /= length;
}

/** Snapped so that vertices meant to be the same corner hash to the same key. */
const round = (n) => Math.round(n * 1e5) / 1e5;
