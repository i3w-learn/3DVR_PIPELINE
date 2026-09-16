# How it works

A tour of the whole thing: what it is built from, where each piece lives, and
what happens between downloading a model and a child in a headset meeting a cow.

Written for somebody joining the project. For the *why* behind product
decisions see `VR-Learning-PRD.md`; for the code layout see `ARCHITECTURE.md`;
for the mistakes and their fixes see `IMPLEMENTATION-NOTES.md`.

---

## 1. The one idea

**Two computers, and they only ever meet as files.**

```
   YOUR LAPTOP                             THE CLASSROOM
   ───────────                             ─────────────
   download models                         opens files
   fix them, measure them, check them      no internet
   write lessons as JSON                   no tools
   fail the build if anything is wrong     no Node
          │                                       ▲
          └───────────  the /app folder  ─────────┘
```

Anything that can be decided on a laptop is decided on a laptop. The classroom
only ever *plays* what was already checked. A rural Anganwadi centre has no
reliable internet, so there is nothing to call and nothing to wait for.

---

## 2. What we use

### Runs in the classroom

| | What | Why this one |
|---|---|---|
| Scene | **A-Frame** | 3D as HTML tags. Chosen because it is the most reliable thing an LLM writes, and the team are web developers. |
| Renderer | **three.js** | Already inside A-Frame. Reached directly only where A-Frame exposes nothing — tone mapping, shadow settings, skinned-vertex maths. |
| Language | **HTML + JavaScript** | No build step. What is in the folder is what ships. |
| Content | **JSON** | A lesson is data. Adding one needs no developer. |
| Models | **glTF / .glb** | An open standard, read natively by browsers. Not a game-engine format. |

No React, no TypeScript, no bundler, no server, no database. The whole product
is a folder of files a browser opens.

### Runs on the laptop only

| | What | For |
|---|---|---|
| Runtime | **Node.js** | The pipeline scripts. None of this ships. |
| Models | **@gltf-transform** | Read, fix and write glTF. |
| | **meshoptimizer** | Decimation — a photoscanned tree arrives at 1.6 M triangles. |
| | **draco3dgltf** | Geometry compression. |
| Images | **sharp** | Texture resize and re-encode. |
| Audio | **ffmpeg** | Format conversion and loudness. |
| Speech | macOS `say`, or **Gemini TTS** | Placeholder narration, swappable. |

**Why Node and not Python:** `gltf-transform` is the best glTF library there
is and it is JavaScript. Using it keeps the whole project in one language, so
anyone can work on either side. And `npm install` is the only setup — no
Blender, no Unity.

### Where assets come from

| Source | What we take | Licence |
|---|---|---|
| **Sketchfab** | every animal, and the shed | CC-BY |
| **Poly Haven** | the tree (photoscan), the sky (HDRI) | CC0 |
| **ambientCG** | the grass — colour, normal, roughness, AO | CC0 |
| **Openverse** | six animal sounds | CC0 / CC-BY |
| **Kenney** | fence, rock | CC0 |

Sketchfab is the only place with rigged, textured animals under a licence a
funded programme can ship. It is also the only one needing a key.

**CC0 was never required.** CC-BY works too — it costs a credit, not money —
and dropping the CC0-only rule is what made realistic animals possible at all.
`docs/CREDITS.md` is generated from the library, so an asset cannot be in the
build and missing from the credits. CC-BY-**NC** is refused at download.

---

## 3. The laptop side, station by station

```
 download ──▶ /raw ──▶ standardise ──▶ /app/assets ──▶ library.json ──▶ validate
```

### 1 — Bring a model in

```bash
SKETCHFAB_TOKEN=… node tools/fetch/sketchfab.js <uid> realcow 1.45
```

Downloads into `raw/realcow/` and writes a **sidecar**, `raw/realcow.meta.json`.
The sidecar holds what the file itself cannot say: who made it, its licence,
how tall the animal really is, which clips to keep. A non-commercial licence is
refused *before* downloading, so nobody later finds it in `/raw` and assumes it
was cleared.

`/raw` is committed and never shipped. It is the audit trail: when a model
looks wrong the question is always "what did we start with".

### 2 — Standardise

```bash
npm run content:std
```

Nine passes, in this order, and the order matters:

| | Pass | Why |
|---|---|---|
| 1 | drop unwanted branches | one chicken pack ships a roast chicken too |
| 2 | decimate | 1.6 M triangles against a 150 k scene budget |
| 3 | **the contract** — 1 unit = 1 m, feet at y=0, facing +Z | so every model can be placed by identical code |
| 4 | drop unused clips | thirteen shipped, two needed |
| 5 | smooth normals | flat shading shows every triangle |
| 6 | fix materials — metalness, palette, alpha mode | packs arrive in their own house style |
| 7 | cap textures at 1024, re-encode to WebP | a PNG is several times the size |
| 8 | Draco compression | smaller geometry |
| 9 | re-measure what was written | ship what was measured, not what was intended |

