#!/usr/bin/env node
/**
 * Station 1 helper — planet maps from Solar System Scope.
 *
 * The one case in this project where a photograph beats anything we could
 * build. A planet is a sphere; what makes it Jupiter rather than a beige ball
 * is the banding, and that is a picture. These are the standard set, derived
 * from NASA elevation and imagery and published under CC BY 4.0 — which this
 * programme may ship, provided it credits them, which `build-credits` does
 * from the sidecars written here.
 *
 * No key, unlike Sketchfab. But the same rule applies: the licence and the
 * source are recorded at the moment of download, because an asset whose
 * provenance was not written down at intake is an asset nobody can clear
 * later.
 *
 * Each map is stored twice over: the original in `raw/planets/` as the audit
 * copy, and a 1024-wide WebP in `app/assets/planets/` as the thing that ships.
 * A 2048×1024 JPEG is 460 KB and eight of them would be most of the app; at
 * 1024 in WebP the whole set is under a megabyte, and on a sphere half a metre
 * across nobody can tell.
 *
 * Usage:
 *   node tools/fetch-planets.js
 *   node tools/fetch-planets.js --force
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { APP_DIR, RAW_DIR, relative } from '../lib/paths.js';

const BASE = 'https://www.solarsystemscope.com/textures/download';
const CREDIT = 'Solar System Scope — solarsystemscope.com/textures';
const LICENCE = 'CC-BY';
const PAGE = 'https://www.solarsystemscope.com/textures/';

/**
 * What to fetch, and how wide it ships.
 *
 * The Milky Way plate is the scene's backdrop and is the one that has to stay
 * large — it wraps the entire sky, so every pixel is stretched across a whole
 * hemisphere. The planets are seen as spheres a fraction of a metre across.
 */
const MAPS = [
  { id: 'sun', file: '2k_sun.jpg', width: 1024 },
  { id: 'mercury', file: '2k_mercury.jpg', width: 1024 },
  { id: 'venus', file: '2k_venus_surface.jpg', width: 1024 },
  { id: 'earth', file: '2k_earth_daymap.jpg', width: 1024 },
  { id: 'moon', file: '2k_moon.jpg', width: 512 },
  { id: 'mars', file: '2k_mars.jpg', width: 1024 },
  { id: 'jupiter', file: '2k_jupiter.jpg', width: 1024 },
  { id: 'saturn', file: '2k_saturn.jpg', width: 1024 },
  // The rings carry their own transparency, so this one stays a PNG.
  { id: 'saturn-ring', file: '2k_saturn_ring_alpha.png', width: 512, alpha: true },
  { id: 'uranus', file: '2k_uranus.jpg', width: 1024 },
  { id: 'neptune', file: '2k_neptune.jpg', width: 1024 },
  { id: 'stars', file: '2k_stars_milky_way.jpg', width: 2048 },
];

async function main() {
  const force = process.argv.includes('--force');

  const rawDir = path.join(RAW_DIR, 'planets');
  const outDir = path.join(APP_DIR, 'assets', 'planets');

  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  let fetched = 0;

  for (const map of MAPS) {
    const original = path.join(rawDir, map.file);
    const shipped = path.join(outDir, `${map.id}.webp`);

    if (!force && (await exists(original))) {
      console.log(`  · ${map.id} (already there)`);
    } else {
      const response = await fetch(`${BASE}/${map.file}`);
      if (!response.ok) throw new Error(`${map.file} → ${response.status}`);

      await fs.writeFile(original, Buffer.from(await response.arrayBuffer()));
      fetched += 1;
    }

    // Equirectangular maps are always 2:1 — a sphere's UVs wrap 360° across
    // and 180° down. The ring plate is not a sphere map and keeps its own
    // proportions, and its alpha channel is why it is not flattened.
    const image = sharp(original);
    await (map.alpha
      ? image.resize(map.width).webp({ quality: 88, alphaQuality: 100 })
      : image.resize(map.width, map.width / 2, { fit: 'fill' }).webp({ quality: 82 })
    ).toFile(shipped);

    await fs.writeFile(
      path.join(rawDir, `${map.id}.meta.json`),
      JSON.stringify(
        {
          id: `planet-${map.id}`,
          source: `${CREDIT} — ${map.file}`,
          licence: LICENCE,
          url: PAGE,
          maps: ['color'],
          notes: 'equirectangular colour map; ships as WebP in app/assets/planets/',
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const { size } = await fs.stat(shipped);
    console.log(`  ✓ ${map.id.padEnd(9)} ${map.width}px  ${(size / 1024).toFixed(0)} KB  ${LICENCE}`);
  }

  console.log(
    `\n${MAPS.length} map(s) in ${relative(outDir)} (${fetched} newly downloaded). ` +
      `Credit is generated from the sidecars — run npm run content:credits.`
  );
}

async function exists(file) {
  return fs.access(file).then(
    () => true,
    () => false
  );
}

try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
}
