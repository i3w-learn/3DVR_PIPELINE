/**
 * Sidecars — the only facts about a model a human is allowed to supply.
 *
 * Everything else in library.json is measured from the file itself, so it
 * cannot drift. These four or five fields cannot be measured, so they are
 * written once, next to the download, and never again.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §12.1.
 */

import fs from 'node:fs/promises';
import { rawSidecar, relative } from './paths.js';

/** Licences we may ship to a funded government programme. */
const ALLOWED_LICENCES = new Set(['CC0', 'CC-BY']);

/** Model ids are lowercase, one word — `cow`, never `Cow_Final_v3`. */
const ID_PATTERN = /^[a-z][a-z0-9]*$/;

export class SidecarError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Read and validate the sidecar for one model id.
 *
 * @param {string} id  model id — must match the raw filename stem
 * @returns {Promise<{id, source, licence, url, targetHeight, yaw, notes}>}
 */
export async function readSidecar(id) {
  const file = rawSidecar(id);

  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new SidecarError(
      'LIB_STALE',
      `No sidecar at ${relative(file)}. Every raw download needs one.`
    );
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new SidecarError('LIB_STALE', `${relative(file)} is not valid JSON: ${err.message}`);
  }

  // The id in the file and the id in the filename must agree, or the library
  // will confidently attribute one model's licence to another.
  if (data.id !== id) {
    throw new SidecarError(
      'LIB_STALE',
      `${relative(file)} declares id "${data.id}" but the filename says "${id}".`
    );
  }

  if (!ID_PATTERN.test(id)) {
    throw new SidecarError(
      'LIB_STALE',
      `Model id "${id}" must be lowercase and one word — cow, not Cow_Final_v3.`
    );
  }

  if (!data.licence) {
    throw new SidecarError('INTAKE_LICENCE', `${relative(file)} has no licence.`);
  }

  // CC-BY-NC is non-commercial and does not cover delivery to a funded
  // programme. Rejected at intake rather than discovered at audit.
  if (!ALLOWED_LICENCES.has(data.licence)) {
    throw new SidecarError(
      'INTAKE_LICENCE',
      `Licence "${data.licence}" on ${id} cannot ship. Allowed: ${[...ALLOWED_LICENCES].join(', ')}.`
    );
  }

  if (typeof data.targetHeight !== 'number' || data.targetHeight <= 0) {
    throw new SidecarError(
      'STD_CONTRACT',
      `${relative(file)} needs a targetHeight in metres — a cow is about 1.5, a hen about 0.4.`
    );
  }

  return {
    id,
    source: data.source ?? 'unknown',
    licence: data.licence,
    url: data.url ?? '',
    targetHeight: data.targetHeight,
    // How far to turn the model so it faces +Z. Not measurable — a human looks
    // at it once and writes the number down.
    yaw: data.yaw ?? 0,
    // Clips a lesson will actually play. Everything else is dropped, which is
    // the difference between a 1.6 MB cow and a 0.3 MB one. null keeps all.
    keepClips: Array.isArray(data.keepClips) ? data.keepClips : null,
    // Which dimension `targetHeight` refers to. "height" for anything that
    // stands up; "longest" for anything that lies flat, like a boulder.
    fit: data.fit === 'longest' ? 'longest' : 'height',
    // Opt out of the flat, non-metal art style. Almost nothing should.
    metallic: data.metallic === true,
    // "mask" turns blended cut-outs (leaves, grass cards) into alpha-tested
    // ones: cheaper, sorted-free, and they cast shadows properly.
    alphaMode: data.alphaMode === 'mask' ? 'mask' : null,
    // Node names to remove — a pack that ships more than we want.
    dropNodes: Array.isArray(data.dropNodes) ? data.dropNodes : null,
    /** Collapse a static model's many meshes into one per material. */
    join: data.join === true,
    inPlace: Array.isArray(data.inPlace) ? data.inPlace : null,
    // Material name → #rrggbb, to bring a pack into the house palette.
    palette: data.palette && typeof data.palette === 'object' ? data.palette : null,
    // Fraction of triangles to keep. A photoscanned tree arrives at 1.6
    // million; the whole scene's budget is 150,000. null leaves it alone.
    simplify: typeof data.simplify === 'number' ? data.simplify : null,
    /** How much shape error to accept while simplifying, as a fraction of size. */
    simplifyError: typeof data.simplifyError === 'number' ? data.simplifyError : 0.08,
    /**
     * How far apart two vertices may be and still be treated as one, before
     * simplifying.
     *
     * A decimator collapses edges, and it can only collapse an edge that two
     * triangles share. A model exported with split normals or split UVs has no
     * shared edges at all — every triangle is an island — so the reduction
     * simply does not happen. A sculpted figure arrived at 170,000 triangles
     * and came out at 131,000 with the ratio set to 6%, which is what this
     * exists to fix.
     *
     * Raising it merges vertices that are close but not identical. Too high
     * and detail is welded shut; 0.0001 is safe for anything modelled to
     * scale, and a figure tolerates 0.001.
     */
    weldTolerance: typeof data.weldTolerance === 'number' ? data.weldTolerance : 0.0001,
    // Angle in degrees below which neighbouring faces share a normal. Higher
    // is smoother; 0 turns smoothing off and keeps the model flat-shaded.
    smoothAngle: typeof data.smoothAngle === 'number' ? data.smoothAngle : 0,
    notes: data.notes ?? '',
  };
}
