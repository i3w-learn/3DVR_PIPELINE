#!/usr/bin/env node
/**
 * Station 2b — Standardise textures.
 *
 *   raw/textures/grass_color.jpg  ──▶  app/assets/textures/grass_color.jpg
 *
 * A ground is not one image. A surface that reads as real needs at least three
 * maps: colour, a normal map so the light catches the blades instead of a flat
 * sheet, and roughness so it is not uniformly shiny. Ambient occlusion adds the
 * darkening between blades.
 *
 * The single flat colour image the first pass shipped is exactly why a scene
 * reads as a children's game: no surface detail at all, at any distance.
 *
 * Same contract as models — everything capped, everything measured, licence
 * recorded in a sidecar. Nothing is hand-copied into app/assets/textures.
 *
 * Usage:
 *   node tools/standardise-textures.js
 *   node tools/standardise-textures.js grass
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { RAW_DIR, TEXTURES_DIR, relative } from '../lib/paths.js';

const RAW_TEXTURES = path.join(RAW_DIR, 'textures');

/**
 * Per-map budget.
 *
 * Colour carries the detail a child looks at, so it keeps 1024. The other maps
 * are consumed by the shader rather than the eye and halve with no visible
 * loss — which matters, because three maps at full size is three times the
 * download for one plane.
 *
 * `grey: true` drops two channels the shader never reads.
 */
const MAPS = {
  color: { size: 1024, quality: 82, grey: false },
  normal: { size: 1024, quality: 88, grey: false }, // banding here shows as faceting
  rough: { size: 512, quality: 78, grey: true },
  ao: { size: 512, quality: 78, grey: true },
};

async function main() {
  const requested = process.argv.slice(2);
  const ids = requested.length ? requested : await listIds();

  if (!ids.length) {
    console.log(`Nothing in ${relative(RAW_TEXTURES)}.`);
    return;
  }

  await fs.mkdir(TEXTURES_DIR, { recursive: true });

  for (const id of ids) {
    const sidecar = await readSidecar(id);

    for (const map of sidecar.maps) {
      const spec = MAPS[map];
      if (!spec) throw new Error(`Unknown map type "${map}" on ${id}. Known: ${Object.keys(MAPS).join(', ')}`);

      const source = path.join(RAW_TEXTURES, `${id}_${map}.jpg`);
      const target = path.join(TEXTURES_DIR, `${id}_${map}.jpg`);

      let pipeline = sharp(source).resize(spec.size, spec.size, { fit: 'cover' });
      if (spec.grey) pipeline = pipeline.greyscale();

      await pipeline.jpeg({ quality: spec.quality, mozjpeg: true }).toFile(target);

      const { size } = await fs.stat(target);
      console.log(`  ✓ ${id}_${map}`.padEnd(22) + `${spec.size}px  ${(size / 1024).toFixed(0)} KB`);
    }
  }

  console.log(`\nDone. Next: npm run content:library`);
}

async function readSidecar(id) {
  const file = path.join(RAW_TEXTURES, `${id}.meta.json`);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));

  if (data.licence !== 'CC0' && data.licence !== 'CC-BY') {
    throw new Error(`${relative(file)}: licence "${data.licence}" cannot ship.`);
  }

  return { ...data, maps: data.maps ?? ['color'] };
}

async function listIds() {
  const entries = await fs.readdir(RAW_TEXTURES).catch(() => []);
  return entries.filter((f) => f.endsWith('.meta.json')).map((f) => f.replace('.meta.json', ''));
}

await main();
