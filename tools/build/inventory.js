#!/usr/bin/env node
/**
 * docs/OBJECT-INVENTORY.md — every object that is still drawn, and how far along
 * its realistic replacement is.
 *
 * Two inputs. The files say what is true today: which model each lesson and
 * land loads, and where each model came from (its sidecar). `raw/inventory.json`
 * says what a person decided: which Sketchfab model to take, or that it must be
 * generated, and whether it has been looked at in a headset. The table joins the
 * two, so "switch only" is never typed by hand — they flip on
 * their own when the file lands, and the row leaves when the lesson points at it.
 *
 * Any drawn object the files reveal that the hand list does not know yet is
 * appended to `raw/inventory.json` as "to find", so the list cannot drift.
 *
 * Run by `npm run content:inventory`, and as the last step of `content:build`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { findLessons } from '../lib/lessons.js';
import { DOCS_DIR, LESSONS_DIR, MODELS_DIR, RAW_DIR, STAGES_DIR } from '../lib/paths.js';

const HAND = path.join(RAW_DIR, 'inventory.json');
const OUT = path.join(DOCS_DIR, 'OBJECT-INVENTORY.md');

/** The original scenes. Nothing in them is on the list. */
const ORIGINAL_LANDS = new Set(['farmyard', 'school', 'solar', 'playground']);

/**
 * Code-built parts that are meant to be simple — letters, beads, planets, a
 * flagpole. They are not stand-ins for a real thing, so they are not on the list.
 */
const SIMPLE_BUILDS = new Set(['glyph', 'counter', 'shape', 'bar', 'stroke', 'sundisc', 'planet', 'sun', 'orrery', 'waterbody', 'path', 'cloud', 'rainbow', 'housepart', 'building', 'mat', 'tank', 'worship', 'flagpole', 'rangoli', 'diya', 'gulal', 'crescent', 'footprints', 'bodypart', 'plantpart', 'sprout', 'tub', 'cloth', 'goal', 'shuttle', 'hoop', 'balance']);

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const exists = (file) => fs.access(file).then(() => true, () => false);

/** id → where it came from, off the sidecar the fetch script wrote. */
async function sources() {
  const map = new Map();
  for (const file of await fs.readdir(RAW_DIR)) {
    if (!file.endsWith('.meta.json')) continue;
    const meta = await readJson(path.join(RAW_DIR, file));
    map.set(meta.id, (meta.source ?? '?').split(' — ')[0].trim());
  }
  return map;
}

const isReal = (source, id) => source.get(id) === 'Sketchfab';

/** Walk anything JSON-shaped and hand back every `model` and `build` it names. */
function refs(node, into = { models: [], builds: [] }) {
  if (Array.isArray(node)) node.forEach((n) => refs(n, into));
  else if (node && typeof node === 'object') {
    if (typeof node.model === 'string') into.models.push(node.model);
    if (typeof node.build === 'string') into.builds.push({ build: node.build, role: node.params?.role });
    Object.values(node).forEach((n) => refs(n, into));
  }
  return into;
}

const source = await sources();

// ---- what the lessons and lands actually use ------------------------------

/** key → Set of lesson ids. Keys are model ids, `person-<role>`, or a build name. */
const usedIn = new Map();
const note = (map, key, where) => map.set(key, (map.get(key) ?? new Set()).add(where));

for (const entry of await findLessons()) {
  if (entry.dir) continue; // demos are not curriculum
  const lesson = await readJson(path.join(LESSONS_DIR, entry.file));
  for (const object of lesson.objects ?? []) {
    if (typeof object.model === 'string') {
      note(usedIn, object.model, entry.id);
    } else if (object.build === 'person') note(usedIn, `person-${object.params?.role ?? 'unknown'}`, entry.id);
    else if (object.build && !SIMPLE_BUILDS.has(object.build)) note(usedIn, object.build, entry.id);
  }
}

const landsOf = new Map();
for (const file of await fs.readdir(STAGES_DIR)) {
  if (!file.endsWith('.json')) continue;
  const land = file.slice(0, -5);
  for (const model of new Set(refs(await readJson(path.join(STAGES_DIR, file))).models)) note(landsOf, model, land);
}

// ---- the list: everything drawn that a lesson or a non-original land shows ---

const wanted = new Map(); // key → { kind, where }
for (const [key, lessons] of usedIn) {
  if (source.has(key) && isReal(source, key)) continue; // already realistic
  const kind = key.startsWith('person-') ? 'person' : source.has(key) ? 'object' : 'prop';
  wanted.set(key, { kind, where: [...lessons].sort() });
}
for (const [model, lands] of landsOf) {
  if (isReal(source, model)) continue;
  const outside = [...lands].filter((l) => !ORIGINAL_LANDS.has(l)).sort();
  if (!outside.length) continue; // only in the original scenes — leave it
  const row = wanted.get(model) ?? { kind: 'scenery', where: [] };
  row.where = [...new Set([...row.where, ...outside.map((l) => `land: ${l}`)])];
  wanted.set(model, row);
}

// ---- join with the hand list, appending anything new --------------------------

