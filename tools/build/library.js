#!/usr/bin/env node
/**
 * Station 3 — Generate the library manifest.
 *
 *   assets/models/*.glb  ──▶  assets/library.json
 *
 * Everything a human could get wrong is measured from the files themselves.
 * Only `source` and `licence` come from a human, and those come from the
 * sidecar written once at intake. A hand-written catalogue drifts from disk
 * within a month and then lies; a measured one cannot.
 *
 * This file is never hand-edited. If it is wrong, the fix is in the model or
 * in the sidecar, not here.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §12.2.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { readSidecar } from '../lib/sidecar.js';
import { readDocument } from '../lib/gltf-io.js';
import { measure } from '../lib/measure.js';
import {
  ASSETS_DIR,
  AUDIO_DIR,
  HDRI_DIR,
  LIBRARY_FILE,
  MODELS_DIR,
  RAW_DIR,
  SFX_DIR,
  TEXTURES_DIR,
  relative,
} from '../lib/paths.js';

async function main() {
  const [models, textures, planets, hdri, sfx, audio] = await Promise.all([
    catalogueModels(),
    catalogueFiles(TEXTURES_DIR, path.join(RAW_DIR, 'textures')),
    // Planet maps. Half a megabyte that an offline install has to carry, so
    // the download budget has to be able to see them.
    catalogueFiles(path.join(ASSETS_DIR, 'planets'), path.join(RAW_DIR, 'planets')),
    catalogueFiles(HDRI_DIR, path.join(RAW_DIR, 'hdri')),
    catalogueFiles(SFX_DIR, path.join(RAW_DIR, 'sfx')),
    catalogueAudio(),
  ]);

  const library = {
    generated: new Date().toISOString(),
    models,
    textures,
    planets,
    hdri,
    sfx,
    audio,
  };

  await writeAtomically(LIBRARY_FILE, JSON.stringify(library, null, 2) + '\n');

  const languages = Object.keys(audio);
  console.log(
    `${relative(LIBRARY_FILE)}\n` +
      `  ${Object.keys(models).length} models · ` +
      `${Object.keys(textures).length} textures · ` +
      `${Object.keys(planets).length} planet maps · ` +
      `${languages.length ? languages.join(', ') : 'no'} audio`
  );
}

/**
 * One record per shipped model: measured geometry, plus the licence facts the
 * sidecar carries.
 */
async function catalogueModels() {
  const files = await listFiles(MODELS_DIR, '.glb');
  const models = {};

  for (const file of files) {
    const id = path.basename(file, '.glb');

    // A model with no sidecar has no recorded licence, and a build we cannot
    // licence-audit is a build we cannot ship.
    const sidecar = await readSidecar(id);

    const document = await readDocument(file);
    const stats = measure(document);
    const { size } = await fs.stat(file);

    models[id] = {
      file: relativeToAssets(file),
      height: stats.height,
      width: stats.width,
      depth: stats.depth,
      triangles: stats.triangles,
      meshes: stats.meshes,
      bytes: size,
      clips: stats.clips,
      rigged: stats.clips.length > 0,
      source: sidecar.source,
      licence: sidecar.licence,
    };
  }

  return sortKeys(models);
}

/**
 * Textures, skies and any other flat asset folder.
 *
 * Licence comes from a sidecar in the matching raw folder, keyed by the part
 * of the filename before the first underscore — `grass_normal.jpg` and
 * `grass_color.jpg` are both covered by `raw/textures/grass.meta.json`,
 * because they came out of one download under one licence.
 *
 * Without this the credits generator reports them as unlicensed, which is the
 * correct thing for it to do and the wrong state to leave the build in.
 */
async function catalogueFiles(dir, rawDir) {
  const files = await listFiles(dir);
  const sidecars = await readSidecars(rawDir);
  const records = {};

  for (const file of files) {
    const { size } = await fs.stat(file);
    const name = path.basename(file);
    const stem = name.split('.')[0].split('_')[0];
    const sidecar = sidecars[stem];

    records[name] = {
      file: relativeToAssets(file),
      bytes: size,
      ...(sidecar ? { source: sidecar.source, licence: sidecar.licence } : {}),
    };
  }

  return sortKeys(records);
}

/** Every `*.meta.json` in a raw folder, keyed by id. */
async function readSidecars(dir) {
  if (!dir) return {};

  const entries = await fs.readdir(dir).catch(() => []);
  const sidecars = {};

  for (const entry of entries) {
    if (!entry.endsWith('.meta.json')) continue;
    const data = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf8'));
    sidecars[entry.replace('.meta.json', '')] = data;
  }

  return sidecars;
}

/** Audio is nested one level deeper, because language is a folder. */
async function catalogueAudio() {
  const languages = await fs.readdir(AUDIO_DIR, { withFileTypes: true }).catch(() => []);
  const byLanguage = {};

  for (const entry of languages) {
    if (!entry.isDirectory()) continue;
    byLanguage[entry.name] = await catalogueFiles(path.join(AUDIO_DIR, entry.name));  // generated here, no sidecar
  }

  return sortKeys(byLanguage);
}

async function listFiles(dir, ext) {
  const entries = await fs.readdir(dir).catch(() => []);

  return entries
    .filter((f) => !f.startsWith('.') && (!ext || f.endsWith(ext)))
    .map((f) => path.join(dir, f))
    .sort();
}

/** Paths in the manifest are relative to /assets, which is what the app fetches. */
const relativeToAssets = (abs) => path.relative(ASSETS_DIR, abs).split(path.sep).join('/');

/** Stable key order, so a regenerated library produces a clean diff. */
const sortKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Write to a temporary file and rename.
 *
 * A half-written library is worse than none: the validator would read it and
 * report confident nonsense about which models exist.
 */
async function writeAtomically(file, contents) {
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, contents, 'utf8');
  await fs.rename(temp, file);
}

await main();
