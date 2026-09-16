/**
 * Finding lesson files on disk.
 *
 * `app/lessons/` is no longer flat. Curriculum topics sit at the top; anything
 * under a subfolder is not a curriculum topic — `demo/` holds the scenes that
 * exist to exercise a stage kit, and grade folders will follow the same rule.
 *
 * A lesson id stays a plain id wherever the file lives. `gk-lkg-chem-lab` is
 * still `gk-lkg-chem-lab`, not `demo/gk-lkg-chem-lab`. Folders are how humans
 * organise the directory; the id is the name the rest of the system uses, and
 * putting the path into the id would mean moving a file renames the lesson.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { LESSONS_DIR } from './paths.js';

/** Generated, so it is never hand-edited into disagreeing with the files. */
export const INDEX_FILE = path.join(LESSONS_DIR, 'index.json');

/**
 * Every lesson under `app/lessons/`, at any depth.
 *
 * @returns {Promise<Array<{id: string, file: string, dir: string}>>}
 *   `file` is the path the browser fetches, relative to `app/lessons/`.
 *   `dir` is '' for a curriculum topic, or the subfolder name for anything else.
 */
export async function findLessons() {
  const found = [];

  async function walk(absDir, relDir) {
    const entries = await fs.readdir(absDir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(absDir, entry.name), relDir ? `${relDir}/${entry.name}` : entry.name);
        continue;
      }

      if (!entry.name.endsWith('.json')) continue;
      // The index is our own output, not a lesson.
      if (!relDir && entry.name === 'index.json') continue;

      found.push({
        id: path.basename(entry.name, '.json'),
        file: relDir ? `${relDir}/${entry.name}` : entry.name,
        dir: relDir,
      });
    }
  }

  await walk(LESSONS_DIR, '');

  return found.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Two lessons may not share an id, whatever folders they are in.
 *
 * Without this check a demo and a curriculum lesson could both be called
 * `evs-lkg-farm-yard`, and which one loaded would depend on directory order.
 *
 * @param {Array<{id: string, file: string}>} lessons
 * @returns {string[]} one message per clash, empty when there are none
 */
export function findDuplicateIds(lessons) {
  const seen = new Map();
  const clashes = [];

  for (const lesson of lessons) {
    const first = seen.get(lesson.id);
    if (first) clashes.push(`duplicate lesson id "${lesson.id}": ${first} and ${lesson.file}`);
    else seen.set(lesson.id, lesson.file);
  }

  return clashes;
}
