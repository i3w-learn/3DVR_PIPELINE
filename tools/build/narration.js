#!/usr/bin/env node
/**
 * Placeholder narration, generated from the teacher's script lines.
 *
 * The engine is swappable — see `lib/tts/`. `system` is the laptop's own
 * voice: free, offline, English only, and never shippable. `gemini` covers
 * Hindi, Marathi, Bangla and Odia, costs money, and needs a key.
 *
 * Whichever is used, machine narration in a language with a thin corpus needs
 * a native speaker to listen to every clip before it reaches a classroom.
 * Odia most of all — it has the fewest voices and the least validation behind
 * it, and it is the one the PRD flags as the project's real language risk.
 *
 * The words come from `step.script[lang]`, which is the same text the teacher
 * reads aloud. So the audio and the tablet never disagree about what was said.
 *
 * Usage:
 *   node tools/build-narration.js en
 *   node tools/build-narration.js en --force
 *   node tools/build-narration.js or --provider gemini
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §3 Station 5.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { findLessons } from '../lib/lessons.js';
import { AUDIO_DIR, LESSONS_DIR, RAW_DIR, relative } from '../lib/paths.js';
import { getProvider, providerNames } from '../lib/tts/index.js';
import { spoken } from '../lib/tts/spoken.js';

async function main() {
  const [lang, ...flags] = process.argv.slice(2);
  const force = flags.includes('--force');
  const providerName = flagValue(flags, '--provider') ?? 'system';

  if (!lang) {
    console.error(
      `Usage: node tools/build-narration.js <lang> [--force] [--provider <name>]\n` +
        `Providers: ${providerNames.join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  const provider = getProvider(providerName);

  if (!provider.voices[lang]) {
    console.error(
      `"${providerName}" has no voice for "${lang}". It covers: ${Object.keys(provider.voices).join(', ')}.`
    );
    process.exitCode = 1;
    return;
  }

  const outDir = path.join(AUDIO_DIR, lang);
  await fs.mkdir(outDir, { recursive: true });

  const lines = await collectLines(lang);
  if (!lines.size) {
    console.log(`No steps carry both an "audio" filename and a "${lang}" script line.`);
    return;
  }

  // What each clip was last made from. A line that has been reworded since is
  // stale even though its file exists, and a stale clip is the worst kind of
  // wrong: the tablet says one sentence and the headset says another.
  const manifestFile = path.join(RAW_DIR, 'audio', `${lang}.json`);
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8').catch(() => '{}'));

  const todo = [];
  const unsayable = [];

  for (const [file, { text, where }] of lines) {
    const target = path.join(outDir, file);
    const say = spoken(text, lang);

    if (say.leftover.length) unsayable.push(`${file} (${where}): "${text}" — cannot say ${say.leftover.join(' ')}`);

    const current = (await exists(target)) && (manifest[file]?.spoken === say.text || (!manifest[file] && !force));
    if (current && !force) continue;

    todo.push({ file, target, text: say.text, written: text });
  }

  if (unsayable.length) {
    console.warn(`\n${unsayable.length} line(s) contain something the ${lang} voice will skip — add it to tools/lib/tts/spoken-data.js:`);
    for (const line of unsayable.slice(0, 40)) console.warn(`  ! ${line}`);
  }

  console.log(`${lines.size} line(s) in ${lang}: ${lines.size - todo.length} up to date, ${todo.length} to speak.`);

  if (todo.length) {
    if (provider.synthesizeMany) {
      await provider.synthesizeMany(todo, lang, (done, total) => {
        if (done % 50 === 0 || done === total) console.log(`  … ${done} / ${total}`);
      });
    } else {
      for (const line of todo) {
        await provider.synthesize(line.text, lang, line.target);
        console.log(`  ✓ ${line.file}  "${line.written}"`);
      }
    }

    for (const line of todo) manifest[line.file] = { written: line.written, spoken: line.text, provider: providerName };
    await fs.mkdir(path.dirname(manifestFile), { recursive: true });
    await fs.writeFile(manifestFile, `${JSON.stringify(sortKeys(manifest), null, 2)}\n`, 'utf8');
  }

  const written = todo.length;

  const caveat =
    providerName === 'system'
      ? 'Placeholder audio — replace before pilot.'
      : 'Machine narration — every clip needs native-speaker review before it ships.';

  console.log(`\n${written} clip(s) written to ${relative(outDir)} via ${providerName}. ${caveat}`);
}

/**
 * Every distinct narration file a lesson names, with the words it should say.
 *
 * Lines live in two places, because the templates differ. In `identify` the
 * lesson decides the order, so the line belongs to a step. In `explore` the
 * child decides, so the line belongs to the object it is about. Both are
 * collected here — a line the pipeline cannot see is a lesson that ships
 * silent.
 *
 * Two lessons naming the same file must mean the same words — the same cow
 * says the same sentence — so a conflict is an authoring mistake worth
 * stopping for, not something to resolve by guessing.
 */
async function collectLines(lang) {
  const lines = new Map();

  const add = (audio, text, where) => {
    if (!audio || !text) return;

    const existing = lines.get(audio);
    if (existing && existing.text !== text) {
      throw new Error(
        `${audio} is asked to say two different things:\n` +
          `  "${existing.text}"  (${existing.where})\n` +
          `  "${text}"  (${where})\n` +
          `Rename one of them.`
      );
    }

    lines.set(audio, { text, where });
  };

  // Every lesson, in whatever folder — a demo scene that names audio is a
  // scene that plays silence if nobody makes it.
  for (const { id: fileId, file } of await findLessons()) {
    const lesson = JSON.parse(await fs.readFile(path.join(LESSONS_DIR, file), 'utf8'));
    const id = lesson.id ?? fileId;

    lesson.steps?.forEach((step, i) => add(step.audio, step.script?.[lang], `${id} steps[${i}]`));
    lesson.objects?.forEach((o) => add(o.audio, o.script?.[lang], `${id} "${o.id}"`));
  }

  return lines;
}

const sortKeys = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));

const exists = (file) => fs.access(file).then(() => true).catch(() => false);

/** Read `--provider gemini` out of the flag list. */
function flagValue(flags, name) {
  const i = flags.indexOf(name);
  return i === -1 ? null : flags[i + 1];
}

// A content author running this is not debugging Node. A missing API key or a
// misspelled provider is an instruction, not a stack trace.
try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
}
