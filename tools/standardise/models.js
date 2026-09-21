#!/usr/bin/env node
/**
 * Station 2 — Standardise.
 *
 *   raw/cow.glb  ──▶  assets/models/cow.glb
 *
 * Nothing enters assets/models except through here. There is no manual copy,
 * because a manual copy is how an unstandardised model gets into a lesson and
 * takes its wrong scale with it forever.
 *
 * Usage:
 *   node tools/standardise.js            every model in raw/
 *   node tools/standardise.js cow hen    just these
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §3 Station 2.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { dedup, draco, flatten, join, metalRough, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { readSidecar, SidecarError } from '../lib/sidecar.js';
import { readDocument, writeDocument } from '../lib/gltf-io.js';
import { applyContract, ContractError } from '../lib/contract.js';
import { holdInPlace, keepOnlyClips } from '../lib/clips.js';
import { normaliseMaterials } from '../lib/materials.js';
import { smoothNormals } from '../lib/normals.js';
import { dropNodes } from '../lib/subset.js';
import { measure } from '../lib/measure.js';
import { MODELS_DIR, RAW_DIR, relative, shippedModel } from '../lib/paths.js';

/** Textures are capped so a lesson bundle stays inside its 40 MB budget. */
const MAX_TEXTURE_EDGE = 1024;

async function main() {
  const requested = process.argv.slice(2);
  const ids = requested.length ? requested : await listRawIds();

  if (!ids.length) {
    console.log(`Nothing in ${relative(RAW_DIR)}. Download a model and write its sidecar first.`);
    return;
  }

  await fs.mkdir(MODELS_DIR, { recursive: true });

  let failed = 0;

  for (const id of ids) {
    try {
      const result = await standardise(id);
      console.log(
        `  ✓ ${id.padEnd(10)} ${result.height.toFixed(2)} m  ` +
          `${String(result.triangles).padStart(6)} tris  ` +
          `${(result.bytes / 1024).toFixed(0)} KB  ` +
          `${result.clips.length ? result.clips.length + ' clips' : 'static'}` +
          `${result.droppedClips ? ` (−${result.droppedClips} unused)` : ''}` +
          `${result.recoloured ? `  🎨 ${result.recoloured}` : ''}` +
          `${result.smoothed ? `  ◍ smoothed` : ''}` +
          `${result.droppedNodes ? `  ✂ ${result.droppedNodes}` : ''}` +
          `${result.masked ? `  ▨ alpha-tested` : ''}`
      );
    } catch (err) {
      failed += 1;
      const code = err.code ?? 'ERROR';
      console.error(`  ✗ ${id.padEnd(10)} [${code}] ${err.message}`);
    }
  }

  console.log();
  if (failed) {
    console.error(`${failed} of ${ids.length} failed. Nothing partial was written.`);
    process.exitCode = 1;
  } else {
    console.log(`${ids.length} model(s) standardised. Next: npm run content:library`);
  }
}

/**
 * Put one model on the contract and compress it.
 *
 * Order matters. The contract is applied to uncompressed geometry so the
 * bounding box is exact; Draco runs last so nothing measures a lossy mesh.
 */
