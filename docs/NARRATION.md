# Narration

Every line a lesson says is spoken in four languages: English, Hindi, Marathi
and Odia. This page says how the audio is made, what it costs (nothing), and
what still has to happen before a child hears it.

## The short version

```bash
bash tools/tts/setup.sh            # once: the voice engine, ~6 GB, no account needed
npm run content:translations       # fill Marathi and Odia text into the lessons
npm run content:audio-names        # give every line a file name
node tools/build/narration.js hi --provider indic    # speak one language (en, hi, mr, or)
npm run content:timing             # make each step last as long as its sentence
npm run content:build              # library, credits, index, and the checks
```

To hear a lesson in a language, add it to the address: `?lesson=eng-nur-birds&lang=mr`.

## Where the voice comes from

**AI4Bharat Indic-TTS** — open voice models from IIT Madras, MIT licence. They
run on the laptop. Nothing is sent to a server, there is no API key and no bill.
It is the only engine we found that is free, may be shipped, and has a voice for
all four languages.

What we did *not* use, and why:

| Engine | Why not |
|---|---|
| The Mac's own voice (`say`) | Hindi and English only, and we could not confirm that Apple's licence allows shipping its voices in a product. It stays as a placeholder (`--provider system`). |
| Google / Microsoft / Gemini | Cost money per character, or are unofficial endpoints we have no right to build a product on. |
| Meta MMS | Free, but licensed for non-commercial use only. |

The engine is a Python program and about 1.5 GB of model per language, so it
lives in `.tts/`, which git ignores. `tools/tts/setup.sh` rebuilds it on any
machine.

## What is written down, and what is said

The line on the teacher's tablet is written to be read: `2 + 3 = 5`, `A से
Apple — सेब`. A voice model skips anything outside its own alphabet, silently.
So before a line is spoken it is turned into its **spoken form**
(`tools/lib/tts/spoken.js`): digits become number words, `+` becomes "plus" in
the right language, an English word inside a Hindi sentence is spelt the way it
sounds, and a Hindi letter inside an Odia sentence is written in Odia script.
The lesson file is never changed.

Two things the free voice does badly, and what the spoken form does about them:

- **One word on its own.** "तीन." came back from the recogniser as "बीम", and
  "five." as "bye". With a few words of run-up the same number is clear, so a
  one-word line is spoken with a lead-in — "Now say, three." / "अब बोलो, तीन." —
  which is also what a teacher does when she holds up a card.
- **Letters it was never taught.** The English voice has no capital X, the
  Marathi voice no ॲ, and the Odia voice knows ଡ଼ only as one joined letter, not
  as a letter plus a dot. Each is rewritten into something the voice knows. The
  engine prints any letter it is about to skip — read that output; a full run's
  warnings scroll past, and that is how 226 Odia clips said ବଡ for ବଡ଼.

If a line still contains something the voice cannot say, the narration tool
prints it. Add the word to `tools/lib/tts/spoken-data.js` and run again.

## Translations

Lessons are written in English and Hindi. Marathi and Odia come from two
tables, `raw/translations/mr.json` and `raw/translations/or.json`: English
sentence → translation. One table per language, not a line per lesson, because
"This is a cow." appears in six lessons and should be corrected once.

`npm run content:translations` fills any line a lesson is missing. It never
overwrites a line that is already there.

## Keeping audio and text the same

`raw/audio/<lang>.json` records what each clip was made from. Change a
sentence and the narration tool notices the clip is out of date and speaks it
again; clips whose text has not changed are left alone.

## Before a child hears it — this is not optional

This is machine narration, and **the Marathi and Odia text was written without
a native speaker in the room.** Three checks, in this order:

1. **A native speaker reads the two translation tables.** Odia first: it is the
   language with the least data behind it, in the voice model and in the
   translation. Fix the table, run `content:translations -- --refresh`, then
   speak the language again.
2. **The reading list.** `tools/tts/check_clips.py <lang>` plays every clip to
   a speech recogniser and writes `raw/audio/review-<lang>.tsv`, worst match
   first. A low score is not a verdict — the recogniser spells things its own
   way — but those are the clips to listen to first. (The recogniser does not
   know Odia; for Odia the list is clips that are suspiciously short.)
3. **Somebody listens**, in a headset, to at least one whole lesson per subject
   in each language.

A clip that is wrong is worse than no clip: with no clip, the teacher reads the
line aloud, which is how the programme was designed to work in the first place.
To fall back to that for one line, delete its `audio` name from the lesson.
