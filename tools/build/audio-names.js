#!/usr/bin/env node
/**
 * Give every narrated line a file name.
 *
 * A line is only spoken if its step (or its object, in `explore`) names an
 * audio file; without one the teacher reads it aloud, which is the designed
 * default but not the plan for 109 lessons. Naming a thousand lines by hand is
 * how two of them end up with the same name, so the names are generated:
 *
 *   <lesson-id>-s03.mp3        the third step
 *   <lesson-id>-cow.mp3        the line the cow says in an `explore` lesson
 *
 * Names already in a lesson are left alone — the first farm lessons have
 * hand-picked names with recordings behind them. Idempotent: run it as often
 * as you like, and after regenerating a lesson from a script.
 *
 * Run by `npm run content:audio-names`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { findLessons } from '../lib/lessons.js';
import { LESSONS_DIR } from '../lib/paths.js';

let named = 0, lessonsTouched = 0;

for (const { id, file } of await findLessons()) {
  const target = path.join(LESSONS_DIR, file);
  const lesson = JSON.parse(await fs.readFile(target, 'utf8'));
  let changed = false;

  lesson.steps?.forEach((step, i) => {
    if (step.audio || !step.script) return;
    step.audio = `${id}-s${String(i + 1).padStart(2, '0')}.mp3`;
    changed = true; named += 1;
  });

  for (const object of lesson.objects ?? []) {
    if (object.audio || !object.script) continue;
    object.audio = `${id}-${object.id}.mp3`;
    changed = true; named += 1;
  }

  if (changed) {
    await fs.writeFile(target, `${JSON.stringify(lesson, null, 2)}\n`, 'utf8');
    lessonsTouched += 1;
  }
}

console.log(named ? `${named} line(s) named across ${lessonsTouched} lesson(s).` : 'Every narrated line already has a file name.');
