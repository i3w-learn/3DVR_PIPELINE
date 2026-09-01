/**
 * Gemini TTS.
 *
 * The reason this provider exists is one line in the PRD's risk table: Odia
 * narration is the project's least-validated language, with the fewest voices
 * behind it, and the fallback was always "record a human". Gemini's TTS models
 * list Odia (`or`) alongside Hindi (`hi`), Marathi (`mr`) and Bangla (`bn`) —
 * which covers every language the programme has named.
 *
 * That does not retire the human. Machine narration in a language with a thin
 * training corpus still needs a native speaker to listen to every clip before
 * it goes near a classroom; the PRD is right about that and nothing here
 * changes it. What this removes is the *blocking* dependency: lessons can ship
 * with audio and be corrected, instead of waiting on a recording studio.
 *
 * Runs at build time only. What ships is an mp3, offline, like every other
 * asset — the classroom never talks to Google.
 *
 * Needs GEMINI_API_KEY in the environment. Costs money per call.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODEL = 'gemini-3.1-flash-tts-preview';

/** The API returns raw PCM, not a container: 24 kHz, 16-bit, mono. */
const PCM = { rate: 24000, channels: 1, format: 's16le' };

export const geminiVoice = {
  name: 'gemini',
  describe: 'Gemini TTS — covers hi, mr, bn and or; needs GEMINI_API_KEY',

  /**
   * One voice per language, so a child hears the same person across a lesson.
   * The model detects the language from the text itself; the voice only picks
   * who says it.
   */
  voices: {
    en: 'Kore',
    hi: 'Kore',
    mr: 'Kore',
    or: 'Kore',
    bn: 'Kore',
  },

  /**
   * Style direction, prepended to the text.
   *
   * TTS models take instructions in the prompt rather than as parameters, and
   * the audience is the whole reason this line exists: a three-year-old
   * hearing a word for the first time needs it slower and warmer than a
   * default read.
   */
  style: 'Say this warmly and slowly, as if speaking to a small child:',

  async synthesize(text, lang, target) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set.');

    const voice = this.voices[lang];
    if (!voice) throw new Error(`No Gemini voice configured for "${lang}".`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        input: `${this.style} ${text}`,
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice }] },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini TTS ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const body = await response.json();
    const audio = findAudio(body);

    if (!audio) {
      // Fail with the actual response rather than a guess. This is a preview
      // API and its shape can move; whoever hits that should see what came
      // back, not a message about what was expected.
      throw new Error(`No audio in Gemini response: ${JSON.stringify(body).slice(0, 400)}`);
    }

    const scratch = path.join(os.tmpdir(), `gemini-${process.pid}-${Date.now()}.pcm`);

    try {
      await fs.writeFile(scratch, Buffer.from(audio, 'base64'));
      await run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', PCM.format, '-ar', String(PCM.rate), '-ac', String(PCM.channels),
        '-i', scratch,
        '-codec:a', 'libmp3lame', '-b:a', '64k',
        target,
      ]);
    } finally {
      await fs.rm(scratch, { force: true });
    }
  },
};

/**
 * Pull the base64 audio out of the response.
 *
 * The documented path is `output_audio.data`, but this is a preview API and
 * the SDKs wrap it differently from the REST shape. Rather than pin one path
 * and break on a rename, walk the object for the first base64 blob that is
 * plausibly audio — long, and under a key that says so.
 */
function findAudio(node, depth = 0) {
  if (depth > 6 || !node || typeof node !== 'object') return null;

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && value.length > 1024 && /audio|data|pcm|inline/i.test(key)) {
      return value;
    }
    if (typeof value === 'object') {
      const found = findAudio(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}
