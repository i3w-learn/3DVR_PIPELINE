#!/usr/bin/env node
/**
 * Station 1 helper — pull a model into `raw/` from Sketchfab.
 *
 * Sketchfab is the only source in the stack with rigged, textured animals
 * under a licence this programme can ship. It is also the only one that needs
 * a key, and its download URLs expire five minutes after they are issued —
 * so this is a script rather than a wiki page of curl commands.
 *
 * It writes the sidecar too. That matters more than the convenience: an asset
 * whose licence and author were not recorded at the moment of download is an
 * asset nobody can credit later, and CC-BY obliges us to credit it.
 *
 * Needs SKETCHFAB_TOKEN in the environment. Never pass it on the command line
 * — that puts a credential in the shell history.
 *
 * Usage:
 *   SKETCHFAB_TOKEN=… node tools/fetch-sketchfab.js <uid> <id> <targetHeight> [clips…]
 *
 * Example:
 *   node tools/fetch-sketchfab.js b960…f54 realelephant 3.1 Stand_01 Loco_WalkSlow
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { RAW_DIR, relative } from './lib/paths.js';

const run = promisify(execFile);
const API = 'https://api.sketchfab.com/v3/models';

async function main() {
  const [uid, id, height, ...clips] = process.argv.slice(2);

  if (!uid || !id || !height) {
    console.error('Usage: node tools/fetch-sketchfab.js <uid> <id> <targetHeight> [clips…]');
    process.exitCode = 1;
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) throw new Error('SKETCHFAB_TOKEN is not set.');

  const headers = { Authorization: `Token ${token}` };

  const meta = await json(`${API}/${uid}`, headers);
  const licence = normaliseLicence(meta.license?.slug);

  // Refuse before downloading, not after. A non-commercial model in `raw/` is
  // a trap for whoever finds it there later and assumes it was cleared.
  if (!licence) {
    throw new Error(
      `"${meta.name}" is ${meta.license?.label ?? 'unlicensed'} — cannot ship to a funded programme.`
    );
  }

  const download = await json(`${API}/${uid}/download`, headers);
  if (!download.gltf?.url) throw new Error(`No glTF download for ${uid}.`);

  // A Sketchfab export is a bundle: scene.gltf beside its .bin and textures/,
  // wired by relative path. It has to stay a folder.
  const target = path.join(RAW_DIR, id);
  const archive = path.join(RAW_DIR, `${id}.zip`);

  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(archive, Buffer.from(await (await fetch(download.gltf.url)).arrayBuffer()));
  await run('unzip', ['-o', '-q', archive, '-d', target]);
  await fs.rm(archive);

  await fs.writeFile(
    path.join(RAW_DIR, `${id}.meta.json`),
    JSON.stringify(
      {
        id,
        source: `Sketchfab — "${meta.name}" by ${meta.user?.displayName ?? 'unknown'}`,
        licence,
        url: meta.viewerUrl ?? `https://sketchfab.com/3d-models/${uid}`,
        targetHeight: Number(height),
        yaw: 0,
        ...(clips.length ? { keepClips: clips } : {}),
        smoothAngle: 60,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log(
    `  ✓ ${id.padEnd(14)} ${meta.name.slice(0, 34).padEnd(36)} ${licence}  ` +
      `${meta.faceCount?.toLocaleString()} faces  ${meta.animationCount} clips`
  );
  console.log(`    → ${relative(target)}/  ·  next: npm run content:std ${id}`);
}

async function json(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json();
}

/** Sketchfab slugs → the two licences this project may ship. */
function normaliseLicence(slug) {
  if (slug === 'cc0') return 'CC0';
  if (slug === 'by') return 'CC-BY';
  return null; // anything NC, ND or unstated
}

try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
}
