#!/usr/bin/env node
/**
 * The attribution file, generated from the library.
 *
 * CC-BY costs nothing but it is not free of obligation: every asset under it
 * has to be credited wherever the work is distributed. Writing that list by
 * hand guarantees it goes stale the first time somebody swaps a model, and a
 * stale credits file is a licence breach rather than an untidy document.
 *
 * So it is generated from `library.json`, which is itself measured from the
 * files on disk. An asset cannot be in the build and missing from the credits.
 *
 * Ships inside the app, because that is where the obligation lands — the APK
 * is what gets distributed, not this repository.
 *
 * Usage: node tools/build-credits.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { DOCS_DIR, LIBRARY_FILE, relative } from '../lib/paths.js';

const CREDITS_FILE = path.join(DOCS_DIR, 'CREDITS.md');

/** Licences that oblige us to name the author. CC0 does not. */
const NEEDS_ATTRIBUTION = new Set(['CC-BY']);

async function main() {
  const library = JSON.parse(await fs.readFile(LIBRARY_FILE, 'utf8'));

  const assets = [
    ...Object.entries(library.models).map(([id, m]) => ({ id, kind: 'model', ...m })),
    ...Object.entries(library.textures).map(([id, m]) => ({ id, kind: 'texture', ...m })),
    // Planet maps. CC-BY like most of the models, and a credits file that
    // silently omits a CC-BY asset is a licence breach, not an untidy file —
    // which is the whole reason this is generated rather than written.
    ...Object.entries(library.planets ?? {}).map(([id, m]) => ({ id, kind: 'planet map', ...m })),
    ...Object.entries(library.hdri ?? {}).map(([id, m]) => ({ id, kind: 'sky', ...m })),
    ...Object.entries(library.sfx ?? {}).map(([id, m]) => ({ id, kind: 'sound', ...m })),
  ];

  const required = assets.filter((a) => NEEDS_ATTRIBUTION.has(a.licence));
  const publicDomain = assets.filter((a) => a.licence === 'CC0');
  const unknown = assets.filter((a) => !a.licence);

  const lines = [
    '# Credits',
    '',
    'Generated from `assets/library.json`. Do not edit by hand — run',
    '`npm run content:credits`.',
    '',
  ];

  if (required.length) {
    lines.push(
      '## Attribution required (CC BY 4.0)',
      '',
      'These assets are used under the Creative Commons Attribution licence.',
      'Their authors must be credited wherever this application is distributed.',
      '',
      ...required.map((a) => `- **${a.id}** — ${a.source}  \n  ${a.url ?? ''}`.trimEnd()),
      ''
    );
  }

  if (publicDomain.length) {
    lines.push(
      '## Public domain (CC0)',
      '',
      'No attribution is required for these. They are listed for the record.',
      '',
      ...sources(publicDomain).map((s) => `- ${s}`),
      ''
    );
  }

  if (unknown.length) {
    lines.push(
      '## ⚠️ Licence not recorded',
      '',
      'These cannot ship until a licence is written into their sidecar.',
      '',
      ...unknown.map((a) => `- ${a.id}`),
      ''
    );
  }

  await fs.writeFile(CREDITS_FILE, lines.join('\n'), 'utf8');

  console.log(
    `${relative(CREDITS_FILE)}\n` +
      `  ${required.length} needing attribution · ${publicDomain.length} CC0` +
      (unknown.length ? ` · ${unknown.length} UNLICENSED` : '')
  );

  // An unlicensed asset is a shipping blocker, so fail the build rather than
  // printing a warning nobody reads.
  if (unknown.length) process.exitCode = 1;
}

/** One line per distinct source, not per file — a pack credited once. */
const sources = (assets) => [...new Set(assets.map((a) => a.source).filter(Boolean))].sort();

await main();
