#!/usr/bin/env node
/**
 * Fill in the Marathi and Odia script lines.
 *
 * A lesson is written in English and Hindi. The other languages come from
 * `raw/translations/<lang>.json`, a table from the English sentence to its
 * translation. One table per language rather than a line inside each lesson,
 * because the same sentence turns up in many lessons ("This is a cow.") and
 * should be translated once, reviewed once and corrected once.
 *
 * This never overwrites a line a lesson already has: the first farm lessons
 * carry translations somebody wrote by hand, and those win. It only fills
 * gaps, so it is safe to run as often as you like — and it is what brings the
 * translations back after a lesson is regenerated from a script.
 *
 * A reviewer corrects the TABLE, then runs this with `--refresh` to push the
 * correction into every lesson that uses the sentence.
 *
 * Run by `npm run content:translations`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { findLessons } from '../lib/lessons.js';
import { LESSONS_DIR, RAW_DIR } from '../lib/paths.js';

const refresh = process.argv.includes('--refresh');
const tablesDir = path.join(RAW_DIR, 'translations');
const tables = {};

for (const file of await fs.readdir(tablesDir).catch(() => [])) {
  if (file.endsWith('.json')) tables[path.basename(file, '.json')] = JSON.parse(await fs.readFile(path.join(tablesDir, file), 'utf8'));
}

let filled = 0;
const untranslated = new Set();

for (const { file } of await findLessons()) {
  const target = path.join(LESSONS_DIR, file);
  const lesson = JSON.parse(await fs.readFile(target, 'utf8'));
  let changed = false;

  for (const holder of [...(lesson.steps ?? []), ...(lesson.objects ?? [])]) {
    const script = holder.script;
    if (!script?.en) continue;

    for (const [lang, table] of Object.entries(tables)) {
      const translation = table[script.en];
      if (!translation) { if (!script[lang]) untranslated.add(`${lang}: ${script.en}`); continue; }
      // `--refresh` re-applies the table, but only over lines that came from it.
      if (script[lang] && !(refresh && script[`${lang}From`] !== 'hand')) continue;
      if (script[lang] === translation) continue;
      script[lang] = translation; changed = true; filled += 1;
    }
  }

  if (changed) await fs.writeFile(target, `${JSON.stringify(lesson, null, 2)}\n`, 'utf8');
}

console.log(`${filled} line(s) filled from ${Object.keys(tables).join(', ') || 'no tables'}.`);
if (untranslated.size) {
  console.log(`${untranslated.size} line(s) still have no translation:`);
  for (const line of [...untranslated].slice(0, 20)) console.log(`  · ${line}`);
}
