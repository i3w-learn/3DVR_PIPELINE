#!/usr/bin/env node
/**
 * Point a lesson object at a model, at the right size.
 *
 * Every model is standardised to a set height, but the lessons scale them
 * again to fit the table or the field. Swapping a drawn model for a realistic
 * one by hand meant working out that scale each time: the new model's size
 * from the library, the old one's from the lesson, and a division. Done by
 * hand, it was wrong often enough — a helicopter the size of a bus, a starfish
 * ten metres across — to be worth a command.
 *
 * Given an object and a model, this keeps the object the size it was: the new
 * model's longest side is made to match the old one's. `--size` sets the
 * longest side in metres instead, which is what to use when the object was
 * built by code and had no model to measure.
 *
 * Usage:
 *   node tools/build/place.js <lesson> <object id> <model>
 *   node tools/build/place.js evs-lkg-market apple realapple
 *   node tools/build/place.js evs-ukg-flowers marigold realmarigold --size 0.3
 *   node tools/build/place.js hin-nur-vadya-yantra dholak realdholak --size 0.3 --rotation "0 45 0"
 *
 * It edits the lesson file in place, touching only that one object, and says
 * what it did. Run `npm run content:check` after; look with `&look=<id>`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { LESSONS_DIR, LIBRARY_FILE, relative } from '../lib/paths.js';

/** The lesson JSON's own formatting: two-space indent, objects at depth two. */
const OBJECT_INDENT = '      ';
const OBJECT_END = '\n    }';

const longest = (model) => Math.max(model.width, model.height, model.depth);
const triple = (n) => Array(3).fill(n.toFixed(3)).join(' ');

async function main() {
  const [lessonId, objectId, modelId, ...flags] = process.argv.slice(2);
  const size = flags.includes('--size') ? Number(flags[flags.indexOf('--size') + 1]) : null;
  const rotation = flags.includes('--rotation') ? flags[flags.indexOf('--rotation') + 1] : null;

  if (!lessonId || !objectId || !modelId) {
    console.error('Usage: node tools/build/place.js <lesson> <object id> <model> [--size metres] [--rotation "x y z"]');
    process.exitCode = 1;
    return;
  }

  const library = JSON.parse(await fs.readFile(LIBRARY_FILE, 'utf8')).models;
  const model = library[modelId];
  if (!model) throw new Error(`No model "${modelId}" in the library. Run npm run content:std ${modelId} and npm run content:library first.`);

  const index = JSON.parse(await fs.readFile(path.join(LESSONS_DIR, 'index.json'), 'utf8')).lessons;
  const file = path.join(LESSONS_DIR, index[lessonId] ?? `${lessonId}.json`);
  let text = await fs.readFile(file, 'utf8').catch(() => {
    throw new Error(`No lesson "${lessonId}".`);
  });

  // Find the object's block by its id, then work on the text of that block
  // alone, so the rest of the file keeps every space and line it had.
  const idAt = text.indexOf(`"id": "${objectId}"`);
  if (idAt < 0) throw new Error(`No object "${objectId}" in ${relative(file)}.`);
  const start = text.lastIndexOf('{', idAt);
  const end = text.indexOf(OBJECT_END, start);
  let block = text.slice(start, end);

  const before = JSON.parse(`${block}\n}`);
  const oldModel = before.model ? library[before.model] : null;
  const oldScale = Number((before.scale ?? '1 1 1').split(' ')[0]);

  let scale;
  let reason;
  if (size !== null) {
    scale = size / longest(model);
    reason = `${size} m across, as asked`;
  } else if (oldModel) {
    scale = (oldScale * longest(oldModel)) / longest(model);
    reason = `the same ${(oldScale * longest(oldModel)).toFixed(2)} m across as "${before.model}" was`;
  } else {
    throw new Error(`"${objectId}" is built by code, so there is no old size to keep. Say how big with --size <metres>.`);
  }

  if (before.build) {
    // A built prop becomes a model: the builder and its params go, the
    // position and everything else stays.
    block = block.replace(/"build": "[^"]*",\n/, `"model": "${modelId}",\n`);
    block = block.replace(/\s*"params": \{[^}]*\},?\n/, '\n');
    block = block.replace(/("model": "[^"]*",\n)/, `$1${OBJECT_INDENT}"scale": "${triple(scale)}",\n`);
  } else {
    block = block.replace(/"model": "[^"]*"/, `"model": "${modelId}"`);
    block = /"scale":/.test(block)
      ? block.replace(/"scale": "[^"]*"/, `"scale": "${triple(scale)}"`)
      : block.replace(/("model": "[^"]*",\n)/, `$1${OBJECT_INDENT}"scale": "${triple(scale)}",\n`);
  }

  if (rotation) {
    block = /"rotation":/.test(block)
      ? block.replace(/"rotation": "[^"]*"/, `"rotation": "${rotation}"`)
      : block.replace(/("position": "[^"]*",\n)/, `$1${OBJECT_INDENT}"rotation": "${rotation}",\n`);
  }

  // A clip named for the old model will not exist on the new one.
  if (before.clip && !(model.clips ?? []).includes(before.clip)) {
    block = block.replace(/,?\n\s*"clip": "[^"]*"/, '').replace(/,?\n\s*"clipSpeed": [^,\n]*/, '');
    console.log(`  dropped clip "${before.clip}": "${modelId}" has ${model.clips?.length ? `clips ${model.clips.join(', ')}` : 'no clips'}`);
  }

  block = block.replace(/,(\s*)$/, '$1'); // a trailing comma left by a removed last key
  text = `${text.slice(0, start)}${block}${text.slice(end)}`;
  JSON.parse(text); // still a lesson

  await fs.writeFile(file, text, 'utf8');

  const across = (scale * longest(model)).toFixed(2);
  console.log(
    `${relative(file)}\n  ${objectId}: ${before.model ?? `built by "${before.build}"`} → ${modelId}, scale ${scale.toFixed(3)} (${reason}; now ${across} m)\n` +
      `  next: npm run content:check, then open the lesson with &look=${objectId}`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
