#!/usr/bin/env python3
"""
Indic Parler-TTS — the second offline voice engine.

AI4Bharat's Indic-TTS (indic_tts.py) was the first: free, offline, and it
spoke all four languages. It also sounded like a machine, and Manas found the
voice grating — a voice a child hears all day has to be one an adult can bear.

Indic Parler-TTS is AI4Bharat's newer engine, built with Hugging Face on
1,800 hours of Indian speech. Same terms — free, Apache-2, runs on this
laptop — and it speaks in named voices that native listeners rated far more
natural, and it takes a plain-English description of HOW to speak: slowly,
clearly, warmly. That description is most of what this file does.

Called by tools/lib/tts/parler.js, never by hand:

    python indic_parler.py <lang> <jobs.json> [--voice Divya] [--caption "..."]

jobs.json is a list of {text, wav}. Lines that come out empty are reported
on stdout with a leading '!' so the caller can say so.
"""

import json
import sys
import warnings

warnings.filterwarnings("ignore")

# AI4Bharat's own repo sits behind a click-through gate that needs a Hugging
# Face login. The weights are Apache-2.0, and an open, complete copy of the
# same files is published without the gate; that is what downloads here, so a
# fresh laptop can set itself up with no account. Credit stays with AI4Bharat.
MODEL = "RXD03/indic-parler-tts"

# The voices the model card recommends for each language, woman first.
# A child in this programme hears a woman's voice the rest of the day.
VOICES = {
    "en": ["Mary", "Thoma"],
    "hi": ["Divya", "Rohit"],
    "mr": ["Sunita", "Sanjay"],
    "or": ["Debjani", "Manas"],
}

# How to speak. The model reads this as instructions. "Slowly" and "clearly"
# are for three-year-olds; "very high quality, no background noise" is what
# the model card says to write to get its cleanest output.
CAPTION = (
    "{voice} speaks slowly and very clearly in a warm, calm, friendly voice, "
    "like a kind teacher talking to small children, with a moderate pitch and "
    "slight expressiveness. The recording is very high quality with no "
    "background noise."
)


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print("usage: indic_parler.py <lang> <jobs.json> [--voice NAME] [--caption TEXT]", file=sys.stderr)
        sys.exit(2)
    lang, jobs_file = args[0], args[1]
    voice = None
    caption = None
    i = 2
    while i < len(args):
        if args[i] == "--voice":
            voice = args[i + 1]
            i += 2
        elif args[i] == "--caption":
            caption = args[i + 1]
            i += 2
        else:
            i += 1

    voice = voice or VOICES.get(lang, ["Mary"])[0]
    caption = caption or CAPTION.format(voice=voice)

    import torch
    import soundfile as sf
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    # Apple's GPU when it is there. The model is small enough for the CPU
    # too, at a few seconds a line, which is fine for a batch run overnight.
    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    try:
        model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
    except Exception:  # noqa: BLE001 — any device trouble: fall back, do not die
        device = "cpu"
        model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
    model.eval()

    tokenizer = AutoTokenizer.from_pretrained(MODEL)
    description_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    description = description_tokenizer(caption, return_tensors="pt").to(device)

    jobs = json.load(open(jobs_file, encoding="utf-8"))
    rate = model.config.sampling_rate

    for job in jobs:
        text = job["text"].strip()
        prompt = tokenizer(text, return_tensors="pt").to(device)
        with torch.no_grad():
            try:
                out = model.generate(
                    input_ids=description.input_ids,
                    attention_mask=description.attention_mask,
                    prompt_input_ids=prompt.input_ids,
                    prompt_attention_mask=prompt.attention_mask,
                )
            except RuntimeError:
                if device == "cpu":
                    raise
                # The GPU path can trip on an odd length; do this one on the CPU.
                model.to("cpu")
                out = model.generate(
                    input_ids=description.input_ids.cpu(),
                    attention_mask=description.attention_mask.cpu(),
                    prompt_input_ids=prompt.input_ids.cpu(),
                    prompt_attention_mask=prompt.attention_mask.cpu(),
                )
                model.to(device)
        audio = out.cpu().numpy().squeeze()
        if audio.ndim == 0 or audio.size < rate // 20:
            print(f"! nothing came out for: {text}")
        sf.write(job["wav"], audio, rate)
        print(f"ok {job['wav']}")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