const hand = await readJson(HAND).catch(() => ({}));
const added = [];
for (const key of wanted.keys()) {
  if (!hand[key]) {
    hand[key] = { from: 'sketchfab', uid: '', lead: '', status: 'to find', note: '' };
    added.push(key);
  }
}
const stale = Object.keys(hand).filter((k) => !k.startsWith('_') && !wanted.has(k));
if (added.length) await fs.writeFile(HAND, `${JSON.stringify(hand, null, 2)}\n`);

/** The realistic model an entry is waiting for: `real<key>` unless the hand list names one. */
const targetOf = (key, entry) => entry.target ?? (key.startsWith('person-') ? `real${key.slice(7)}` : `real${key}`);

async function status(key, entry, row) {
  if (entry.status === 'checked in VR') return 'checked in VR';
  const target = targetOf(key, entry);
  if (await exists(path.join(MODELS_DIR, `${target}.glb`))) return 'switch only';
  return entry.uid ? 'lead' : entry.status === 'lead' ? 'lead' : 'to find';
}

const rows = [];
for (const [key, row] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
  const entry = hand[key];
  rows.push({ key, ...row, entry, status: await status(key, entry, row), target: targetOf(key, entry), source: source.get(key) ?? 'code' });
}

// ---- write ---------------------------------------------------------------------

const ORDER = ['to find', 'lead', 'switch only', 'checked in VR'];
const count = (s) => rows.filter((r) => r.status === s).length;
const byKind = (k) => rows.filter((r) => r.kind === k);
const out = [];
const say = (...text) => out.push(...text);

say('# Object inventory — every drawn object, and how far its realistic replacement has come', '',
  `_Generated by \`npm run content:inventory\` on ${new Date().toISOString().slice(0, 10)}. The decisions (which Sketchfab model, generate or build, checked in VR) live in \`raw/inventory.json\` and are edited by hand. Everything else here is read from the files — do not edit this page._`, '');

say('## The short version', '', '| Status | Count | Meaning |', '|---|---:|---|');
say(`| to find | ${count('to find')} | nobody has picked a model yet |`);
say(`| lead | ${count('lead')} | a free Sketchfab model is picked (uid in the hand list), not yet downloaded |`);
say(`| switch only | ${count('switch only')} | the realistic model is already in \`app/assets/models/\`; the lesson just has to point at it |`);
say(`| checked in VR | ${count('checked in VR')} | somebody looked at it in a headset and said yes |`);
say(`| **Total on the list** | **${rows.length}** | ${byKind('object').length} lesson objects, ${byKind('scenery').length} land props, ${byKind('person').length} people, ${byKind('prop').length} code-drawn props |`, '');

say(`Where each one comes from: ${['sketchfab', 'tripo', 'build', 'switch'].map((f) => `**${f}** ${rows.filter((r) => r.entry.from === f).length}`).join(' · ')}.`, '');
if (added.length) say(`> Added to the hand list this run, as "to find": ${added.map((k) => `\`${k}\``).join(', ')}.`, '');
if (stale.length) say(`> In the hand list but no longer needed (done, or dropped from every lesson): ${stale.map((k) => `\`${k}\``).join(', ')}. Delete them from \`raw/inventory.json\` when convenient.`, '');

const table = (list) => {
  say('| # | Object | Used in | Now | Get from | Lead | Status | Note |', '|--:|---|---|---|---|---|---|---|');
  list.forEach((r, i) => say(`| ${i + 1} | \`${r.key}\` → \`${r.target}\` | ${r.where.join(', ')} | ${r.source} | ${r.entry.from}${r.entry.uid ? ` \`${r.entry.uid.slice(0, 8)}…\`` : ''} | ${r.entry.lead ?? ''} | **${r.status}** | ${r.entry.note ?? ''} |`));
  say('');
};

for (const [kind, title, blurb] of [
  ['object', 'Lesson objects', 'Downloaded low-poly models a lesson still shows. `→` names the realistic file each is waiting for.'],
  ['scenery', 'Land props', 'Drawn props in a land that is not one of the original scenes.'],
  ['person', 'People', 'Toy figures drawn from boxes. Each needs a rigged, posable figure under CC-BY or CC0, which is the hardest find on this list.'],
  ['prop', 'Code-drawn props', 'Things built from shapes in code that stand in for a real object.'],
]) {
  const list = byKind(kind);
  if (!list.length) continue;
  say(`## ${title} (${list.length})`, '', blurb, '');
  table(list);
}

say('## How to use this', '',
  '1. Pick a row. Open the lead on Sketchfab, or search again if the lead is wrong. Licence must be CC-BY or CC0, never "Free Standard".',
  '2. Put its uid in `raw/inventory.json` under `uid`, and set `from` to `sketchfab`, `tripo` or `build`. The status turns to **lead** by itself.',
  '3. Download with `node tools/fetch/sketchfab.js <uid> <target> <height>`, then `npm run content:std`. The status turns to **switch only**.',
  '4. Point the lesson at the new model and run `npm run content:build`. The row drops off this list once every lesson uses the realistic one.',
  '5. After a look in the headset, set `status` to `checked in VR` by hand.', '');

await fs.writeFile(OUT, `${out.join('\n')}\n`);
console.log(`${path.relative(process.cwd(), OUT)}: ${rows.length} on the list — ${ORDER.map((s) => `${s} ${count(s)}`).join(', ')}${added.length ? `; added ${added.length} to the hand list` : ''}${stale.length ? `; ${stale.length} stale` : ''}`);
