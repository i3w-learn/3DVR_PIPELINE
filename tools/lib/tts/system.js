/**
 * The laptop's own voice.
 *
 * Free, offline, instant — and not shippable. It exists so a lesson can be
 * heard end to end while the real narration is still being recorded, and so
 * that the rest of the pipeline can be built and tested without waiting on an
 * API key or a voice artist.
 *
 * English only, and deliberately. macOS has no Marathi or Odia voice worth
 * putting in a child's ear, and a bad voice is worse than the designed
 * default, which is the teacher reading the line herself.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const systemVoice = {
  name: 'system',
  describe: 'macOS `say` — placeholder only, never ships',

  /**
   * en_IN voices, so the accent is Indian rather than American.
   * `Tara` is the default: a woman's voice, closest to the teacher a child
   * hears the rest of the day.
   */
  voices: {
    en: 'Tara',
  },

  /** Words per minute. Slower than default — a three-year-old hearing a new word. */
  rate: 145,

  async synthesize(text, lang, target) {
    const voice = this.voices[lang];

    if (!voice) {
      throw new Error(
        `No system voice for "${lang}". Record it, or use a hosted provider ` +
          `(--provider gemini).`
      );
    }

    // `say` writes AIFF; the app wants a small file every browser can play.
    const scratch = path.join(os.tmpdir(), `narration-${process.pid}-${Date.now()}.aiff`);

    try {
      await run('say', ['-v', voice, '-r', String(this.rate), '-o', scratch, text]);
      await run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', scratch,
        '-codec:a', 'libmp3lame', '-b:a', '64k',
        target,
      ]);
    } finally {
      await fs.rm(scratch, { force: true });
    }
  },
};
