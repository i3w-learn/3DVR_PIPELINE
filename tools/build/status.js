#!/usr/bin/env node
/**
 * docs/STATUS.md — what is built, what is left, and the address of every lesson.
 *
 * Generated, for the same reason the lesson index is: a status page written by
 * hand is right on the day it is written. This one is worked out from the files
 * — the curriculum table in the content plan, the lessons, the stage kits, the
 * library and the narration folders — so it cannot claim a lesson that is not
 * there or a language that was never recorded.
 *
 * Run by `npm run content:status`, and as the last step of `content:build`.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { findLessons } from '../lib/lessons.js';
import { AUDIO_DIR, LESSONS_DIR, LIBRARY_FILE, ROOT } from '../lib/paths.js';

const PLAN = path.join(ROOT, 'docs', 'PRE-PRIMARY-CONTENT-PLAN.md');
const OUT = path.join(ROOT, 'docs', 'STATUS.md');
const BASE = 'http://localhost:4500/app/';

const CLASSES = { nur: 'Nursery', lkg: 'LKG', ukg: 'UKG' };
const SUBJECTS = { eng: 'English', math: 'Maths', evs: 'EVS', hin: 'Hindi', gk: 'G.K.' };
const LANGS = ['en', 'hi', 'mr', 'or'];
const LANG_NAMES = { en: 'English', hi: 'Hindi', mr: 'Marathi', or: 'Odia' };
/** The first farm lessons' photographed animals — the one art style the programme chose is low-poly. */
const PHOTOREAL = ['zebu', 'realgoat', 'realhen', 'realhorse', 'realelephant'];

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

/**
 * The listening check's verdict on one language: how many clips the recogniser
 * heard correctly, and which lessons hold the ones it did not.
 */
