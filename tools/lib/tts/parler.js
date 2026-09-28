/**
 * Indic Parler-TTS — free, offline, and a voice an adult can bear.
 *
 * The first offline engine (`indic`) spoke all four languages and sounded like
 * a machine; Manas found it grating, and a voice a child hears all day is
 * heard by the teacher all day too. This is AI4Bharat's newer engine, made
 * with Hugging Face: same terms — free, Apache-2, runs on this laptop, no
 * account, no key, nothing to renew — and it speaks in named voices that
 * native listeners rated far more natural, and takes a plain-English
 * description of how to speak. The description lives in the Python script.
 *
 * Runs in its own Python environment (`.tts/venv-parler`, made by
 * `tools/tts/setup.sh`) because it pins a different transformers than the
 * first engine does.
 *
 * Choosing a voice: `PARLER_VOICE=Rohit node tools/build/narration.js hi
 * --provider parler`. Without it, the woman's voice the model card recommends.
 * `PARLER_CAPTION` replaces the whole how-to-speak description.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { ROOT } from '../paths.js';

const run = promisify(execFile);

const ENGINE = path.join(ROOT, '.tts');
const PYTHON = path.join(ENGINE, 'venv-parler', 'bin', 'python');
const SCRIPT = path.join(ROOT, 'tools', 'tts', 'indic_parler.py');

/** The model card's recommended voices, woman first. */
export const PARLER_VOICES = {
  en: ['Mary', 'Thoma'],
  hi: ['Divya', 'Rohit'],
  mr: ['Sunita', 'Sanjay'],
  or: ['Debjani', 'Manas'],
};

export const parlerVoice = {
  name: 'parler',
  describe: 'AI4Bharat Indic Parler-TTS — free, offline, Apache-2; en, hi, mr, or; named voices',

  voices: { en: 'Mary', hi: 'Divya', mr: 'Sunita', or: 'Debjani' },

  async synthesize(text, lang, target) {
    await this.synthesizeMany([{ text, target }], lang);
  },

  /**
   * Whole batches, because loading the model costs seconds and a line costs
   * a few; the Python side loads once and works through jobs.json.
   */
  async synthesizeMany(lines, lang, progress = () => {}, { voice, caption } = {}) {
    await fs.access(PYTHON).catch(() => {
      throw new Error('Indic Parler-TTS is not installed. Run: bash tools/tts/setup.sh');
    });

    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'parler-'));

    try {
      const jobs = lines.map((line, i) => ({ text: line.text, wav: path.join(scratch, `${i}.wav`) }));
      await fs.writeFile(path.join(scratch, 'jobs.json'), JSON.stringify(jobs));

      const args = [SCRIPT, lang, path.join(scratch, 'jobs.json')];
      const chosen = voice ?? process.env.PARLER_VOICE;
      const said = caption ?? process.env.PARLER_CAPTION;
      if (chosen) args.push('--voice', chosen);
      if (said) args.push('--caption', said);

      // The model is behind a free click-through gate on Hugging Face, so the
      // download needs a token. It lives in the git-ignored .env with the
      // other keys; Python's hub client reads HF_TOKEN from the environment.
      const env = { ...process.env, ...(await dotenv()) };
      const { stdout } = await run(PYTHON, args, { maxBuffer: 64 * 1024 * 1024, env });

      // Lines that came out as silence get a second go, one at a time: a
      // batch pads every line to the longest, and now and then a short line
      // in a long batch comes out empty. On its own it does not.
      const empties = stdout.split('\n').filter((l) => l.startsWith('! empty ')).map((l) => l.slice(8).trim());
      if (empties.length) {
        console.warn(`\n${empties.length} line(s) came out empty; recording them again one by one.`);
        const retry = jobs.filter((j) => empties.includes(j.wav));
        await fs.writeFile(path.join(scratch, 'retry.json'), JSON.stringify(retry));
        const again = [SCRIPT, lang, path.join(scratch, 'retry.json'), ...args.slice(3)];
        await run(PYTHON, again, { maxBuffer: 64 * 1024 * 1024, env }).catch((e) => console.warn(`retry failed: ${e.message}`));
      }

      // The same finishing as the other engines — a short lead-in so the first
      // syllable is not clipped, a tail, one loudness for every clip — after
      // trimming the silence the model leaves at both ends. Lines are spoken
      // several at a time, padded to the longest, and the padding comes out
      // as up to two seconds of nothing before a short line.
      //
      // One clip the encoder chokes on must not lose the other thousand: a
      // failure is retried plainly, and if that fails too the line is
      // reported and skipped, so the run finishes and the manifest is written.
      const trim = 'silenceremove=start_periods=1:start_silence=0.12:start_threshold=-40dB';
      const failed = [];
      for (const [i, line] of lines.entries()) {
        const encode = (filter) => run('ffmpeg', [
          '-y', '-loglevel', 'error', '-i', jobs[i].wav, '-af', filter,
          '-ac', '1', '-ar', '22050', '-codec:a', 'libmp3lame', '-b:a', '40k', line.target,
        ]);
        try {
          await encode(`${trim},areverse,${trim},areverse,adelay=200,apad=pad_dur=0.25,afade=t=in:d=0.05,loudnorm=I=-19:TP=-2`);
        } catch {
          try {
            await encode('adelay=200,apad=pad_dur=0.25,volume=-3dB');
          } catch (error) {
            failed.push(line.target);
            console.warn(`could not encode ${path.basename(line.target)}: ${error.message.split('\n')[0]}`);
          }
        }
        progress(i + 1, lines.length);
      }
      if (failed.length) console.warn(`\n${failed.length} clip(s) were not written; run again without --force to fill them.`);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  },
};


/** HF_TOKEN (and anything else) from .env, without a dependency. Missing file: nothing. */
async function dotenv() {
  const text = await fs.readFile(path.join(ROOT, '.env'), 'utf8').catch(() => '');
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !m[1].startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
