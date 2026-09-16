#!/usr/bin/env node
/**
 * Station 2c — Standardise sky environments.
 *
 *   raw/hdri/field.hdr  ──▶  app/assets/hdri/field.jpg
 *
 * A captured sky does two jobs at once: it is what the child sees overhead,
 * and it is where almost all the light in the scene comes from. Both come off
 * the same image, which is why the backdrop and the lighting can never drift
 * apart.
 *
 * What ships is a tone-mapped equirectangular JPEG, not the .hdr. That keeps a
 * 4 MB float file out of the bundle, keeps a loader out of the app, and keeps
 * the decode off the headset.
 *
 * The honest trade: an LDR sky cannot hold a sun thousands of times brighter
 * than its clouds, so image-based lighting off it is softer than the real
 * thing. The scene's directional light supplies the hard sun and the shadows;
 * the sky supplies everything else.
 *
 * Usage:
 *   node tools/standardise-hdri.js
 *   node tools/standardise-hdri.js field
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { readHdr, toneMap } from '../lib/hdr.js';
import { ASSETS_DIR, RAW_DIR, relative } from '../lib/paths.js';

const RAW_HDRI = path.join(RAW_DIR, 'hdri');
const HDRI_DIR = path.join(ASSETS_DIR, 'hdri');

/**
 * 2048×1024 is the smallest equirect that does not show its pixels when it
 * fills a headset's field of view. The sky is mostly smooth gradient, so JPEG
 * carries it at a quality that would be too low for a texture with detail.
 */
const WIDTH = 2048;
const QUALITY = 86;

async function main() {
  const requested = process.argv.slice(2);
  const ids = requested.length ? requested : await listIds();

  if (!ids.length) {
    console.log(`Nothing in ${relative(RAW_HDRI)}.`);
    return;
  }

  await fs.mkdir(HDRI_DIR, { recursive: true });

  for (const id of ids) {
    const sidecar = await readSidecar(id);
    const source = path.join(RAW_HDRI, `${id}.hdr`);

    const { width, height, data } = await readHdr(source);
    const pixels = toneMap(data, { exposure: sidecar.exposure });

    const target = path.join(HDRI_DIR, `${id}.jpg`);

    await sharp(pixels, { raw: { width, height, channels: 3 } })
      .resize(WIDTH, WIDTH / 2, { fit: 'fill' })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(target);

    const { size } = await fs.stat(target);
    console.log(
      `  ✓ ${id.padEnd(12)} ${width}×${height} HDR → ${WIDTH}×${WIDTH / 2} JPEG  ${(size / 1024).toFixed(0)} KB`
    );
  }

  console.log('\nDone. Next: npm run content:library');
}

async function readSidecar(id) {
  const file = path.join(RAW_HDRI, `${id}.meta.json`);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));

  if (data.licence !== 'CC0' && data.licence !== 'CC-BY') {
    throw new Error(`${relative(file)}: licence "${data.licence}" cannot ship.`);
  }

  // Exposure is the one judgement call: how bright this particular capture
  // should sit before the curve is applied.
  return { ...data, exposure: data.exposure ?? 1 };
}

async function listIds() {
  const entries = await fs.readdir(RAW_HDRI).catch(() => []);
  return entries.filter((f) => f.endsWith('.meta.json')).map((f) => f.replace('.meta.json', ''));
}

await main();
