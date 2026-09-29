#!/usr/bin/env node
/**
 * docs/OBJECT-REPORT.md — what is realistic, what is still drawn, and why.
 *
 * Generated, for the same reason the status page is: a list of "what is left"
 * written by hand is right on the day it is written and wrong the day after
 * the next model lands. This one is worked out from the lessons, the stage
 * kits, the library and the sidecars in `raw/`.
 *
 * "Realistic" means the sidecar says the model came from Sketchfab: every
 * Sketchfab model in the project was chosen by eye for the realistic look.
 * "Drawn" is everything else that is a model file. "Built by code" is a thing
 * a builder makes from shapes, which is sometimes the point (a numeral) and
 * sometimes a stand-in (a toy figure for a farmer).
 *
 * Run by `npm run content:objects`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { findLessons } from '../lib/lessons.js';
import { LIBRARY_FILE, ROOT, relative } from '../lib/paths.js';

const OUT = path.join(ROOT, 'docs', 'OBJECT-REPORT.md');
const STAGES = path.join(ROOT, 'app', 'stages');

/** The user's own scenes. They stay as they are, so their scenery is not "left to do". */
const ORIGINAL_STAGES = ['farmyard', 'solar', 'school', 'classroom', 'hall', 'kitchen', 'office', 'chemlab', 'physicslab', 'playground'];

/** Builders whose whole job is to be simple. Not stand-ins for anything. */
const SIMPLE_ON_PURPOSE = new Set([
  'glyph', 'counter', 'mat', 'shape', 'letter3d', 'bar', 'stroke', 'path', 'balance', 'tub', 'cloth',
  'sundisc', 'sun', 'planet', 'orrery', 'cloud', 'rainbow', 'waterbody', 'footprints', 'bodypart',
  'housepart', 'plantpart', 'sprout', 'building', 'flagpole', 'worship', 'rangoli', 'diya', 'gulal',
  'crescent', 'tank', 'goal', 'hoop',
]);

