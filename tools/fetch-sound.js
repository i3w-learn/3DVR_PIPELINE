#!/usr/bin/env node
/**
 * Pull a sound effect into `app/assets/sfx/`.
 *
 * Searches Openverse — Creative Commons' own index — which needs no key and
 * returns a direct audio URL along with the licence and the creator. That last
 * part is why this is a script: a sound whose author was not recorded at the
 * moment of download cannot be credited later, and the credits file is
 * generated from what the library holds.
 *
 * Only CC0 and CC-BY are accepted, same rule as every other asset.
 *
 * Usage:
 *   node tools/fetch-sound.js <id> "<search terms>"
 *   node tools/fetch-sound.js cow "cow moo"
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { ASSETS_DIR, RAW_DIR, relative } from './lib/paths.js';

const run = promisify(execFile);
const API = 'https://api.openverse.org/v1/audio/';
const SFX_DIR = path.join(ASSETS_DIR, 'sfx');
const RAW_SFX = path.join(RAW_DIR, 'sfx');

/**
 * A cue, not a recording session. Long enough for a child to hear the animal,
 * short enough that it does not talk over the narration that follows.
 */
const MAX_SECONDS = 4;

async function main() {
  const [id, ...terms] = process.argv.slice(2);
  const query = terms.join(' ');

  if (!id || !query) {
    console.error('Usage: node tools/fetch-sound.js <id> "<search terms>"');
    process.exitCode = 1;
    return;
  }

  const url = `${API}?q=${encodeURIComponent(query)}&license=cc0,by&page_size=10`;
  const results = (await (await fetch(url)).json()).results ?? [];

  // Prefer something already short: trimming a thirty-second field recording
  // usually catches silence or a car going past.
  const pick =
    results.find((r) => r.duration && r.duration < 8000) ?? results[0];

  if (!pick) throw new Error(`Nothing on Openverse for "${query}".`);
  if (!pick.url) throw new Error(`"${pick.title}" has no direct audio URL.`);

  await fs.mkdir(SFX_DIR, { recursive: true });
  await fs.mkdir(RAW_SFX, { recursive: true });

  const scratch = path.join(os.tmpdir(), `sfx-${process.pid}-${Date.now()}`);
  const target = path.join(SFX_DIR, `${id}.mp3`);

  try {
    await fs.writeFile(scratch, Buffer.from(await (await fetch(pick.url)).arrayBuffer()));

    // Normalise loudness as well as length. Sounds come from different
    // recordings at wildly different levels, and a lesson where the goat is a
    // whisper and the elephant is a shout is a lesson nobody can set a volume
    // for.
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', scratch,
      '-t', String(MAX_SECONDS),
      '-af', 'loudnorm=I=-18:TP=-1.5,afade=t=out:st=' + (MAX_SECONDS - 0.4) + ':d=0.4',
      '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k',
      target,
    ]);
  } finally {
    await fs.rm(scratch, { force: true });
  }

  await fs.writeFile(
    path.join(RAW_SFX, `${id}.meta.json`),
    JSON.stringify(
      {
        id,
        source: `Openverse — "${pick.title}" by ${pick.creator ?? 'unknown'}`,
        licence: pick.license === 'cc0' ? 'CC0' : 'CC-BY',
        url: pick.foreign_landing_url ?? pick.url,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const { size } = await fs.stat(target);
  console.log(
    `  ✓ ${id.padEnd(10)} ${(pick.title ?? '').slice(0, 34).padEnd(36)} ` +
      `${pick.license.toUpperCase().padEnd(4)} ${(size / 1024).toFixed(0)} KB`
  );
}

try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
}