async function standardise(id) {
  const sidecar = await readSidecar(id);
  const source = await findRawFile(id);

  const document = await readDocument(source);

  // Before anything is measured or decimated: a pack may contain more than one
  // thing, and the parts we are not keeping must not influence the bounding
  // box the contract is about to scale by.
  const subset = dropNodes(document, sidecar.dropNodes);

  // Photoscanned assets arrive at film resolution — one tree can be 1.6 million
  // triangles against a whole-scene budget of 150,000. Simplifying is what
  // makes them usable at all, and it has to happen before compression so the
  // decimator is working on real geometry.
  //
  // `lockBorder` stays off deliberately: a tree's leaves are thousands of
  // separate cards, so locking every border leaves nothing to collapse and the
  // reduction stalls at 40% instead of reaching 1%.
  if (sidecar.simplify) {
    await MeshoptSimplifier.ready;
    await document.transform(
      weld({ tolerance: sidecar.weldTolerance }),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: sidecar.simplify,
        error: sidecar.simplifyError,
        lockBorder: false,
      })
    );
  }

  // Contract LAST of the geometry passes, because simplifying moves vertices:
  // scaling to 6.5 m and then decimating leaves a 6.44 m tree, and the library
  // would then record a height the contract says is wrong. Decimate, then
  // measure, then scale.
  applyContract(document, sidecar);

  // Before compression: unused clips are pure weight, and Draco does not
  // touch keyframe data.
  const clips = await keepOnlyClips(document, sidecar.keepClips);
  holdInPlace(document, sidecar.inPlace);

  // Flat-shaded models show every triangle on what should be a curved flank.
  // Smoothing runs after simplify, so it is smoothing the geometry that
  // actually ships rather than geometry the decimator is about to change.
  const smoothed = sidecar.smoothAngle
    ? smoothNormals(document, { angle: sidecar.smoothAngle })
    : { primitives: 0 };

  // Older Sketchfab exports describe their surfaces with specular/glossiness,
  // an extension three.js no longer reads. Nothing errors: the model simply
  // loads with no colour at all, a white plaster cast of a bear. Convert it to
  // the metal/rough model everything else uses, textures and all.
  if (document.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')) {
    await document.transform(metalRough());
  }

  // Different sources disagree about PBR defaults and about palette; the art
  // style does not. Both are settled here, once, rather than per lesson.
  const materials = normaliseMaterials(document, sidecar);

  // A fire engine arrives as 122 separate meshes — every ladder rung its own
  // object — and each one is a draw call the headset pays for every frame. A
  // model that does not move has no use for that structure: collapse the node
  // tree, fold identical materials together, and join whatever then shares
  // one. The fire engine comes out as seven. Opt-in (`join` in the sidecar),
  // because a rigged animal's node tree is what its animation plays on.
  if (sidecar.join) {
    await document.transform(dedup(), flatten(), join({ keepNamed: false }));
  }

  await document.transform(
    // Drop anything the file carries but no longer references.
    prune(),
    // Cap texture size AND re-encode. Both matter, and the second is the one
    // that is easy to forget: a photoscan or a Sketchfab export ships PNGs,
    // and a 1024px PNG is several times the size of the same image as WebP.
    // The horse arrived with eight of them — 12.8 MB of a 40 MB lesson budget
    // spent on one animal, before any resizing was even at fault.
    //
    // WebP rather than JPEG because it keeps alpha, which leaf cards and
    // cut-out textures need.
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      quality: 84,
      resize: [MAX_TEXTURE_EDGE, MAX_TEXTURE_EDGE],
      resizeFilter: 'lanczos3',
    }),
    // Geometry compression. Needs the decoder vendored in app/lib at runtime.
    draco()
  );

  const target = shippedModel(id);
  await writeDocument(document, target);

  // Measure what was actually written, not what we intended to write.
  const written = await readDocument(target);
  const stats = measure(written);

  if (stats.textureEdge > MAX_TEXTURE_EDGE) {
    await fs.rm(target, { force: true });
    throw new ContractError(
      'STD_TEXTURE',
      `A texture is still ${stats.textureEdge}px on its long edge after resizing.`
    );
  }

  const { size } = await fs.stat(target);
  return {
    ...stats,
    bytes: size,
    droppedClips: clips.dropped.length,
    recoloured: materials.recoloured.length,
    masked: materials.masked,
    smoothed: smoothed.primitives,
    droppedNodes: subset.dropped.length,
  };
}

/**
 * Find the model file for an id.
 *
 * Two layouts, because sources disagree. A self-contained pack drops one file
 * — `raw/cow.glb`. A photoscan or a Sketchfab export arrives as a folder: a
 * `.gltf` next to its `.bin` and a `textures/` directory, all referenced by
 * relative path. That folder cannot be flattened or symlinked without breaking
 * those paths, so it is read where it lies: `raw/cow/scene.gltf`.
 */
async function findRawFile(id) {
  for (const ext of ['.glb', '.gltf']) {
    const candidate = path.join(RAW_DIR, `${id}${ext}`);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try the next extension */
    }
  }

  const bundle = path.join(RAW_DIR, id);
  const entries = await fs.readdir(bundle).catch(() => []);
  const model = entries.find((f) => f.endsWith('.gltf') || f.endsWith('.glb'));
  if (model) return path.join(bundle, model);

  throw new SidecarError(
    'LIB_STALE',
    `No ${id}.glb, ${id}.gltf, or ${id}/ bundle in ${relative(RAW_DIR)}.`
  );
}

async function listRawIds() {
  const entries = await fs.readdir(RAW_DIR).catch(() => []);

  const ids = new Set();

  for (const entry of entries) {
    // A sidecar is the one thing every model has, in either layout, so it is
    // what defines the set — not the model file, whose name and place vary.
    if (entry.endsWith('.meta.json')) ids.add(entry.replace('.meta.json', ''));
  }

  return [...ids].sort();
}

await main();