/** Why each stand-in is still a stand-in. One line, in plain words. */
const WHY_STILL_BUILT = {
  person: 'No free, realistic, Indian figure with a skeleton exists for these roles. Needs AI-made or paid models — a decision for Manas.',
  peacock: 'Three candidates (Sketchfab, Tripo, Meshy) stand in the demo; waiting for Manas to pick one.',
  door: 'It opens and shuts in the lesson, which the code does. A downloaded door would not move.',
  gate: 'It opens and shuts in the lesson, which the code does. A downloaded gate would not move.',
  stall: 'The fruit and vegetables stand on its counter; a different stall would leave them in mid-air.',
  dholak: 'The only free model is a plain brown barrel, no better than the drawn one.',
  flower: 'Marigold only: no free realistic marigold under 100,000 faces.',
  campfire: 'Already a realistic fire: the builder places the `realbonfire` model and adds the flame.',
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const isReal = (model) => /Sketchfab/.test(model?.source ?? '');
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

async function main() {
  const library = (await readJson(LIBRARY_FILE)).models;
  const lessons = (await findLessons()).filter((l) => !l.dir); // the curriculum, not the demos

  const models = new Map(); // id -> { lessons:Set, names:Set }
  const built = new Map(); // builder -> { lessons:Set, roles:Set }

  for (const entry of lessons) {
    const lesson = await readJson(path.join(ROOT, 'app', 'lessons', entry.file));

    for (const object of lesson.objects ?? []) {
      if (object.model) {
        const seen = models.get(object.model) ?? { lessons: new Set(), names: new Set() };
        seen.lessons.add(lesson.id);
        if (object.name?.en) seen.names.add(object.name.en);
        models.set(object.model, seen);
      }

      if (object.build) {
        const seen = built.get(object.build) ?? { lessons: new Set(), kinds: new Set() };
        seen.lessons.add(lesson.id);
        const kind = object.params?.role ?? object.params?.kind;
        if (kind) seen.kinds.add(kind);
        built.set(object.build, seen);
      }
    }
  }

  const scenery = new Map(); // id -> Set of stage ids
  for (const file of (await fs.readdir(STAGES)).filter((f) => f.endsWith('.json'))) {
    const stage = await readJson(path.join(STAGES, file));
    for (const prop of stage.props ?? []) {
      if (!prop.model) continue;
      const lands = scenery.get(prop.model) ?? new Set();
      lands.add(file.replace('.json', ''));
      scenery.set(prop.model, lands);
    }
  }

  const used = [...models.keys()].sort();
  const real = used.filter((id) => isReal(library[id]));
  const drawn = used.filter((id) => !isReal(library[id]));

  const sceneryReal = [...scenery.keys()].filter((id) => isReal(library[id])).sort();
  const sceneryDrawn = [...scenery.keys()].filter((id) => !isReal(library[id])).sort();
  const sceneryOurs = sceneryDrawn.filter((id) => [...scenery.get(id)].some((s) => !ORIGINAL_STAGES.includes(s)));

  const standIns = [...built.keys()].filter((b) => !SIMPLE_ON_PURPOSE.has(b)).sort();
  const simple = [...built.keys()].filter((b) => SIMPLE_ON_PURPOSE.has(b)).sort();

  const named = new Set([...used, ...scenery.keys()]);
  const spare = Object.keys(library).filter((id) => !named.has(id)).sort();

  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  const say = (...text) => lines.push(...text, '');

  say('# Object report — what is realistic, what is still drawn, and why');
  say(
    `_Generated ${date} by \`npm run content:objects\` from \`app/lessons/\`, \`app/stages/\`, ` +
      '`app/assets/library.json` and the sidecars in `raw/`. Do not edit by hand._'
  );

  say('## The short version');
  say(
    table(
      ['', 'Count'],
      [
        ['Models that lessons show', `**${used.length}**`],
        ['— realistic', `**${real.length}**`],
        ['— still drawn', `**${drawn.length}**`],
        ['Scenery models in the lands', String(scenery.size)],
        ['— realistic', String(sceneryReal.length)],
        ['— still drawn, in lands that may be changed', String(sceneryOurs.length)],
        ['Things built by code that stand in for a real thing', String(standIns.length)],
        ['Things built by code that are meant to be simple', String(simple.length)],
      ]
    )
  );

  say('## 1. Still to do');
  if (!drawn.length && !sceneryOurs.length) {
    say('Every model a lesson shows is realistic, and so is the scenery of every land that may be changed.');
  }
  if (drawn.length) {
    say('### Lesson models still drawn');
    say(table(['Model', 'Shown as', 'Source', 'Lessons'], drawn.map((id) => [
      `\`${id}\``, [...models.get(id).names].join(', '), library[id]?.source ?? '?', [...models.get(id).lessons].join(', '),
    ])));
  }
  if (sceneryOurs.length) {
    say('### Scenery still drawn');
    say(table(['Model', 'Lands'], sceneryOurs.map((id) => [`\`${id}\``, [...scenery.get(id)].join(', ')])));
  }

  say('### Built by code, standing in for a real thing');
  say(table(['What', 'Kinds', 'Lessons', 'Why it is still built by code'], standIns.map((b) => [
    `\`${b}\``,
    [...built.get(b).kinds].sort().join(', '),
    [...built.get(b).lessons].sort().join(', '),
    WHY_STILL_BUILT[b] ?? '_no reason recorded — add one to `tools/build/object-report.js`_',
  ])));

  const kept = sceneryDrawn.filter((id) => !sceneryOurs.includes(id));
  if (kept.length) {
    say('### Left alone on purpose');
    say(
      'These drawn models appear only in the original scenes (farmyard, school, solar system), which stay as they are: ' +
        kept.map((id) => `\`${id}\` (${[...scenery.get(id)].join(', ')})`).join(', ') + '.'
    );
  }

  say('## 2. Realistic models that lessons show');
  say(`${real.length} models, all from Sketchfab, all CC-BY or CC0. Credits are in \`docs/CREDITS.md\`.`);
  say(table(['Shown as', 'Model', 'Made by', 'Faces', 'Lessons'], real.map((id) => [
    [...models.get(id).names].sort().join(', ') || '—',
    `\`${id}\``,
    (library[id].source.match(/ by (.+)$/)?.[1] ?? '').trim(),
    library[id].triangles.toLocaleString('en-IN'),
    String(models.get(id).lessons.size),
  ])));

  say('## 3. Realistic scenery in the lands');
  say(table(['Model', 'Lands'], sceneryReal.map((id) => [`\`${id}\``, [...scenery.get(id)].sort().join(', ')])));

  say('## 4. Built by code, and meant to be simple');
  say(simple.map((b) => `\`${b}\``).join(', ') + '.');

  say('## 5. Model files nothing shows');
  say(
    `${spare.length} files. Some are used by a builder or a demo rather than named in a lesson; ` +
      'the rest are spare, kept in case a new lesson wants them.'
  );
  say(spare.map((id) => `\`${id}\``).join(', '));

  say('## How the numbers are made');
  say(
    '- **Realistic** — the model\'s sidecar in `raw/` says it came from Sketchfab.',
    '- **Drawn** — any other model file (Poly Pizza, Kenney, Poly Haven low-poly).',
    '- **Shown** — a lesson\'s `objects[].model` names it. Demo lessons are left out.',
    '- **Scenery** — a stage kit\'s `props[].model` names it.'
  );

  await fs.writeFile(OUT, `${lines.join('\n').trimEnd()}\n`, 'utf8');
  console.log(
    `${relative(OUT)}\n  ${used.length} lesson models · ${real.length} realistic · ${drawn.length} drawn · ` +
      `${standIns.length} stand-ins built by code`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
