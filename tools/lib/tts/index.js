/**
 * Text to speech, as a swappable part.
 *
 * The narration engine is the one piece of this pipeline guaranteed to be
 * replaced. Today it is the laptop's system voice, which is a placeholder;
 * tomorrow it is a hosted Indic model, a voice artist's recordings, or
 * something that does not exist yet. The field moves on roughly a six-month
 * cycle, and `vr-content`'s own guidance is explicit: treat the generation
 * model as a swappable component, never a load-bearing assumption.
 *
 * So nothing above this line knows how speech is made. A provider implements
 * one method, and `build-narration.js` calls it without caring which one it
 * got. Swapping engines is one flag, not a rewrite.
 */

import { systemVoice } from './system.js';
import { geminiVoice } from './gemini.js';
import { indicVoice } from './indic.js';

const PROVIDERS = {
  [systemVoice.name]: systemVoice,
  [geminiVoice.name]: geminiVoice,
  [indicVoice.name]: indicVoice,
};

/**
 * @param {string} name
 * @returns {{name: string, describe: string, voices: object, synthesize: Function}}
 */
export function getProvider(name) {
  const provider = PROVIDERS[name];

  if (!provider) {
    throw new Error(`Unknown TTS provider "${name}". Known: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  return provider;
}

export const providerNames = Object.keys(PROVIDERS);
