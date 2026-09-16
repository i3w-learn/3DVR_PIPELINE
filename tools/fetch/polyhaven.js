#!/usr/bin/env node
/**
 * Station 1 helper — pull a model or an HDRI from Poly Haven.
 *
 * No key needed, and everything is CC0. What it does need is care: a Poly
 * Haven model is a `.gltf` plus a `.bin` plus a folder of textures, all wired
 * by relative path, and **the resolution folder the `.bin` lives in varies per
 * asset** — 4k for one, 8k for the next. Guessing it gives a 94-byte file and
 * a model that fails to parse with a message about typed array length.
 *
 * The API lists every included file explicitly, so this asks rather than
 * guesses. It also writes the sidecar, because an asset whose source and
 * licence were not recorded at download is one nobody can credit later.
 *
 * Usage:
 *   node tools/fetch-polyhaven.js <slug> <id> <targetHeight> [--res 1k]
 *   node tools/fetch-polyhaven.js --hdri <slug> <id> [--res 2k]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { RAW_DIR, relative } from '../lib/paths.js';

const API = 'https://api.polyhaven.com';

async function main() {
  const args = process.argv.slice(2);
  const isHdri = args[0] === '--hdri';
  const [slug, id, height] = isHdri ? args.slice(1) : args;
  const res = flag(args, '--res') ?? (isHdri ? '2k' : '1k');

  if (!slug || !id) {
    console.error(
      'Usage: node tools/fetch-polyhaven.js <slug> <id> <targetHeight> [--res 1k]\n' +
        '       node tools/fetch-polyhaven.js --hdri <slug> <id> [--res 2k]'
    );
    process.exitCode = 1;
    return;
  }

  const info = await json(`${API}/info/${slug}`);
  const files = await json(`${API}/files/${slug}`);

  const credit = {
    id,
    source: `Poly Haven — ${info.name}`,
    licence: 'CC0',
    url: `https://polyhaven.com/a/${slug}`,
  };

  if (isHdri) {
    const url = files.hdri?.[res]?.hdr?.url;
    if (!url) throw new Error(`No ${res} HDR for ${slug}. Have: ${Object.keys(files.hdri ?? {})}`);

    await fs.mkdir(path.join(RAW_DIR, 'hdri'), { recursive: true });
    await download(url, path.join(RAW_DIR, 'hdri', `${id}.hdr`));
    await writeSidecar(path.join(RAW_DIR, 'hdri', `${id}.meta.json`), { ...credit, exposure: 1 });

    console.log(`  ✓ ${id.padEnd(12)} ${info.name.slice(0, 34).padEnd(36)} sky, ${res}`);
    console.log(`    → next: npm run content:hdri ${id}`);
    return;
  }

  const entry = files.gltf?.[res]?.gltf;
  if (!entry) throw new Error(`No ${res} glTF for ${slug}. Have: ${Object.keys(files.gltf ?? {})}`);

  const target = path.join(RAW_DIR, id);
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });

  await download(entry.url, path.join(target, path.basename(entry.url)));

  // The include list is keyed by the path the .gltf refers to, so writing each
  // file at its key preserves the wiring exactly as the model expects it.
  for (const [rel, file] of Object.entries(entry.include ?? {})) {
    const to = path.join(target, rel);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await download(file.url, to);
  }

  await writeSidecar(path.join(RAW_DIR, `${id}.meta.json`), {
    ...credit,
    targetHeight: Number(height) || 1,
    yaw: 0,
    alphaMode: 'mask',
  });

  const bytes = (await fs.stat(path.join(target, path.basename(entry.url)))).size;
  console.log(
    `  ✓ ${id.padEnd(12)} ${info.name.slice(0, 34).padEnd(36)} CC0  ` +
      `${Object.keys(entry.include ?? {}).length + 1} files`
  );
  console.log(`    → ${relative(target)}/  ·  next: npm run content:std ${id}`);
}

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json();
}

async function download(url, to) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  await fs.writeFile(to, Buffer.from(await response.arrayBuffer()));
}

const writeSidecar = (to, data) =>
  fs.writeFile(to, JSON.stringify(data, null, 2) + '\n', 'utf8');

function flag(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}

try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
}
