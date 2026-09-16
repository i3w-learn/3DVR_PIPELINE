#!/usr/bin/env node
/**
 * Station 6 — Validate, on a laptop, before anyone puts a headset on.
 *
 * Every check here answers a question that is knowable before runtime: does
 * this model exist, does that clip exist, does this scene fit the budget. The
 * headset is not a content debugger; it is only for the one number a laptop
 * cannot produce, which is frame rate.
 *
 * Usage:
 *   node tools/validate-lessons.js
 *   node tools/validate-lessons.js --lesson evs-lkg-farm-animals
 *
 * Exit code 0 only if every lesson passes.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §12.6.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { RULES } from './rules/index.js';
import { findDuplicateIds, findLessons } from '../lib/lessons.js';
import { AUDIO_DIR, LESSONS_DIR, LIBRARY_FILE, relative, stageFile } from '../lib/paths.js';

async function main() {
  const only = argValue('--lesson');
  const library = await readJson(LIBRARY_FILE, 'Run `npm run content:library` first.');
  const languages = await listLanguages();
  const allIds = await listLessonIds();
  const lessonIds = only ? [only] : allIds;

  if (!lessonIds.length) {
    console.log(`No lessons in ${relative(LESSONS_DIR)} yet.`);
    return;
  }

  let failed = 0;

  for (const lessonId of lessonIds) {
    const problems = await checkLesson(lessonId, { library, languages });

    if (problems.length) {
      failed += 1;
      console.error(`✗ ${lessonId}`);
      for (const { rule, detail } of problems) console.error(`    [${rule}] ${detail}`);
    } else {
      console.log(`✓ ${lessonId}`);
    }
  }

  console.log();
  if (failed) {
    console.error(`${failed} of ${lessonIds.length} lesson(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`${lessonIds.length} lesson(s) passed. Frame rate is still a headset question.`);
  }
}

/**
 * Build the context every rule shares, then run all of them.
 *
 * Context building can fail on its own (unparseable JSON, missing stage kit).
 * Those are reported as rules L1 and L3 so the output has one shape.
 */
async function checkLesson(lessonId, { library, languages }) {
  let lesson;
  try {
    lesson = await readJson(path.join(LESSONS_DIR, lessonFiles.get(lessonId) ?? `${lessonId}.json`));
  } catch (err) {
    return [{ rule: 'VAL_L1', detail: err.message }];
  }

  for (const key of ['template', 'stage', 'objects', 'steps']) {
    if (lesson[key] === undefined) {
      return [{ rule: 'VAL_L1', detail: `missing required key "${key}"` }];
    }
  }

  let kit;
  try {
    kit = await readJson(stageFile(lesson.stage));
  } catch {
    return [{ rule: 'VAL_L3', detail: `stage "${lesson.stage}" has no kit in stages/` }];
  }

  // Shallow merge, and props are never overridable — a lesson dresses a kit,
  // it does not replace it.
  const { props: _ignored, ...override } = lesson.stageOverride ?? {};
  const resolvedStage = { ...kit, ...override };

  const context = {
    lesson,
    lessonId,
    kit,
    resolvedStage,
    library,
    languages,
    instances: listInstances(kit, lesson),
  };

  return RULES.flatMap((rule) =>
    rule.check(context).map((detail) => ({ rule: rule.id, detail }))
  );
}

/**
 * Every placement in the scene, stage props and lesson objects together.
 *
 * Budgets care about placements, not about distinct files: the same tree five
 * times is five times the geometry. `where` exists so a failure names the
 * thing a content author has to go and fix.
 */
function listInstances(kit, lesson) {
  // Built props carry no model, so they have nothing for the library to
  // check and no triangles the library can count. They are excluded here
  // rather than special-cased in every rule.
  const props = kit.props
    .filter((p) => !p.build)
    .map((p, i) => ({
      where: `stage "${kit.id}" props[${i}]`,
      model: p.model,
      clip: p.clip,
      raw: p,
    }));

  const objects = lesson.objects
    .filter((o) => !o.build)
    .map((o, i) => ({
      where: `objects[${i}] "${o.id ?? '?'}"`,
      model: o.model,
      clip: o.clip,
      raw: o,
    }));

  return [...props, ...objects];
}

/**
 * Every lesson, wherever it sits.
 *
 * `app/lessons/` has subfolders now — `demo/` for the scenes that exercise a
 * stage kit rather than teach a curriculum topic. A lesson in a subfolder is
 * validated exactly like any other; the folder changes what it is for, not
 * what it must satisfy.
 */
const lessonFiles = new Map();

async function listLessonIds() {
  const lessons = await findLessons();

  const clashes = findDuplicateIds(lessons);
  if (clashes.length) {
    for (const clash of clashes) console.error(`  ${clash}`);
    throw new Error(`${clashes.length} duplicate lesson id(s).`);
  }

  lessonFiles.clear();
  for (const lesson of lessons) lessonFiles.set(lesson.id, lesson.file);

  return lessons.map((l) => l.id);
}

/** Which languages we ship is a fact about the audio folders, not a setting. */
async function listLanguages() {
  const entries = await fs.readdir(AUDIO_DIR, { withFileTypes: true }).catch(() => []);
  const languages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const files = await fs.readdir(path.join(AUDIO_DIR, entry.name)).catch(() => []);
    // An empty folder means that language has not been recorded yet. Holding
    // lessons back for it would block the whole pipeline on narration.
    if (files.some((f) => !f.startsWith('.'))) languages.push(entry.name);
  }

  return languages;
}

async function readJson(file, hint = '') {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(`${relative(file)} not found. ${hint}`.trim());
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${relative(file)} is not valid JSON: ${err.message}`);
  }
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

await main();
