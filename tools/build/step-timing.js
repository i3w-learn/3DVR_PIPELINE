#!/usr/bin/env node
/**
 * Make every step last as long as its sentence.
 *
 * A step's `duration` was written by guessing how long the line takes to say.
 * Once the line is recorded the guess can be checked — and it has to be,
 * because the same sentence runs a third longer in Marathi than in English,
 * and a step that ends early cuts the narration off mid-word.
 *
 * For each narrated step this finds the longest clip across every language
 * that has one, and raises the step's duration to clip + a breath. It never
 * shortens a step: a pause the author chose is left alone.
 *
 * Run by `npm run content:timing`, after narration is built.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { findLessons } from '../lib/lessons.js';
import { AUDIO_DIR, LESSONS_DIR } from '../lib/paths.js';

const run = promisify(execFile);

/** Room after the last word, so a step never ends on the final syllable. */
const BREATH_MS = 1200;

const languages = (await fs.readdir(AUDIO_DIR, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
const lengths = new Map();

async function clipMs(file) {
  if (lengths.has(file)) return lengths.get(file);

  let longest = 0;
  for (const lang of languages) {
    const clip = path.join(AUDIO_DIR, lang, file);
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]).catch(() => ({ stdout: '' }));
    longest = Math.max(longest, Math.round(Number(stdout) * 1000) || 0);
  }

  lengths.set(file, longest);
  return longest;
}

let raised = 0;

for (const { file } of await findLessons()) {
  const target = path.join(LESSONS_DIR, file);
  const lesson = JSON.parse(await fs.readFile(target, 'utf8'));
  let changed = false;

  for (const step of lesson.steps ?? []) {
    if (!step.audio || typeof step.duration !== 'number') continue;

    const needed = Math.ceil(((await clipMs(step.audio)) + BREATH_MS) / 500) * 500;
    if (needed > step.duration) { step.duration = needed; changed = true; raised += 1; }
  }

  if (changed) await fs.writeFile(target, `${JSON.stringify(lesson, null, 2)}\n`, 'utf8');
}

console.log(raised ? `${raised} step(s) lengthened to fit their narration.` : 'Every step already outlasts its narration.');
