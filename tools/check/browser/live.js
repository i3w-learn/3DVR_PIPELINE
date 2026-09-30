#!/usr/bin/env node
/**
 * Is the live site the same as `main`?
 *
 * The live site is published from a clean copy of the repository. This asks it
 * for every file of the app that git holds, compares the lessons, lands and
 * code byte for byte with this folder, and follows every short link.
 *
 * It cannot see a file git does NOT hold — `content:check` fails on those.
 *
 * Usage:  npm run content:live      (on `main`, after a deploy)
 */
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

import { ROOT } from '../../lib/paths.js';

const LIVE = process.env.BASE?.replace(/\/$/, '') ?? 'https://i3wvr.web.app';
const files = execSync('git ls-files app', { cwd: ROOT, maxBuffer: 1 << 26 }).toString().trim().split('\n').map((f) => f.replace(/^app\//, ''));
const missing = []; let done = 0; const queue = [...files];
await Promise.all(Array.from({ length: 24 }, async () => {
  while (queue.length) {
    const f = queue.shift();
    let status = 0;
    for (let attempt = 0; attempt < 3 && status !== 200; attempt++) {
      try { status = (await fetch(`${LIVE}/${encodeURI(f)}`, { method: 'HEAD' })).status; } catch { status = -1; }
    }
    if (status !== 200) missing.push(`${status} ${f}`);
    if (++done % 1000 === 0) console.log(`  … ${done} / ${files.length}`);
  }
}));
console.log(`${files.length} files of the app checked on the live site: ${missing.length} missing.`);
for (const m of missing.slice(0, 40)) console.log('  ✗', m);

// does one model and one clip on the live site match this laptop's copy, byte for byte?
const crypto = await import('node:crypto');
let differ = 0; const sample = files.filter((f) => /lessons\/.*\.json$|src\/.*\.js$|stages\/.*\.json$|index\.html$|lands\.(json|html)$/.test(f));
for (const f of sample) {
  const live = Buffer.from(await (await fetch(`${LIVE}/${encodeURI(f)}`)).arrayBuffer());
  const here = await fs.readFile(`${ROOT}/app/${f}`);
  if (crypto.createHash('md5').update(live).digest('hex') !== crypto.createHash('md5').update(here).digest('hex')) { differ++; console.log('  ≠ live differs from main:', f); }
}
console.log(`${sample.length} lesson, land and code files compared with this laptop: ${differ} differ.`);

const index = JSON.parse(await fs.readFile(`${ROOT}/app/lessons/index.json`, 'utf8')).lessons;
const hosting = JSON.parse(await fs.readFile(`${ROOT}/firebase.json`, 'utf8')).hosting;
const lands = JSON.parse(await fs.readFile(`${ROOT}/app/lands.json`, 'utf8')).lands;
let bad = 0;
for (const r of hosting.redirects) {
  const lesson = new URLSearchParams(r.destination.split('?')[1]).get('lesson');
  const res = await fetch(`${LIVE}${r.source}`, { redirect: 'manual' });
  if (!index[lesson] || res.status !== 302) { bad++; console.log(`  ✗ ${r.source} → ${lesson} (${res.status}${index[lesson] ? '' : ', no such lesson'})`); }
}
console.log(`${hosting.redirects.length} short links (/beach, /forest …): ${bad} broken.`);
bad = 0;
for (const l of lands) if (!index[l.lesson]) { bad++; console.log(`  ✗ land ${l.id} → ${l.lesson}: no such lesson`); }
const noLink = lands.filter((l) => !hosting.redirects.some((r) => r.source === `/${l.id}`)).map((l) => l.id);
console.log(`${lands.length} lands in the list: ${bad} point at a missing lesson. Lands with no short link: ${noLink.join(', ') || 'none'}.`);
for (const p of ['/', '/lands', '/vr', '/voices.html']) { const res = await fetch(`${LIVE}${p}`); console.log(`  ${p} → ${res.status}`); }
