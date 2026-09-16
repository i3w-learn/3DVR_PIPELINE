# VR Learning — content pipeline and app

A teacher-led VR classroom for children aged 3–6.

**Start with [`HOW-IT-WORKS.md`](HOW-IT-WORKS.md)** — what this is
built from and what happens between downloading a model and a child meeting a
cow. Everything else in `docs/`:

| | |
|---|---|
| [`VR-Learning-PRD.md`](VR-Learning-PRD.md) | the product — what and why |
| [`HOW-IT-WORKS.md`](HOW-IT-WORKS.md) | the tour — stack and flow |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | code layout and the rules that keep it |
| [`CONTENT-ARCHITECTURE.md`](CONTENT-ARCHITECTURE.md) | library, stage and lesson kept apart |
| [`CONTENT-CREATION-PIPELINE.md`](CONTENT-CREATION-PIPELINE.md) | the six stations, with schemas |
| [`IMPLEMENTATION-NOTES.md`](IMPLEMENTATION-NOTES.md) | where the code differs from the docs, and every bug that cost real time |

## Run it

```bash
npm install
npm run serve
```

The raw downloads in `/raw` are not in the repository — 300 MB of source
models, all re-fetchable. What *is* committed is their sidecars, which record
the source, licence and every processing parameter, so any model can be pulled
again and rebuilt identically. `app/assets/` holds the processed output, which
is what ships.

Use `npm run serve`, not `python3 -m http.server`. The Python one sends no
cache headers, so the browser keeps stale copies of your lessons and your
components — you edit a file, reload, and see the old one. That cost real time
here before it was diagnosed.

| URL | Role |
|---|---|
| `http://localhost:4500/app/?role=teacher` | tablet — the lesson plus the control bar |
| `http://localhost:4500/app/?role=headset` | headset — the world, no overlay |

Add `&lang=hi` to switch narration language, `&lesson=<id>` to pick a lesson.

In the **teacher** role you can walk: `W A S D` or the arrow keys, drag to look,
tap an animal to hear it. Walking is a review tool and exists in this role only
— the child in the headset stays seated, per the PRD. It is how you check that
the goat is the right size and the hen is not standing in the fence.

On a Quest, replace `localhost` with the laptop's LAN address and open it in the
Quest Browser. **Always serve over HTTP** — models and textures will not load
from `file://`, and a black sky is almost always this.

## The content pipeline

Work moves left to right. A station never reaches into a later one.

```
download ──▶ raw/ ──▶ standardise ──▶ app/assets/ ──▶ library.json ──▶ validate
```

```bash
npm run content:std              # raw/  →  app/assets/models/*.glb
npm run content:textures         # raw/textures/  →  app/assets/textures/
npm run content:hdri             # raw/hdri/*.hdr  →  app/assets/hdri/*.jpg
npm run content:library          # measure everything  →  app/assets/library.json
npm run content:credits          # library.json  →  docs/CREDITS.md
npm run content:check            # validate every lesson against the library
npm run content:build            # library + credits + check

node tools/build/narration.js en                    # laptop voice, English
node tools/build/narration.js or --provider gemini  # needs GEMINI_API_KEY
```

### Pulling a model from Sketchfab

The only source with rigged, textured animals under a licence this programme
can ship. Needs a free API token (Sketchfab → Settings → Password & API).

```bash
SKETCHFAB_TOKEN=… node tools/fetch/sketchfab.js <uid> <id> <heightInMetres> [clips…]
```

It writes the sidecar with the author and licence recorded, and refuses
anything non-commercial before downloading it.

### Adding a model

1. Download a CC0 model into `raw/` as `cow.glb`, lowercase and one word.
2. Write `raw/cow.meta.json` beside it:

```json
{
  "id": "cow",
  "source": "Quaternius — Ultimate Animated Animals",
  "licence": "CC0",
  "url": "https://quaternius.com/...",
  "targetHeight": 1.5,
  "yaw": 0,
  "keepClips": ["Idle", "Walk"]
}
```

| Field | What it does |
|---|---|
| `targetHeight` | real size in metres — a cow is 1.5, a hen 0.4, a tree 4.5 |
| `fit` | `"height"` (default) or `"longest"`. Use `longest` for anything that lies flat: a boulder 4 m across and 1 m tall scaled to "1 m tall" becomes the size of a car |
| `yaw` | degrees to turn the model so it faces +Z |
| `keepClips` | clips a lesson will actually play. Dropping the rest takes a cow from 1.6 MB to 0.2 MB — the largest single lever on bundle size |
| `palette` | material name → `#rrggbb`, to bring a pack into the house colours. Every material in the model must be covered |
| `metallic` | `true` opts out of the flat non-metal art style. Almost nothing should |

Licences: `CC0` and `CC-BY` ship. Anything else — CC-BY-NC especially — is
rejected at intake, because it does not cover delivery to a funded programme.

3. `npm run content:std && npm run content:build`

### Adding a lesson

Write `app/lessons/<subject>-<class>-<topic>.json`, then `npm run content:check`.
The validator will not let a lesson name a model that does not exist, a clip a
model does not have, or a scene that breaks the budget.

## What is not built yet

- Four of the five templates (`count`, `match`, `sequence`, `explore`)
- `MqttTransport` — the app currently runs on `LocalTransport`, in one page
- The status strip, and the headset's Connect waiting screen
- Service worker, PWA manifest, Bubblewrap packaging (PRD Phase 0)

## What is in the library

Ten models, all used by a lesson. Nothing is kept "just in case" — an unused
asset is weight in the bundle and a licence to audit for nothing.

| From | What |
|---|---|
| Sketchfab (CC-BY) | cow, horse, goat, sheep, hen, elephant, shed |
| Poly Haven (CC0) | tree (photoscan), sky (HDRI) |
| ambientCG (CC0) | grass — colour, normal, roughness, AO |
| Openverse (CC0/CC-BY) | six animal sounds |
| Kenney (CC0) | fence, rock |

`CREDITS.md` is generated from the library and lists every attribution.

## Placeholder content, to be replaced before the pilot

| What | Why it is a placeholder |
|---|---|
| `app/assets/textures/grass.jpg` | generated noise; replace with a CC0 texture from ambientCG |
| `app/assets/audio/en/*.mp3` | macOS system voice; real narration is a person or a self-hosted Indic TTS model, with native-speaker review |
| `yaw: 0` in every sidecar | not yet checked by eye on a headset |
