#!/usr/bin/env node
/**
 * Station 1, before the download — find a realistic model to download.
 *
 * Sketchfab's search matches names, and a name is not a thing: "Ladybug
 * Bikini" is the top hit for ladybird, "Cobra Staff" for cobra, a surfboard
 * for tabla. Picking from a list of names put the wrong thing in the lesson
 * more than once. Picking from pictures did not.
 *
 * So this asks Sketchfab for free, downloadable, CC-BY or CC0 models under a
 * face limit, and lays their thumbnails out on one sheet per object, numbered.
 * A person looks at the sheet, chooses a number, and copies the download
 * command printed beside it. That is the whole method: eyes before download.
 *
 * Usage:
 *   node --env-file=.env tools/fetch/find.js "soccerball=soccer ball" "tabla=tabla drum"
 *   MAX_FACES=120000 node --env-file=.env tools/fetch/find.js "barn=old wooden barn"
 *
 * The left of the "=" is the id the model will have; the right is what to
 * search for. Sheets land in `.work/find/<id>.jpg`, which git ignores. A
 * SKETCHFAB_TOKEN in `.env` is not required to search, only to download.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import { ROOT, relative } from '../lib/paths.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const API = 'https://api.sketchfab.com/v3/search';
const OUT = path.join(ROOT, '.work', 'find');

/** Above this a model is too heavy for a headset lesson without thinning. */
const MAX_FACES = Number(process.env.MAX_FACES ?? 60000);
/** How many candidates go on a sheet: three rows of four. */
const PER_SHEET = 12;
const COLS = 4;
const TILE = { width: 300, height: 200, label: 46 };

/** The label is drawn as SVG, and its text renderer crashes on non-ASCII. */
const ascii = (text) => String(text ?? '').replace(/[^\x20-\x7E]/g, '').replace(/[<>&]/g, '');

async function search(query, licence) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    type: 'models',
    q: query,
    downloadable: 'true',
    license: licence,
    max_face_count: String(MAX_FACES),
    sort_by: '-likeCount',
    count: '24',
  });

  const token = process.env.SKETCHFAB_TOKEN;
  const response = await fetch(url, { headers: token ? { Authorization: `Token ${token}` } : {} });
  if (!response.ok) throw new Error(`Sketchfab answered ${response.status} for "${query}".`);

  return (await response.json()).results ?? [];
}

async function thumbnail(model) {
  const images = (model.thumbnails?.images ?? []).filter((image) => image.width >= 256).sort((a, b) => a.width - b.width);
  const chosen = images[0] ?? model.thumbnails?.images?.[0];

  try {
    const bytes = Buffer.from(await (await fetch(chosen.url)).arrayBuffer());
    return sharp(bytes).resize(TILE.width, TILE.height, { fit: 'cover' }).toBuffer();
  } catch {
    // A missing picture is a grey tile, not a missing sheet.
    return sharp({ create: { width: TILE.width, height: TILE.height, channels: 3, background: '#333' } }).png().toBuffer();
  }
}

function label(index, model) {
  const faces = (model.faceCount ?? 0).toLocaleString('en-IN');
  const moves = model.animationCount > 0 ? ' - moves' : '';
  return Buffer.from(
    `<svg width="${TILE.width}" height="${TILE.label}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#111"/>` +
      `<text x="6" y="18" font-family="Helvetica" font-size="14" font-weight="700" fill="#fff">${index}. ${ascii(model.name).slice(0, 34)}</text>` +
      `<text x="6" y="37" font-family="Helvetica" font-size="12" fill="#bbb">${faces} faces${moves} - ${ascii(model.user?.displayName).slice(0, 18)}</text>` +
      `</svg>`
  );
}

async function sheet(id, hits) {
  const tiles = [];
  for (const [i, model] of hits.entries()) {
    const left = (i % COLS) * TILE.width;
    const top = Math.floor(i / COLS) * (TILE.height + TILE.label);
    tiles.push({ input: await thumbnail(model), left, top });
    tiles.push({ input: label(i + 1, model), left, top: top + TILE.height });
  }

  const rows = Math.max(1, Math.ceil(hits.length / COLS));
  const file = path.join(OUT, `${id}.jpg`);
  await sharp({ create: { width: COLS * TILE.width, height: rows * (TILE.height + TILE.label), channels: 3, background: '#000' } })
    .composite(tiles)
    .jpeg({ quality: 82 })
    .toFile(file);
  return file;
}

async function main() {
  const wants = process.argv.slice(2).filter((arg) => arg.includes('='));
  if (!wants.length) {
    console.error('Usage: node --env-file=.env tools/fetch/find.js "<id>=<what to search for>" …');
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(OUT, { recursive: true });

  for (const want of wants) {
    const [id, query] = want.split('=').map((s) => s.trim());

    // Both licences this programme may ship, merged; the most liked first.
    const found = [...(await search(query, 'by')), ...(await search(query, 'cc0'))];
    const seen = new Set();
    const hits = found
      .filter((model) => !seen.has(model.uid) && seen.add(model.uid))
      .filter((model) => !model.isAgeRestricted)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, PER_SHEET);

    if (!hits.length) {
      console.log(`\n${id}: nothing free on Sketchfab for "${query}". Try other words, or an AI model (docs/OBJECTS.md).`);
      continue;
    }

    const file = await sheet(id, hits);
    console.log(`\n${id}: ${hits.length} candidate(s) for "${query}" → ${relative(file)}`);
    for (const [i, model] of hits.entries()) {
      const licence = model.license?.slug === 'cc0' ? 'CC0  ' : 'CC-BY';
      const moves = model.animationCount > 0 ? 'moves' : '     ';
      console.log(
        `  ${String(i + 1).padStart(2)}. ${licence} ${String(model.faceCount ?? 0).padStart(7)} faces ${moves}  ${model.name.slice(0, 40).padEnd(40)}` +
          `  node --env-file=.env tools/fetch/sketchfab.js ${model.uid} ${id} <height>`
      );
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
