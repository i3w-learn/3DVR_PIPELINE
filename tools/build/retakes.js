#!/usr/bin/env node
/**
 * Record the bad clips again, and keep the best take of each.
 *
 * The free voice does not say a line the same way twice, and now and then a
 * take goes wrong: a second of noise where a sentence should be, a line that
 * stops half way, a three-word line that rambles on for five seconds. One in
 * twenty, roughly — which over a thousand lines is fifty clips a child would
 * hear.
 *
 * Nobody can listen to a thousand clips, but the listening check has already
 * been through them (`tools/tts/check_clips.py`, which writes
 * `raw/audio/review-<lang>.tsv`). So this reads its verdict, picks the clips
 * that are wrong in a way a machine can tell, records each of those again on
 * its own — a few takes — plays every take to the same recogniser, and keeps
 * the one that came out best. A take replaces the clip in the app only if it
 * is better than what is there.
 *
 * What it will not judge: a line the recogniser wrote down in English letters
 * ("E.C. Elephant, Hathi" for "ई से एलिफ़ेंट, हाथी"). That is the recogniser's
 * habit with borrowed words, not the voice's mistake, and the score it gives
 * such a line means nothing. Those stay on the list for a person.
 *
 * Odia is the exception: the recogniser does not know it, so for Odia only the
 * length is judged — clips cut short, and clips that ramble.
 *
 * Usage:
 *   node tools/build/retakes.js hi            three takes of each bad clip
 *   node tools/build/retakes.js hi --takes 5
 *   node tools/build/retakes.js hi --dry      only say which clips it would record
 *
 * Run `tools/tts/check_clips.py <lang>` first. Then `npm run content:library`
 * and `npm run content:timing`, as after any narration.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { AUDIO_DIR, RAW_DIR, ROOT, relative } from '../lib/paths.js';
import { parlerVoice } from '../lib/tts/parler.js';

const run = promisify(execFile);

/** Below this the recogniser heard something else than the line. */
const GOOD_ENOUGH = 0.6;
/** At or above this it heard the line, and nothing more. */
const HEARD_RIGHT = 0.8;
/** Silence the encoder adds at each end of a clip, in seconds. */
const PADDING = 0.45;
/** A clip this many times faster or slower than the usual pace is cut short, or rambling. */
const TOO_FAST = 1.9;
const TOO_SLOW = 0.45;
/** Where nothing can be heard, slow has to be slower before it counts: some lines are slow on purpose. */
const TOO_SLOW_UNHEARD = 0.33;

const PYTHON = path.join(ROOT, '.tts', 'venv', 'bin', 'python');
const LISTEN = path.join(ROOT, 'tools', 'tts', 'check_clips.py');

const letters = (text) => (text.match(/\p{L}|\p{M}/gu) ?? []).length;
const latin = (text) => (text.match(/[A-Za-z]/g) ?? []).length;

async function seconds(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(stdout) || 0;
}

/** Letters a second, once the padding is taken off. */
const pace = (text, length) => letters(text) / Math.max(0.05, length - PADDING);

