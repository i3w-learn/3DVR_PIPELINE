/**
 * AI4Bharat Indic-TTS — open models from IIT Madras, run on this laptop.
 *
 * The one engine that is free, offline, MIT-licensed, and has a voice for all
 * four languages the programme ships: Indian English, Hindi, Marathi and Odia.
 * Nothing is sent anywhere and there is no key, no quota and no bill.
 *
 * It lives outside Node: a Python environment and about 1.5 GB of model per
 * language, in `.tts/` (ignored by git; `tools/tts/setup.sh` rebuilds it). So
 * this provider speaks in batches — loading a voice takes seconds, a line takes
 * a fraction of one, and a language has about a thousand lines.
 *
 * Machine narration is still machine narration. Every clip wants a native
 * speaker's ear before a child hears it, Odia most of all.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { ROOT } from '../paths.js';

const run = promisify(execFile);

const ENGINE = path.join(ROOT, '.tts');
const PYTHON = path.join(ENGINE, 'venv', 'bin', 'python');
const SCRIPT = path.join(ROOT, 'tools', 'tts', 'indic_tts.py');

export const indicVoice = {
  name: 'indic',
  describe: 'AI4Bharat Indic-TTS — free, offline, MIT; en, hi, mr, or',

  /** One woman's voice per language: the voice a child hears the rest of the day. */
  voices: { en: 'female', hi: 'female', mr: 'female', or: 'female' },

  async synthesize(text, lang, target) {
    await this.synthesizeMany([{ text, target }], lang);
  },

  /**
   * @param {{text: string, target: string}[]} lines  text already in spoken form
   * @param {string} lang
   * @param {(done: number, total: number) => void} [progress]
   */
  async synthesizeMany(lines, lang, progress = () => {}) {
    await fs.access(PYTHON).catch(() => {
      throw new Error('The voice engine is not installed. Run: bash tools/tts/setup.sh');
    });

    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'narration-'));

    try {
      const jobs = lines.map((line, i) => ({ text: line.text, wav: path.join(scratch, `${i}.wav`) }));
      await fs.writeFile(path.join(scratch, 'jobs.json'), JSON.stringify(jobs));

      const { stdout } = await run(PYTHON, [SCRIPT, lang, path.join(scratch, 'jobs.json')], { maxBuffer: 64 * 1024 * 1024 });

      // Letters the voice does not know are skipped in silence; pass the
      // engine's complaints on rather than swallowing them with the rest.
      const complaints = stdout.split('\n').filter((line) => line.startsWith('!'));
      if (complaints.length) console.warn(`\n${complaints.length} line(s) have a letter this voice will skip:\n${complaints.slice(0, 30).join('\n')}\n`);

      // Small, mono, and playable everywhere. A quarter-second of quiet at each
      // end and a short fade in: no clip in this programme starts abruptly.
      for (const [i, line] of lines.entries()) {
        await run('ffmpeg', [
          '-y', '-loglevel', 'error', '-i', jobs[i].wav,
          '-af', 'adelay=200,apad=pad_dur=0.25,afade=t=in:d=0.05,loudnorm=I=-19:TP=-2',
          '-ac', '1', '-ar', '22050', '-codec:a', 'libmp3lame', '-b:a', '32k',
          line.target,
        ]);
        progress(i + 1, lines.length);
      }
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  },
};
