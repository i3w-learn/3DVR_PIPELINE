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

import { AUDIO_DIR, LESSONS_DIR, relative } from './lib/paths.js';
import { getProvider, providerNames } from './lib/tts/index.js';

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

  let written = 0;

  for (const [file, { text }] of lines) {
    const target = path.join(outDir, file);

    if (!force && (await exists(target))) {
      console.log(`  · ${file} (already there)`);
      continue;
    }

    await provider.synthesize(text, lang, target);
    written += 1;
    console.log(`  ✓ ${file}  "${text}"`);
  }

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
  const files = await fs.readdir(LESSONS_DIR).catch(() => []);
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

  for (const name of files.filter((f) => f.endsWith('.json'))) {
    const lesson = JSON.parse(await fs.readFile(path.join(LESSONS_DIR, name), 'utf8'));
    const id = lesson.id ?? name;

    lesson.steps?.forEach((step, i) => add(step.audio, step.script?.[lang], `${id} steps[${i}]`));
    lesson.objects?.forEach((o) => add(o.audio, o.script?.[lang], `${id} "${o.id}"`));
  }

  return lines;
}

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
