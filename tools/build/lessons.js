/**
 * app/lessons/**.json  →  app/lessons/index.json
 *
 * The browser cannot list a directory, so it needs to be told where a lesson
 * id lives. This writes that map.
 *
 * Generated, never hand-edited — the same reason `library.json` is generated.
 * A hand-written list drifts from the files within a month and then lies about
 * which lessons exist, which is worse than having no list at all.
 *
 * Run by `npm run content:lessons`, and by `content:build` before validation.
 */

import fs from 'node:fs/promises';

import { findDuplicateIds, findLessons, INDEX_FILE } from '../lib/lessons.js';
import { relative } from '../lib/paths.js';

async function main() {
  const lessons = await findLessons();

  const clashes = findDuplicateIds(lessons);
  if (clashes.length) {
    // Writing an index with a duplicate in it would bake the ambiguity in.
    for (const clash of clashes) console.error(`  ${clash}`);
    throw new Error(`${clashes.length} duplicate lesson id(s).`);
  }

  const index = {
    generated: new Date().toISOString(),
    lessons: Object.fromEntries(lessons.map((l) => [l.id, l.file])),
  };

  await fs.writeFile(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  const curriculum = lessons.filter((l) => !l.dir).length;
  const other = lessons.length - curriculum;

  console.log(
    `${relative(INDEX_FILE)}\n` +
      `  ${curriculum} curriculum topic(s)` +
      (other ? ` · ${other} outside the curriculum` : '')
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
