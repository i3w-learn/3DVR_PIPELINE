#!/usr/bin/env python3
"""Speak a batch of lines with AI4Bharat Indic-TTS (MIT), offline.

    indic_tts.py <lang> <jobs.json>

`jobs.json` is a list of {"text": ..., "wav": ...}. The model is loaded once
and every line is spoken with it: loading costs several seconds, a line costs
a fraction of one, and there are about a thousand lines per language.

The text must already be in its spoken form — see tools/lib/tts/spoken.js. The
model knows its own script and a little punctuation, and silently skips
everything else, which is how "2 + 3" becomes a pause.
"""
import json, sys, tempfile, pathlib, wave
import numpy as np

lang, jobs_file = sys.argv[1], sys.argv[2]
root = pathlib.Path(__file__).resolve().parents[2] / '.tts' / 'models' / lang
if not root.exists():
    sys.exit(f"No voice model for '{lang}' at {root}. Run tools/tts/setup.sh {lang} first.")

# The shipped config points at the path the model was trained under.
config = json.loads((root / 'fastpitch' / 'config.json').read_text())
speakers = str(root / 'fastpitch' / 'speakers.pth')
config['speakers_file'] = speakers
config.setdefault('model_args', {})['speakers_file'] = speakers
patched = pathlib.Path(tempfile.mkdtemp()) / 'config.json'
patched.write_text(json.dumps(config))

from TTS.utils.synthesizer import Synthesizer  # noqa: E402  (slow import, after the cheap checks)

voice = Synthesizer(
    tts_checkpoint=str(root / 'fastpitch' / 'best_model.pth'), tts_config_path=str(patched),
    tts_speakers_file=speakers,
    vocoder_checkpoint=str(root / 'hifigan' / 'best_model.pth'), vocoder_config=str(root / 'hifigan' / 'config.json'),
    use_cuda=False,
)
rate = voice.output_sample_rate

# The letters this voice was trained on. Anything else it drops without a
# word, so say so here — a clip that is quietly missing a letter is the one
# failure nobody notices until a child repeats it.
known = set(config['characters'].get('characters', '') + config['characters'].get('punctuations', '')) | {' '}

for n, job in enumerate(json.loads(pathlib.Path(jobs_file).read_text()), 1):
    strange = sorted({c for c in job['text'] if c not in known})
    if strange: print(f"! the {lang} voice has no letter {' '.join(strange)} — in: {job['text']}", flush=True)
    samples = np.asarray(voice.tts(job['text'], speaker_name='female'), dtype=np.float32)
    peak = float(np.max(np.abs(samples))) or 1.0
    pcm = (samples / peak * 0.89 * 32767).astype(np.int16)
    with wave.open(job['wav'], 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate); out.writeframes(pcm.tobytes())
    print(f"spoke {n}: {len(samples) / rate:.1f}s", flush=True)