async function main() {
  const [lang, ...flags] = process.argv.slice(2);
  const takes = Number(flags[flags.indexOf('--takes') + 1]) || 3;
  const dry = flags.includes('--dry');

  if (!lang) {
    console.error('Usage: node tools/build/retakes.js <en|hi|mr|or> [--takes 3] [--dry]');
    process.exitCode = 1;
    return;
  }

  // The recogniser does not know Odia. For Odia the only thing a machine can
  // tell is the length: a clip far too short for its line was cut off, one far
  // too long says more than its line. Every clip counts as "heard right", and
  // the pace alone decides.
  const deaf = lang === 'or';

  const reportFile = path.join(RAW_DIR, 'audio', `review-${lang}.tsv`);
  const manifest = JSON.parse(await fs.readFile(path.join(RAW_DIR, 'audio', `${lang}.json`), 'utf8'));
  const folder = path.join(AUDIO_DIR, lang);

  const rows = deaf
    ? Object.entries(manifest).map(([clip, entry]) => ({ clip, score: 1, heard: '', text: entry.spoken }))
    : (await fs.readFile(reportFile, 'utf8')).trim().split('\n').slice(1).map((line) => {
        const [score, clip, , heard = ''] = line.split('\t');
        return { clip, score: Number(score), heard, text: manifest[clip]?.spoken };
      }).filter((row) => row.text);

  for (const row of rows) row.seconds = await seconds(path.join(folder, row.clip));

  // The usual pace is measured on long lines. A three-word line is mostly
  // padding and breath, and says little about how fast the voice talks.
  const paces = rows.filter((r) => letters(r.text) >= 20).map((r) => pace(r.text, r.seconds)).sort((a, b) => a - b);
  const usual = paces[Math.floor(paces.length / 2)];
  // Too fast is a line cut short, and is wrong whatever was heard of it: half
  // a sentence can still score 0.8. Too slow is only wrong if something else
  // was heard as well — "Look, ma, ka, sa, da." takes its time because it is
  // five things said one by one, and the recogniser heard exactly those five.
  const offPace = (text, length, score) => {
    const p = pace(text, length) / usual;
    if (letters(text) < 6) return false;
    if (deaf) return p > TOO_FAST || p < TOO_SLOW_UNHEARD;
    return p > TOO_FAST || (p < TOO_SLOW && score < HEARD_RIGHT);
  };

  // Only a language with a script of its own can be written down in the wrong one.
  const inEnglishLetters = (heard) => lang !== 'en' && latin(heard) > letters(heard) - latin(heard);

  const bad = rows.filter((row) =>
    offPace(row.text, row.seconds, row.score) || (row.score < GOOD_ENOUGH && !inEnglishLetters(row.heard))
  );

  console.log(
    `${rows.length} clips in ${lang}; the usual pace is ${usual.toFixed(1)} letters a second.\n` +
      `${bad.length} to record again: ${bad.filter((r) => offPace(r.text, r.seconds, r.score)).length} cut short or rambling, ` +
      `${bad.filter((r) => !offPace(r.text, r.seconds, r.score)).length} misheard.`
  );
  if (dry || !bad.length) {
    for (const row of bad) console.log(`  ${row.score.toFixed(2)}  ${row.seconds.toFixed(1)}s  ${row.clip}  ${row.text}`);
    return;
  }

  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'retakes-'));
  const best = new Map(bad.map((row) => [row.clip, { ...row, file: null, fine: !offPace(row.text, row.seconds, row.score) && row.score >= GOOD_ENOUGH }]));

  process.env.PARLER_BATCH = '1';

  try {
    for (let take = 1; take <= takes; take += 1) {
      const todo = [...best.values()].filter((b) => !b.fine);
      if (!todo.length) break;

      console.log(`\nTake ${take}: ${todo.length} line(s).`);
      const lines = todo.map((b) => ({ text: b.text, target: path.join(scratch, `${take}-${b.clip}`), clip: b.clip }));
      await parlerVoice.synthesizeMany(lines, lang, (done, total) => {
        if (done % 10 === 0 || done === total) process.stdout.write(`  … ${done} / ${total}\r`);
      });

      const made = [];
      for (const line of lines) {
        if (await fs.stat(line.target).then((s) => s.size > 0, () => false)) made.push({ clip: line.target, text: line.text, name: line.clip });
      }

      let heard;
      if (deaf) {
        heard = [];
        for (const job of made) heard.push({ ...job, heard: '', score: 1, seconds: await seconds(job.clip) });
      } else {
        const jobsFile = path.join(scratch, `heard-${take}.json`);
        await fs.writeFile(jobsFile, JSON.stringify(made));
        await run(PYTHON, [LISTEN, lang, '--clips', jobsFile], { maxBuffer: 64 * 1024 * 1024 });
        heard = JSON.parse(await fs.readFile(jobsFile, 'utf8'));
      }

      let better = 0;
      for (const candidate of heard) {
        const current = best.get(candidate.name);
        const wrongPace = offPace(candidate.text, candidate.seconds, candidate.score);
        const currentWrongPace = offPace(current.text, current.seconds, current.score);

        // A clip at the right pace beats one that is not, whatever the scores
        // say: noise can score a lucky 0.2, half a sentence can score 0.6.
        const wins = wrongPace !== currentWrongPace ? !wrongPace : candidate.score > current.score;
        if (!wins) continue;

        better += 1;
        best.set(candidate.name, {
          ...current,
          score: candidate.score,
          heard: candidate.heard,
          seconds: candidate.seconds,
          file: candidate.clip,
          fine: !wrongPace && candidate.score >= GOOD_ENOUGH,
        });
      }
      console.log(`\n  ${better} better than what was there.`);
    }

    let replaced = 0;
    for (const chosen of best.values()) {
      if (!chosen.file) continue;
      await fs.copyFile(chosen.file, path.join(folder, chosen.clip));
      replaced += 1;
    }

    // The reading list says what is in the app now, not what was there before.
    // (Odia's list is lengths, not what was heard: run check_clips.py again.)
    if (!deaf) {
      const updated = rows.map((row) => best.get(row.clip) ?? row).sort((a, b) => a.score - b.score || a.clip.localeCompare(b.clip));
      await fs.writeFile(
        reportFile,
        'score\tclip\ttext spoken\theard\n' + updated.map((r) => `${r.score.toFixed(2)}\t${r.clip}\t${r.text}\t${r.heard}\n`).join('')
      );
    }

    const still = [...best.values()].filter((b) => !b.fine);
    console.log(
      `\n${replaced} clip(s) replaced in ${relative(folder)}. ` +
        (still.length
          ? `${still.length} still not right after ${takes} take(s) — a person should hear these:`
          : 'Every one of them came out right.')
    );
    for (const row of still) console.log(`  ${row.score.toFixed(2)}  ${row.clip}  ${row.text}  →  ${row.heard}`);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