async function listened(lang) {
  const file = path.join(ROOT, 'raw', 'audio', `review-${lang}.tsv`);
  const text = await fs.readFile(file, 'utf8').catch(() => null);
  if (!text) return null;

  const rows = text.trim().split('\n').slice(1).map((line) => line.split('\t')).map(([score, clip]) => ({ score: Number(score), clip }));
  const checked = (await fs.stat(file)).mtime;
  const spoken = (await fs.stat(path.join(ROOT, 'raw', 'audio', `${lang}.json`)).catch(() => ({ mtime: 0 }))).mtime;

  const weak = new Map();
  for (const row of rows.filter((r) => r.score < 0.6)) {
    const lesson = row.clip.replace(/-(s\d+|[a-z0-9]+)\.mp3$/, '');
    weak.set(lesson, (weak.get(lesson) ?? 0) + 1);
  }

  return {
    total: rows.length,
    good: rows.filter((r) => r.score >= 0.8).length,
    fair: rows.filter((r) => r.score >= 0.6 && r.score < 0.8).length,
    poor: rows.filter((r) => r.score < 0.6).length,
    on: checked.toISOString().slice(0, 10),
    stale: spoken > checked,
    worst: [...weak].sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

/** The last few things that were merged, so the page says what is new. */
async function recent() {
  const { stdout } = await promisify(execFile)('git', ['log', '--first-parent', '-8', '--pretty=%ad|%s|%b%x1e', '--date=short'], { cwd: ROOT }).catch(() => ({ stdout: '' }));

  // A merge commit's subject is "Merge pull request #5 from …"; what it was FOR is the first line of its body.
  return stdout.split('\x1e').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [date, subject, ...body] = entry.split('|');
    const pr = subject.match(/^Merge pull request (#\d+)/);
    return [date, pr ? `${body.join('|').split('\n')[0].trim()} (PR ${pr[1]})` : subject];
  });
}

/** Every row of the plan's build map: `| 4 | Topic name | `lesson-id` | template | … |`. */
async function curriculum() {
  const topics = [];
  for (const line of (await fs.readFile(PLAN, 'utf8')).split('\n')) {
    const row = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*`([a-z0-9-]+)`\s*\|/);
    if (row) topics.push({ number: Number(row[1]), topic: row[2].replace(/\s*⚠+/g, '').trim(), id: row[3] });
  }
  return topics;
}

async function clipsIn(lang) {
  const files = await fs.readdir(path.join(AUDIO_DIR, lang)).catch(() => []);
  return new Set(files.filter((f) => f.endsWith('.mp3')));
}

const topics = await curriculum();
const found = new Map((await findLessons()).map((l) => [l.id, l]));
const clips = Object.fromEntries(await Promise.all(LANGS.map(async (l) => [l, await clipsIn(l)])));
const library = await readJson(LIBRARY_FILE);

async function describe(id) {
  const entry = found.get(id);
  if (!entry) return null;

  const lesson = await readJson(path.join(LESSONS_DIR, entry.file));
  const lines = [...(lesson.steps ?? []), ...(lesson.objects ?? [])].filter((h) => h.script);
  const named = lines.filter((h) => h.audio);

  // A language counts only if every narrated line has its clip.
  const spoken = LANGS.filter((l) => named.length && named.every((h) => clips[l].has(h.audio)));
  const written = LANGS.filter((l) => lines.length && lines.every((h) => h.script[l]));

  return {
    id, dir: entry.dir, template: lesson.template, stage: lesson.stage,
    steps: lesson.steps?.length ?? 0,
    minutes: ((lesson.steps ?? []).reduce((sum, s) => sum + (s.duration ?? 0), 0) / 60000).toFixed(1),
    spoken, written,
    gate: lesson.gate && !lesson.gate.signedOff ? lesson.gate.needs : null,
    // A name card says what a thing is called. A letter, a number or a counting
    // bead needs none — the card over the letter A would say "A".
    nameCards: (lesson.objects ?? []).some((o) => o.name) || (lesson.objects ?? []).every((o) => ['glyph', 'counter'].includes(o.build)),
    photoreal: (lesson.objects ?? []).some((o) => PHOTOREAL.includes(o.model)),
  };
}

const link = (l) => `[open](${BASE}?role=teacher&lesson=${l.id}${l.gate ? '&review=1' : ''})`;
const ticks = (have) => LANGS.map((l) => (have.includes(l) ? l.toUpperCase() : '··')).join(' ');

const rows = [];
for (const topic of topics) {
  const [subject, grade] = topic.id.split('-');
  rows.push({ ...topic, subject, grade, lesson: await describe(topic.id) });
}

const built = rows.filter((r) => r.lesson);
const locked = built.filter((r) => r.lesson.gate);
const out = [];
const say = (...text) => out.push(...text);

say('# Status — what is built, what is left, and how to open it', '',
  `_Generated by \`npm run content:status\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand — run the command again._`, '');

const news = await recent();
say('## The short version', '',
  `- **${built.length} of ${rows.length}** curriculum lessons are built, across **3 classes**.`,
  `- **${built.length - locked.length}** open normally. **${locked.length}** are built but **locked** until somebody signs them off.`,
  `- Narration: ${LANGS.map((l) => `${LANG_NAMES[l]} **${built.filter((r) => r.lesson.spoken.includes(l)).length}**`).join(' · ')} lessons fully spoken (of ${built.length}).`,
  `- Everything used is free: ${Object.keys(library.models).length} 3D models, ${Object.keys(library.sfx ?? {}).length} sound effects, and an offline voice engine. Credits are in \`docs/CREDITS.md\`.`, '');

if (news.length) {
  say('## What changed most recently', '', ...news.map(([date, subject]) => `- ${date} — ${subject}`), '');
}

say('## How to open a lesson', '',
  'The app is **not hosted on the internet**. It runs from this laptop.', '',
  '1. In the project folder, run `npm run serve`. Leave it running.',
  '2. Open a lesson address in Chrome. Every lesson in the tables below has an **open** link.', '',
  '| Address | What you get |', '|---|---|',
  `| \`${BASE}?role=teacher&lesson=<lesson-id>\` | The teacher's view: the lesson, with Back / Next / Pause and the words being said. Use this to review. |`,
  `| \`${BASE}?role=headset\` | The child's view, no buttons. It follows whatever the teacher's tablet is showing. |`, '',
  '| Add to the address | Does |', '|---|---|',
  '| `&lang=hi` | Narration language: `en`, `hi`, `mr` or `or`. Default is `en`. |',
  '| `&review=1` | Opens a **locked** lesson, for a reviewer. Without it a locked lesson refuses to open. |', '',
  'In the teacher view you can walk with `W A S D`, drag to look around, and scroll to zoom.', '',
  '**On a Quest headset or a tablet:** connect it to the same Wi-Fi as the laptop, and use the laptop\'s network address instead of `localhost` — `npm run serve` prints it when it starts (it looks like `http://192.168.x.x:4500/app/?role=headset`).', '');

say('## What is done', '', '### Lessons, by class and subject', '', `| Class | ${Object.values(SUBJECTS).join(' | ')} | Total |`, `|---|${'---:|'.repeat(Object.keys(SUBJECTS).length + 1)}`);
for (const [grade, name] of Object.entries(CLASSES)) {
  const cells = Object.keys(SUBJECTS).map((s) => {
    const all = rows.filter((r) => r.grade === grade && r.subject === s);
    return all.length ? `${all.filter((r) => r.lesson).length} / ${all.length}` : '–';
  });
  const all = rows.filter((r) => r.grade === grade);
  say(`| **${name}** | ${cells.join(' | ')} | **${all.filter((r) => r.lesson).length} / ${all.length}** |`);
}
say('');

const stages = (await fs.readdir(path.join(ROOT, 'app', 'stages'))).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const usedBy = (stage) => built.filter((r) => r.lesson.stage === stage).length;
say('### Lands (the places lessons happen in)', '', `${stages.length} lands. The number is how many curriculum lessons use each one.`, '',
  stages.sort((a, b) => usedBy(b) - usedBy(a)).map((s) => `\`${s}\` ${usedBy(s)}`).join(' · '), '');

say('### Narration', '', '| Language | Lines written | Clips recorded | Lessons fully spoken |', '|---|---:|---:|---:|');
for (const l of LANGS) {
  say(`| ${LANG_NAMES[l]} | ${built.filter((r) => r.lesson.written.includes(l)).length} / ${built.length} lessons | ${clips[l].size} | ${built.filter((r) => r.lesson.spoken.includes(l)).length} / ${built.length} |`);
}
say('', 'Voice: AI4Bharat Indic-TTS — free, offline, MIT licence. How it works and how to rebuild it: `docs/NARRATION.md`.', '');

const heard = Object.fromEntries(await Promise.all(LANGS.map(async (l) => [l, await listened(l)])));
say('### How good is the narration?', '',
  'Nobody on the build team can listen to four thousand clips, so a speech recogniser does (`tools/tts/check_clips.py`). It writes down what it **heard** and compares that with what the clip was **meant to say**. A low score means the voice got something wrong — or only that the recogniser spells it differently — so this is a reading list for a reviewer, not a verdict.', '',
  '| Language | Clips checked | Heard right (0.8+) | Roughly (0.6–0.8) | Listen first (under 0.6) | Checked on |', '|---|---:|---:|---:|---:|---|');
for (const l of LANGS) {
  const h = heard[l];
  say(h
    ? `| ${LANG_NAMES[l]} | ${h.total} | ${h.good} | ${h.fair} | **${h.poor}** | ${h.on}${h.stale ? ' — _older than the latest clips; run the check again_' : ''} |`
    : `| ${LANG_NAMES[l]} | not checked yet | | | | |`);
}
say('', 'For Odia the recogniser cannot help (it does not know the language); its score is only whether a clip is suspiciously short for its text.', '',
  'The full lists, worst first, are `raw/audio/review-<lang>.tsv` — open them in a spreadsheet.', '');
for (const l of LANGS) {
  if (heard[l]?.worst.length) say(`- **${LANG_NAMES[l]} — lessons with the most clips to listen to:** ${heard[l].worst.map(([id, n]) => `\`${id}\` (${n})`).join(', ')}`);
}
say('', '**Known weak spots of the free voice, and what was done:**', '',
  '- **One word on its own** ("तीन.", "five.") came out garbled. A one-word line is now spoken with a short lead-in — "Now say, three." / "अब बोलो, तीन." / "आता म्हणा, तीन." / "ଏବେ କୁହ, ତିନି." — which tested clear. The words on the teacher\'s tablet are unchanged.',
  '- **Single English letter names** (A, I, Z) are unreliable. They are respelt by ear, but the alphabet and phonics lessons are the first to listen to.',
  '- **English words inside Hindi, Marathi or Odia sentences** ("A से Apple") are spelt the way they sound in that script. A word that is not in the table is reported when narration is built.', '');

say('### The pipeline', '',
  '| Step | Command | State |', '|---|---|---|',
  '| 1. Source a free model or sound, with its licence | a `raw/<id>.meta.json` sidecar | working |',
  '| 2. Standardise (real size, on the ground, facing forward, small) | `npm run content:std` | working |',
  '| 3. Library list and credits | `content:library`, `content:credits` | working |',
  '| 4. Lands | `app/stages/*.json` | working |',
  '| 5. Lessons | `app/lessons/*.json` | working |',
  '| 6. Checks before a headset is touched | `npm run content:check` | working |',
  '| 7. Narration: translate, name, speak, fit timing | `content:translations`, `content:audio-names`, `content:narration`, `content:timing` | working |', '');

say('## What is left', '', '### Needs a person', '',
  '1. **A Marathi reader and an Odia reader** go through `raw/translations/mr.json` and `or.json`. They were written without a native speaker. Odia first.',
  '2. **Somebody listens** to the narration, starting with the alphabet and phonics lessons — single letter names are the weakest thing the free English voice does. `raw/audio/review-<lang>.tsv` lists the clips to hear first.',
  `3. **Sign-off for the ${locked.length} locked lessons** (listed below). To unlock one, set \`gate.signedOff\` to \`true\` in its lesson file.`,
  '4. **A headset test.** Frame rate and comfort cannot be measured on a laptop.', '');

const noCards = built.filter((r) => !r.lesson.nameCards && r.lesson.template !== 'explore');
const old = built.filter((r) => r.lesson.photoreal);
const silent = (l) => built.filter((r) => !r.lesson.spoken.includes(l));
say('### Needs building', '');
for (const l of LANGS) if (silent(l).length) say(`- **${LANG_NAMES[l]} narration** is missing for ${silent(l).length} lesson(s).`);
say(`- **${noCards.length} lesson(s) have no name cards** (the English + Hindi name shown over the object): ${noCards.map((r) => `\`${r.id}\``).join(', ') || 'none'}.`,
  `- **${old.length} lesson(s) still use the old photographed animals** instead of the low-poly ones: ${old.map((r) => `\`${r.id}\``).join(', ') || 'none'}.`, '');

if (locked.length) {
  say('### Locked lessons, and what each is waiting for', '', '| Lesson | Waiting for |', '|---|---|');
  for (const r of locked) say(`| ${r.topic} — \`${r.id}\` | ${r.lesson.gate} |`);
  say('');
}

say('## Every lesson', '',
  'Narration column: a language is shown only when **every** line of the lesson has its clip. `··` means not recorded yet.', '');
for (const [grade, className] of Object.entries(CLASSES)) {
  say(`### ${className}`, '');
  for (const [subject, subjectName] of Object.entries(SUBJECTS)) {
    const list = rows.filter((r) => r.grade === grade && r.subject === subject);
    if (!list.length) continue;
    say(`#### ${className} — ${subjectName} (${list.filter((r) => r.lesson).length} of ${list.length})`, '',
      '| # | Topic | Lesson id | Kind | Land | Steps | Min | Narration | State | |', '|---:|---|---|---|---|---:|---:|---|---|---|');
    for (const r of list) {
      const l = r.lesson;
      say(l
        ? `| ${r.number} | ${r.topic} | \`${r.id}\` | ${l.template} | ${l.stage} | ${l.steps} | ${l.minutes} | \`${ticks(l.spoken)}\` | ${l.gate ? '🔒 locked' : 'ready'} | ${link(l)} |`
        : `| ${r.number} | ${r.topic} | \`${r.id}\` | | | | | | **not built** | |`);
    }
    say('');
  }
}

const inPlan = new Set(topics.map((t) => t.id));
const others = [];
for (const id of found.keys()) if (!inPlan.has(id)) others.push(await describe(id));
say('## Other scenes (not curriculum topics)', '', 'Demo scenes that show off a land, and the first lessons the programme built before the curriculum list existed.', '',
  '| Lesson id | Kind | Land | |', '|---|---|---|---|', ...others.map((l) => `| \`${l.id}\` | ${l.template} | ${l.stage} | ${link(l)} |`), '');

await fs.writeFile(OUT, `${out.join('\n')}\n`, 'utf8');
console.log(`docs/STATUS.md\n  ${built.length} of ${rows.length} lessons built · ${locked.length} locked · narration ${LANGS.map((l) => `${l} ${built.filter((r) => r.lesson.spoken.includes(l)).length}`).join(', ')}`);
