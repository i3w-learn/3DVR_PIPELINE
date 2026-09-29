# Done and not done — 28 September 2026

_A plain report for Manas: what is finished, what is half finished, what is waiting on a decision. Written by hand at the end of the day; the numbers come from the checker and the files._

## 1. The narration voice

The old voice (AI4Bharat Indic-TTS, one woman per language) was rejected as irritating. The new engine is **Indic Parler-TTS**: free, open licence (Apache 2.0), runs on this laptop, no account, nothing to renew. Chosen voice: the second one on the sample page in every language, the woman.

| Language | Voice | Lines | Re-recorded | In the app (live) |
|---|---|---:|---|---|
| English | Mary | 1,197 | **yes** | **yes** |
| Hindi | Divya | 1,197 | in progress — the first run crashed in the mp3 step after 299 clips; the rest are being recorded again | partly (299 new, rest old) |
| Marathi | Sunita | 1,197 | no — still the old voice | old voice |
| Odia | Debjani | 1,197 | no — still the old voice | old voice |

Stopped on purpose after Hindi, at Manas's request, so English and Hindi can be tested first.

- Sample page to compare voices: https://i3wvr.web.app/voices.html
- To carry on with Marathi and Odia (about two hours each on this laptop, plugged in, lid open):
  ```
  node tools/build/narration.js mr --provider parler --force
  node tools/build/narration.js or --provider parler --force
  npm run content:library && npm run content:timing && npm run content:check
  ```
- To go back to the old voice for a language: `node tools/build/narration.js <lang> --provider indic --force`.
- To try the man's voice instead: `PARLER_VOICE=Rohit node tools/build/narration.js hi --provider parler --force` (Thoma, Sanjay, Manas for the others).
- Every clip is machine narration and still needs a native speaker to listen. The English single-letter names were the weakest thing in the old voice; check the alphabet sittings first.

## 2. The letter beach (alphabet lessons)

The tabletop alphabet (78 steps in one sitting, nothing moved) is replaced by five sittings on a new land, the **beach**: a huge solid letter floating in the sky, and the real things for it arriving on the sand the way they would in life.

| Sitting | Letters | Steps | Minutes | Things per letter |
|---|---|---:|---:|---|
| `eng-nur-letters-a-e` | A–E | 30 | 3.2 | 3 each |
| `eng-nur-letters-f-j` | F–J | 28 | 3.0 | 3, 3, 3, 3, 1 (J: jeep) |
| `eng-nur-letters-k-o` | K–O | 27 | 2.7 | 2, 3, 2, 2, 3 |
| `eng-nur-letters-p-t` | P–T | 28 | 3.0 | 3, 1 (Q: queen), 3, 3, 3 |
| `eng-nur-letters-u-z` | U–Z | 28 | 2.8 | 1, 2, 2, 1, 2, 2 |

Done:
- Land: white rippled sand, sea across the front that swells, foam at the water's edge, modelled palms near and far, dunes behind, shells and a starfish, shadows that fall where the sky's sun is.
- The letter: real Noto outline extruded, varnished-wood material, drops in from the sky, bobs, glows when it is the one being named.
- Arrivals: walk in, fly in, leap out of the sea (and keep leaping), fall from the palm, launch, pop. Name card appears on arrival; the animal's sound plays.
- Sharper in the headset: render scale 1.5×, 4k sky, 2k sand, per-land shadow map (3072 over 36 m), anisotropy 16.
- Twenty new real objects downloaded and credited (rocket, ice cream, kite, yarn, umbrella, violin, xylophone, nest, chess queen, helicopter, lemon, van, yak, shell, starfish, two palms, and more).
- Live at https://i3wvr.web.app/beach and in the VR lobby as "Letter beach". Pull request #28.

Not done:
- Phonics (`eng-ukg-phonics`) and the Hindi letters (`hin-ukg-swar`, `hin-ukg-vyanjan`) are still on the table. Same treatment planned, with the sunset sky already shipped for the Hindi ones.
- Letters with fewer than three things: J, K, M, N, Q, U, V, W, X, Y, Z. No free realistic model found yet for the missing ones (see the inventory).
- **No headset test yet.** Nothing in the beach or the sharpness settings has been seen through a headset. If the frame rate drops, lower the render scale first (`app/src/main.js`), then the shadow map (`app/stages/beach.json`).
- The old tabletop alphabet is kept in `app/lessons/demo/` for comparison.

## 3. Objects and lands (from the inventory)

| | Count |
|---|---:|
| Realistic objects in use | 138 |
| Still drawn, on the inventory list | 100 — 20 only need the lesson pointed at a real model already on disk, 60 have a free Sketchfab lead, 20 still to find (see `docs/OBJECT-INVENTORY.md`, pull request #27) |
| Lands realistic | 10 of 16 in use (beach joined) |
| Lands still drawn | 6: tabletop (59 lessons), home, classroom, sky, sea, snake house |

## 4. Open pull requests

- **#27** Object inventory — the hand list and the generated page.
- **#28** The letter beach — everything in section 2, plus the new voice engine and the English and Hindi re-recording.

## 5. Waiting on Manas

1. Listen to English and Hindi in the app. Say "carry on" for Marathi and Odia, or name a different voice.
2. A headset session on the beach: pixels, comfort, frame rate.
3. Merge #27 and #28 when happy.