Steps 2 and 3 are in that order deliberately: decimating moves vertices, so
scaling first leaves the height slightly wrong.

### 3 — Generate the library

```bash
npm run content:library
```

Reads `/app/assets` and writes `library.json`: height, footprint, triangles,
draw-call proxy, bytes, clip names, rigged or not, source, licence.

**It is generated, never written.** A hand-kept catalogue drifts from disk
within a month and then lies. This one cannot.

### 4 — Write content

Two kinds of JSON, and they are separate on purpose:

- **`app/stages/farmyard.json`** — the land. Ground, sky, light, fog, and the
  props dressed onto it. Two kits dress all eleven planned lessons.
- **`app/lessons/evs-lkg-farm-yard.json`** — the teaching. Which animals, where,
  doing what, saying what.

### 5 — Check

```bash
npm run content:build      # library + credits + validate
```

Fourteen rules. Does the model exist? Does that clip exist on *that* model?
Does the sound exist? Do the triangles fit? Is every licence recorded?

**If a laptop can catch it, a laptop catches it.** The only number that needs a
headset is frame rate.

---

## 4. The classroom side

### One shell, never reloaded

Navigating to a new page destroys the WebXR session and drops the child back to
the headset's home screen. So there is one `index.html`, no router, no reload. A
lesson is data fetched into the running page.

### Two roles, one build

```
?role=teacher                          ?role=headset
─────────────                          ─────────────
flat screen + control bar              immersive, no overlay
owns the clock                         owns nothing
publishes "step 3"    ─────────────▶   listens, obeys
walking enabled (review only)          seated, camera never moves
```

### What happens when a child picks an animal

```
1.  gaze rests on it for 800 ms  (or the teacher taps)
2.  ray hits the animal's hit box
3.  yellow ring appears underneath
4.  the animal makes its own sound
5.  it turns and walks over, stopping a polite distance short
6.  on arrival it stands, and the narration explains it
```

Step 5 is the point. Watching a cow decide to come over is a different thing
from being told about a cow, and for a child who cannot read it is most of what
makes the moment land.

### The parts, and the one job each has

| Component | Job |
|---|---|
| `lesson-sync` | turn messages into a scene |
| `sky-environment` | the captured sky, and all the light that comes off it |
| `pbr-ground` | grass — colour, normal, roughness, and no visible tiling |
| `scene-look` | tone mapping and shadows |
| `wander` | roaming, and coming when called |
| `seat-on-ground` | feet on the grass |
| `tap-target` | a box a ray can actually hit |
| `highlight` | the yellow ring — the whole teaching cue |
| `natural-idle` | so six animals are not one metronome |
| `contact-shadow` | the darkening directly underneath |
| `preview-move` | walking — **teacher only** |

---

## 5. Three rules that hold it together

**Content is data; behaviour is code.** A new lesson is a JSON file. A new
*kind* of lesson is a template — there are five planned, two built.

**One contract between the two sides: `library.json`.** A lesson asks for a
name. If the name is not there, the *build* fails — not the headset.

**Repair belongs at intake, never in the scene.** A model that needs a
`scale: 0.33` to look right has not been fixed; the correction has just moved
somewhere it can never be removed from.

---

## 6. The lesson that cost the most

Three separate bugs — a hen rendered seventeen metres tall, a cow buried 1.6 m
underground, and clicks that never hit anything — turned out to be one mistake:

> **Any three.js API that reads geometry directly is reading the bind pose.**
> Bounds, raycasts, culling. For a rigged model, that is not where the model is.

The skeleton places a skinned mesh; the stored geometry does not. Everything
that measures or hits a rigged model now asks the skinned vertices where they
actually are — `tools/lib/skinned-bounds.js` at build time, `seat-on-ground`
and `tap-target` at runtime.

The wider version, worth keeping: **a check that measures the wrong thing is
worse than no check.** It reports a number, the number looks reasonable, and it
sends you looking for the fault somewhere else entirely.

---

## 7. Where it stands

**Built:** the pipeline end to end, two of five templates, two lessons, ten
models, real sky and ground, shadows, animals that roam and come when called,
sounds, English narration, a validator with fourteen rules, generated credits.

**Not built:** three templates (`count`, `match`, `sequence`), `MqttTransport`
— the app runs on `LocalTransport`, one page — the headset's Connect screen,
the status strip, and the service worker and APK packaging.

**Not known:** anything about how this behaves on a headset. Every number in
this repository was measured on a laptop. The PRD calls that Phase 0 and says
it blocks everything, and it is still true.

```bash
npm install
npm run serve
# then open the printed LAN address in the Quest Browser
```

That is the next thing worth doing.
