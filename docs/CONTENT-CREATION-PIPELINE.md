# Content Creation Pipeline

**Companion to** `VR-Learning-PRD.md` (product), `ARCHITECTURE.md` (code), and
`CONTENT-ARCHITECTURE.md` (library / stage / lesson split).

This document is the **how**: how a cow on Poly Pizza becomes a ten-minute VR
lesson a teacher can run. It does not introduce a game engine.

**Status** draft v0.2 — for team review

| Read this | For |
|---|---|
| §0–§10 | pipeline walkthrough |
| **HLD** | system boxes, build vs runtime, what ships |
| **LLD** | JSON schemas, tool I/O, merge rules, A-Frame mapping |

---

## 0. The stack — and what it is not

| Layer | What we use | What we do not use |
|---|---|---|
| Runtime | A-Frame (HTML over three.js) + WebXR | Unity, Unreal, Godot, native scene kits |
| Renderer | three.js, via A-Frame | A second renderer |
| Models | Downloaded CC0 (preferred) / recorded-licence assets | Commissioned worlds, paid kits, generated filler for things a 3-year-old already recognises |
| Sources | Quaternius, Kenney, Poly Pizza, ambientCG, Poly Haven | Skybox AI (CC-BY-NC), anything we cannot ship to a funded programme |
| Lessons | JSON recipes | Per-lesson `.js` scenes, baked video |

A-Frame is the scene. three.js is already inside it. Poly Pizza (and the other
CC0 libraries) are **where models come from**, not where lessons live.

If a step in this pipeline needs Unity, Blender-as-a-runtime, or a custom shader
graph, the step is wrong. Blender appears **once**, at intake, to put a model on
the contract. It never ships.

---

## 1. What “content” means here

Three files, one direction, never merged. Full argument:
`CONTENT-ARCHITECTURE.md`.

```
  LIBRARY                 STAGE                  LESSON
  what exists          where it stands        what it teaches
  cow.glb              outdoor kit            highlight cow,
  grass.jpg            (ground, sky,          say "this is a cow",
  cow.mp3              reused trees)          wait 6 seconds
```

```
  download ──▶ /raw ──▶ standardise ──▶ /assets ──▶ manifest
                                              │
                                              ▼
                                    stage kit + lesson JSON
                                              │
                                              ▼
                                    validate on a laptop
                                              │
                                              ▼
                                    review on a headset
```

The **pipeline** is everything left of “review on a headset”. The **product**
(MQTT, teacher tablet, APK) is `ARCHITECTURE.md`. Content work does not wait on
the headset purchase, except the final headset pass before a template is frozen.

---

## 2. Folders the pipeline owns

```
/raw                         Untouched downloads. Sidecars committed, binaries not.
  cow.glb
  cow.meta.json              human: source + licence only

/assets                      SHIPPED. Standardised. Zero hand copies into here.
  library.json               GENERATED — never hand-edited
  /models                    cow.glb  hen.glb  tree.glb  …
  /textures                  grass.jpg  soil.jpg  woodfloor.jpg
  /audio
    /mr                      cow.mp3
    /hi                      cow.mp3
    /or                      cow.mp3

/stages                      SHIPPED. Data, not code.
  outdoor.json
  indoor.json

/lessons                     SHIPPED. JSON recipes only.
  evs-lkg-farm-animals.json

/tools
  standardise.sh             Blender contract + gltf-transform
  build-library.js           reads /assets/models → library.json
  validate-lessons.js        schema + library + budgets
```

`/app/manifest.json` is the **PWA** manifest. It is not the asset catalogue.
The asset catalogue is `/assets/library.json`.

Language is a **folder**. Adding Odia is adding `/assets/audio/or/`. Lesson JSON
does not change.

---

## 3. Pipeline — six stations

Work always moves left to right. A station must not reach into a later station
to “just fix this one model”.

### Station 1 — Source

For anything a 3-year-old already recognises: **download before generating**.

| Need | Where to look first | Licence |
|---|---|---|
| Rigged animals | Quaternius — Ultimate Animated Animals | CC0 |
| Trees, rocks, nature | Kenney Nature Kit, Quaternius Stylized Nature | CC0 |
| Food, fruit | Kenney Food Kit, Quaternius | CC0 |
| Furniture, indoor props | Kenney, Poly Pizza | CC0 / CC-BY — check per file |
| Ground textures | ambientCG, Poly Haven | CC0 |
| Distant backdrop (optional) | Poly Haven HDRI | CC0 |

**Intake rules**

- CC0 preferred. Every licence recorded in the sidecar. CC-BY is allowed if
  attribution is written down; CC-BY-NC is not.
- One art style: stylised low-poly, flat or lightly shaded. A realistic cow
  beside a cartoon hen is rejected, however convenient.
- Rigged if it must move. Never auto-rig animals (auto-riggers are humanoid).
- One word, lowercase filename when it lands in `/raw`: `cow.glb`.

Write a sidecar next to the download and **do not edit the glb in `/raw`**:

```json
{
  "id": "cow",
  "source": "Quaternius — Ultimate Animated Animals",
  "licence": "CC0",
  "url": "https://…"
}
```

### Station 2 — Standardise (the model contract)

Nothing enters `/assets/models` except through this. There is no manual copy.

Every model, no exceptions:

| Rule | Value |
|---|---|
| Scale | 1 unit = 1 metre |
| Origin | at the base, centred — feet on the ground |
| Orientation | facing **+Z** |
| Compression | Draco geometry, textures ≤ 1024 px |
| Name | lowercase, one word, `.glb` |

`gltf-transform` does compression and texture size. It does **not** do scale,
origin, or facing. Those are a Blender pass, once per model, on a **copy** —
never by overwriting `/raw`.

```bash
# geometry + texture pass (after the Blender contract pass)
npx @gltf-transform/cli optimize \
  raw/cow.glb \
  assets/models/cow.glb \
  --compress draco --texture-size 1024
```

Until the Blender step is scripted, it is done by hand **once**, then the
gltf-transform line is the script. Models kept before `standardise.sh` exists
will be redone; do not start a lesson on them.

**Repair vs placement — do not mix these**

| Kind | Example | Where it lives |
|---|---|---|
| Repair | model is 4.5 m tall, faces −X | intake only. Never in lesson JSON |
| Placement | this tree is a bit larger; hen sits closer | stage `props[]` or lesson `objects[]` |

If a lesson needs `scale: 0.33` to make a cow look like a cow, the pipeline
failed. If a stage sets one tree to `1.3` so five copies do not look identical,
that is dressing.

Placement scale and rotation use A-Frame vec3 strings, same as the runtime:

```json
"scale": "1.3 1.3 1.3",
"rotation": "0 40 0"
```

not `"scale": 1.3` or `"rotation": 40`.

**Draco at runtime.** Compressed files need a **vendored** Draco decoder under
`/app/lib`. No CDN. Offline classroom.

### Station 3 — Generate the library manifest

`tools/build-library.js` reads the files on disk and writes `/assets/library.json`.
Humans do not edit that file.

Measured from the glb: `height`, `triangles`, `meshes` (draw-call proxy),
`bytes`, `clips`, `rigged`. Copied from the sidecar: `source`, `licence`.

Textures and audio are listed the same way (path, bytes, licence) so a licence
audit is one file, and a lesson that names `cow.mp3` without `audio/mr/cow.mp3`
fails on a laptop.

### Station 4 — Stage kits (land + reused props)

Land is **geometry in the shell**, not a downloaded world:

| Part | What it is | Cost |
|---|---|---|
| Ground | one `<a-plane>`, tiled 1024 px texture | 1 draw call |
| Sky | flat or gradient colour | ~0 |
| Distant scenery | optional backdrop / HDRI | 1 draw call |
| Props | 3–4 distinct models, many placements | a few draw calls |

**Two kits, not three.** Farm, zoo, roadside, forest are `outdoor` with a
different ground and different lesson objects. Classroom, kitchen, home are
`indoor` with a different floor texture and furniture props.

Indoor is still not a downloaded room-scan. It is a floor plane, a sky/ceiling
colour, and **3–4 furniture/wall models reused** — the same prop rule as trees.

```json
{
  "id": "outdoor",
  "sky": "#9fd8f5",
  "ground": "grass.jpg",
  "groundRepeat": "25 25",
  "props": [
    { "model": "tree", "position": "-7 0 -13" },
    { "model": "tree", "position": "6 0 -15", "scale": "1.3 1.3 1.3", "rotation": "0 40 0" },
    { "model": "tree", "position": "-12 0 -20", "scale": "0.8 0.8 0.8", "rotation": "0 120 0" },
    { "model": "rock", "position": "3 0 -8", "scale": "0.9 0.9 0.9" }
  ]
}
```

A fifth **distinct** prop model means rethink the scene, not add a mesh.

### Station 5 — Lesson recipe

A lesson **names** a stage and a template. It does not contain trees that belong
on the outdoor kit. It does not contain sky or ground unless it overrides them.

```json
{
  "id": "evs-lkg-farm-animals",
  "template": "identify",
  "stage": "outdoor",
  "stageOverride": {},
  "objects": [
    {
      "id": "cow",
      "model": "cow",
      "position": "-1 0 -4",
      "rotation": "0 40 0",
      "clip": "Idle"
    },
    {
      "id": "hen",
      "model": "hen",
      "position": "1.5 0 -3",
      "clip": "Idle"
    }
  ],
  "steps": [
    {
      "highlight": "cow",
      "audio": "cow.mp3",
      "duration": 6000,
      "script": { "mr": "ही गाय आहे.", "hi": "यह गाय है।" }
    },
    {
      "highlight": "hen",
      "audio": "hen.mp3",
      "duration": 5000,
      "script": { "mr": "ही कोंबडी आहे.", "hi": "यह मुर्गी है।" }
    }
  ]
}
```

`script` ships before any mp3 exists. The teacher reads it. Audio folders can be
filled later without reopening this file.

**A step never adds geometry.** After `template.build()`, everything the lesson
will ever show is already in the graph. Steps only change highlight, visibility,
clip, and what is heard. That keeps frame time flat for ten minutes.

For `count` and `sequence`: place every object at build (ten mangoes, seed and
plant). Steps hide, show, or swap visibility. They do not `createElement` a
new glb.

Placement `scale` on an object is optional and **artistic**. Default is `1 1 1`
because the model already honours the metre contract.

### Station 6 — Validate, then headset

`tools/validate-lessons.js` runs on a laptop, no headset:

| Check | How |
|---|---|
| Model id exists | `library.json` lookup |
| Clip name exists | `clips[]` on that model |
| Audio file exists for each shipped language folder that we claim | path on disk |
| Triangles | instances × `triangles` from library, ceiling 150,000 |
| Draw-call proxy | instances × `meshes` + land, ceiling 100 |
| Bundle bytes | referenced files, ceiling **40 MB per lesson** (whole APK is larger and is a packaging budget, not this check) |
| Schema | `template`, `stage`, `objects`, `steps`, `duration` |

**72 fps** is not a laptop check. It is `fps` in the headset heartbeat, on device.

A template is not frozen until one real lesson has run through it **on a real
headset**. Recipes can be written before that; they cannot be marked done.

---

## 4. How a lesson is assembled at runtime

Owned by code (`ARCHITECTURE.md`). Content authors only need the order:

```
  lesson JSON
       │  names stage, models, steps, template
       ▼
  stages/<id>.json  ──▶  template.build()  ◀──  assets/library.json
                              │
                              ▼
                    ground + sky + stage props
                    + lesson objects
                              │
                              ▼
                    template.applyStep()   highlight + narration
```

`#stage` in the HTML is the **DOM node** the template writes into. The **kit**
is `stages/outdoor.json`. Those are two different words; do not collapse them.

---

## 5. Naming

| Thing | Form | Example |
|---|---|---|
| Model | lowercase, one word | `cow.glb` |
| Texture | lowercase, what it is | `grass.jpg` |
| Audio | the object, no language | `cow.mp3` |
| Language | folder | `audio/mr/cow.mp3` |
| Lesson | `subject-class-topic` | `evs-lkg-farm-animals.json` |
| Stage kit | one word | `outdoor.json` |
| Sidecar | same stem as the raw glb | `cow.meta.json` |

---

## 6. Who does what

| Person | Does | Does not |
|---|---|---|
| Content | download, sidecar, style reject, stage JSON, lesson JSON, `script` lines | edit A-Frame components, put repair-scale in recipes |
| Pipeline (tools) | standardise, `library.json`, validate | invent models |
| Engineer | templates, shell, Draco decoder vendored | hand-place cows in `index.html` |
| Educator | duration, session length, script tone, headset pass | author WebXR |

Narration is **not** on the critical path. Text `script` first; record into
language folders when speakers exist.

---

## 7. Build order — strict

```
  1. standardise.sh exists          ← before any model is kept
  2. first ~10 models through it    ← farm set: cow, hen, goat, tree, rock…
  3. build-library.js               ← so lessons can be validated
  4. two stage kits                 ← outdoor.json, indoor.json
  5. five templates                 ← identify, count, match, sequence, explore
  6. eleven lesson recipes          ← see PRD §4.2
```

Hard rules inside that list:

- A recipe cannot name `cow` before `assets/models/cow.glb` exists.
- Step 1 before step 2. Models kept early will be the wrong scale, and a lesson
  will already depend on them.
- Templates freeze only after a headset pass. Content sourcing does not wait
  for that freeze.

The first eleven lessons (PRD §4.2) all dress **these two kits**. That is why
asset work compounds.

---

## 8. Failure modes the pipeline is supposed to catch

| Symptom | Cause | Caught at |
|---|---|---|
| Model floats | origin not at base | intake |
| Animal the size of a house | not 1 unit = 1 m | intake |
| Walks backwards | not facing +Z | intake |
| Stutter on headset | too many distinct meshes | validate (proxy) + fps heartbeat |
| Animal does not move | not rigged, or wrong clip | library clip check |
| Mixed art style | intake said yes to the wrong file | intake, human |
| Missing model / black sky from `file://` | not a content bug | always serve over HTTP |
| Lesson names a model that is not there | typo | `library.json` lookup |

If a floating cow reaches a classroom, **fix the pipeline**, not `lesson-sync`.

---

## 9. What this pipeline deliberately will not do

- Author scenes in a game engine and export them.
- Mix 360° photo worlds in as the main environment (optional distant backdrop
  only — PRD §4.3).
- Let teachers author JSON in v1 (PRD non-goal).
- Generate a cow because downloading one felt slow.
- Put language in filenames.
- Repair scale and yaw at runtime (`fit-ground`, per-model yaw) — those exist
  in the PoC because `/raw` was shipped as `/assets`. This pipeline deletes
  the reason they exist.

---

## 11. HLD — High-level design

What a new engineer should be able to draw on a whiteboard after this section:
the boxes, the arrows, and which box is allowed to know about which other box.

### 11.1 Context

```
  Content person          Pipeline (laptop)              Classroom app
  ──────────────          ─────────────────              ─────────────
  downloads CC0           standardise.sh                 A-Frame shell
  writes .meta.json       build-library.js               templates/*
  writes stage JSON       validate-lessons.js            lesson-sync
  writes lesson JSON                                     #sky #ground #stage
  writes script text
         │                        │                              │
         │     /raw /stages       │     /assets /lessons         │
         └──────── /lessons ──────┴──────── shipped APK ─────────┘
```

No game engine sits in this diagram. Poly Pizza / Quaternius / Kenney sit
**outside** the left box: they are vendors, not components we run.

The classroom product (MQTT, teacher clock, APK) is **downstream**. This HLD
stops at “validated files the shell can fetch”. Wiring after that is
`ARCHITECTURE.md`.

### 11.2 Two times, two computers

| | Build time (laptop) | Runtime (tablet / headset) |
|---|---|---|
| Purpose | make files that cannot lie | play one lesson |
| Inputs | `/raw`, sidecars, stage JSON, lesson JSON | `/assets`, `/stages`, `/lessons` |
| Outputs | standardised glbs, `library.json`, pass/fail | scene graph + audio |
| May use Blender | yes, intake only | **never** |
| May spawn meshes on a step | n/a | **no** |
| Budget that matters | triangles, mesh-count proxy, bytes, refs | 72 fps on device |

If a fact is knowable at build time (clip name, metre scale, missing mp3), it is
decided at build time. The headset is not a content debugger.

### 11.3 Logical components (pipeline)

```
                    ┌─────────────┐
                    │  Source     │  human + sidecar
                    │  station    │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ Standardise │  Blender contract + gltf-transform
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  Library    │  generated library.json
                    │  builder    │
                    └──────┬──────┘
                           ▼
   ┌──────────┐     ┌─────────────┐     ┌──────────┐
   │  Stage   │────▶│  Validator  │◀────│  Lesson  │
   │  kits    │     │             │     │  recipes │
   └──────────┘     └──────┬──────┘     └──────────┘
                           │ pass
                           ▼
                    ┌─────────────┐
                    │  Ship set   │  assets + stages + lessons
                    └─────────────┘
```

Dependencies point **down** the page. A lesson may *name* a stage and a model.
A stage may *name* a model. A model file knows nothing. The validator is the
only component that sees all three at once — and only at build time.

### 11.4 What ships in the APK (content slice)

```
  shipped
    assets/library.json
    assets/models/*.glb          (Draco)
    assets/textures/*
    assets/audio/<lang>/*
    stages/outdoor.json
    stages/indoor.json
    lessons/*.json
    app/lib/draco/*              (decoder; vendored)

  not shipped
    /raw/**
    tools/**
    *.meta.json                  (truth is already in library.json)
```

Service worker caches the shipped slice on install. CDN is forbidden.

### 11.5 Runtime assembly (content → scene)

One HTML shell, never reloaded (`ARCHITECTURE.md` §1). Content enters as data:

```
  fetch lesson JSON
       │
       ├─▶ core lesson-schema (ids, types)
       ├─▶ fetch stages/<stage>.json
       ├─▶ merge stageOverride
       └─▶ templates[lesson.template].build(domStage, resolved)
                │
                ├─ set #sky colour, #ground src + repeat
                ├─ for each kit.props     → gltf-model entity (not highlighted)
                └─ for each lesson.objects → gltf-model entity (may highlight)
                       │
                       ▼
                applyStep(step)  → highlight + a-sound + visible flags
```

`#stage` = DOM node. `stages/outdoor.json` = kit. Different things.

Teacher role owns the step clock and publishes `class/state`. Headsets only
obey. Content authors do not design that path; they only guarantee that after
`build()`, every mesh the lesson needs already exists.

### 11.6 Design constraints the HLD will not break

1. Library, stage kit, lesson stay three artefacts.
2. Two kits cover the first eleven lessons (PRD §4.2). Dressings are overrides,
   not new kits.
3. Five templates (`identify`, `count`, `match`, `sequence`, `explore`) are
   code. Lessons are data.
4. Language is a directory. Lessons never mention `mr` / `hi` in filenames.
5. Draw-call budget is a **content** rule (3–4 distinct prop models) as much as
   a renderer trick.

---

## 12. LLD — Low-level design

Normative schemas and algorithms. If a tool and this section disagree, the tool
is wrong until this section is revised.

Vec3 fields are **A-Frame strings**: `"x y z"`. Euler rotation is degrees,
Y-up, same as A-Frame. Model ids are stems without `.glb`.

### 12.1 Sidecar — `/raw/<id>.meta.json`

Hand-written. One per download. Never shipped.

```
Sidecar {
  id:        string   // /^[a-z][a-z0-9]*$/  must match filename stem
  source:    string   // vendor + pack name
  licence:   "CC0" | "CC-BY" | string   // CC-BY-NC → reject at intake
  url:       string   // where it was fetched
  notes?:    string
}
```

Reject if `id` ≠ `cow` when the file is `raw/cow.glb`.

### 12.2 Library — `/assets/library.json`

**Generated only** by `tools/build-library.js`.

```
Library {
  generated:  ISO-8601 string
  models:     { [id: string]: ModelRecord }
  textures:   { [id: string]: FileRecord }
  audio:      { [lang: string]: { [file: string]: FileRecord } }
}

ModelRecord {
  file:       string   // "models/cow.glb"
  height:     number   // metres, from bounding box after contract
  triangles:  number
  meshes:     number   // draw-call proxy (primitives)
  bytes:      number
  clips:      string[] // animation clip names, exact
  rigged:     boolean  // clips.length > 0
  source:     string   // from sidecar
  licence:    string   // from sidecar
}

FileRecord {
  file:       string
  bytes:      number
  source?:    string
  licence?:   string
}
```

**Builder algorithm**

1. List `assets/models/*.glb`. Stem = id.
2. Fail if no matching `/raw/<id>.meta.json`.
3. Parse glb: triangle count, mesh/primitive count, clip names, byte size,
   AABB height on Y.
4. Copy `source` / `licence` from sidecar.
5. Same walk for `assets/textures/*` and `assets/audio/<lang>/*`.
6. Write `assets/library.json` atomically (write temp, rename).

Do not invent clip names. Do not keep stale ids for deleted files.

### 12.3 Stage kit — `/stages/<id>.json`

```
StageKit {
  id:            "outdoor" | "indoor"
  sky:           string        // CSS colour, e.g. "#9fd8f5"
  ground:        string        // texture id, "grass.jpg" stem+ext
  groundRepeat:  string        // "25 25"
  ceiling?:      string        // indoor only; omit outdoors
  props:         Prop[]        // max 4 distinct model ids in this array
}

Prop {
  model:      string    // library model id
  position:   vec3      // "x y z"
  rotation?:  vec3      // default "0 0 0"
  scale?:     vec3      // default "1 1 1" — placement, not repair
}
```

**Distinct-prop rule:** unique values of `prop.model` in one kit ≤ 4.

Indoor: `ground` is a floor texture (`woodfloor.jpg`). Walls/furniture are
`props` (same 3–4 distinct models). No scanned room glb as the world.

### 12.4 Lesson recipe — `/lessons/<id>.json`

```
Lesson {
  id:              string     // filename stem, subject-class-topic
  template:        "identify" | "count" | "match" | "sequence" | "explore"
  stage:           "outdoor" | "indoor"
  stageOverride?:  StageOverride
  objects:         LessonObject[]
  steps:           Step[]
}

StageOverride {
  sky?:           string
  ground?:        string
  groundRepeat?:  string
  ceiling?:       string
  // props are not overridable. Change the kit or add lesson objects.
}

LessonObject {
  id:         string    // DOM id, unique in the lesson
  model:      string    // library model id
  position:   vec3
  rotation?:  vec3
  scale?:     vec3      // placement only
  clip?:      string    // must be in library.models[model].clips
  visible?:   boolean   // default true; count/sequence hide extras at build
}

Step {
  highlight?:  string            // LessonObject.id
  audio:       string            // "cow.mp3" — no language
  duration:    number            // ms, > 0
  visible?:    { [objectId: string]: boolean }  // optional visibility map
  script:      { [lang: string]: string }
}
```

**Merge:** `resolvedStage = { ...kit, ...stageOverride }` (shallow). `props`
always come from the kit. Zoo dirt is `stageOverride.ground = "soil.jpg"`.

**Id uniqueness:** every `LessonObject.id` unique; every `highlight` / `visible`
key must be one of those ids.

**`model` field:** `"cow"` not `"cow.glb"`. Validator appends `.glb` for disk.

### 12.5 `standardise.sh`

Input: `raw/<id>.glb`. Output: `assets/models/<id>.glb`. `/raw` is never
overwritten.

```
1. Copy raw/<id>.glb → work/<id>.glb
2. Blender (headless) on work/<id>.glb:
     - apply rotation/scale
     - origin = bottom centre of AABB (feet on y = 0)
     - forward = +Z
     - uniform scale so AABB height in metres matches real-world intent
       (cow ≈ 1.4–1.6 m, hen ≈ 0.35–0.45 m, tree ≈ 4 m). Record target
       height in the sidecar notes if the default is wrong.
3. gltf-transform optimize work/<id>.glb assets/models/<id>.glb
     --compress draco --texture-size 1024
4. Delete work/<id>.glb
5. Exit non-zero if output missing, or if any texture still > 1024 on the
   long edge
```

Until step 2 is scripted, it is a written checklist run once per model, then
step 3 is the script. Same contract.

### 12.6 `validate-lessons.js`

Exit `0` only if every lesson passes. Print `lesson id + rule id + detail`.

| Rule | Test |
|---|---|
| L1 | JSON parses; required keys present |
| L2 | `id` === filename stem |
| L3 | `template` ∈ five names; `stage` file exists |
| L4 | every `objects[].model` and `props[].model` ∈ `library.models` |
| L5 | if `clip` set, name ∈ that model’s `clips`; if `clip` set, `rigged` is true |
| L6 | `highlight` / `visible` keys ∈ object ids |
| L7 | `audio` exists at `assets/audio/<lang>/<audio>` for every lang folder we ship |
| L8 | `duration` ≥ 1000 |
| L9 | triangle cost ≤ 150_000 — see formula |
| L10 | mesh proxy + 2 (sky unused + ground) ≤ 100 — see formula |
| L11 | sum of referenced file `bytes` ≤ 40_000_000 |
| L12 | unique prop model ids in kit ≤ 4 |
| L13 | no `stageOverride.props` |
| L14 | `scale` / `rotation` / `position` match `/^-?\d+(\.\d+)?( -?\d+(\.\d+)?){2}$/` |

**Triangle cost**

```
instances = concat(kit.props, lesson.objects)
cost = Σ library.models[i.model].triangles   // each placement counts
```

Same model five times counts five times (no GPU instancing in v1).

**Draw-call proxy**

```
proxy = Σ library.models[i.model].meshes
      + 1                // ground plane
      + 1                // optional backdrop if stage uses one
      + 1                // highlight torus (worst case one)
```

This is a **proxy**. 72 fps remains a headset measurement.

Referenced bytes = unique files among models, textures (kit ground + override),
and audio files named by steps (count each lang we ship).

### 12.7 Runtime mapping (template.build)

Normative attribute map. Templates may add behaviour (`animation-mixer`,
`visible`) but must not invent a second path to load models.

| JSON | A-Frame |
|---|---|
| `resolvedStage.sky` | `#sky` `color` |
| `resolvedStage.ground` | `#ground` `src` = `assets/textures/` + ground |
| `resolvedStage.groundRepeat` | `#ground` `repeat` |
| `prop` / `object` | child of `#stage`, `gltf-model` = `assets/models/<id>.glb` |
| `position` `rotation` `scale` | same attributes |
| `object.id` | entity `id` (highlight target) |
| `clip` | `animation-mixer="clip: <name>"` |
| `visible: false` | `visible="false"` at build |
| kit `props` | **no** `highlight`, **no** raycaster unless template `explore` |

`applyStep(step)`:

1. Remove `highlight` from all `#stage` children.
2. If `step.highlight`, set `highlight` on that id.
3. If `step.visible`, set `visible` on those ids only (others unchanged).
4. Set `#voice` `src` to `assets/audio/<session.lang>/<step.audio>` and play.
   Language comes from session state, not from the lesson file.

**Forbidden in applyStep:** `createElement` of a new `gltf-model`, `innerHTML`
appends of meshes, fetch of a new glb.

### 12.8 Template-specific object rules

| Template | Build | Steps |
|---|---|---|
| `identify` | all objects visible | highlight + audio |
| `count` | all N objects placed; extras `visible: false` if needed | `visible` map counts up; do not clone |
| `match` | both sets placed | highlight pair / visibility |
| `sequence` | every stage of the sequence placed (seed **and** plant) | hide/show along the chain |
| `explore` | all named objects placed | tap → play that object’s audio; Connect gesture still required to enter VR |

### 12.9 Tool CLI

```
tools/standardise.sh <id>
tools/build-library.js
tools/validate-lessons.js [--lesson evs-lkg-farm-animals]
```

Suggested npm scripts (app does not import these):

```
"content:std":     "tools/standardise.sh"
"content:library": "node tools/build-library.js"
"content:check":   "node tools/validate-lessons.js"
```

CI: `content:library` then `content:check`. Never commit a hand-edited
`library.json`.

### 12.10 Errors (stable strings)

| Code | Meaning |
|---|---|
| `INTAKE_LICENCE` | CC-BY-NC or missing sidecar licence |
| `INTAKE_STYLE` | human reject; not automated |
| `STD_CONTRACT` | origin / facing / height failed after Blender |
| `STD_TEXTURE` | texture long edge > 1024 after transform |
| `LIB_STALE` | sidecar missing or id mismatch |
| `VAL_L1` … `VAL_L14` | validator rules above |

Runtime still logs missing entities, but that is a **bug**: validator should
have failed the build.

---

## 13. Summary

1. No game engine. A-Frame + three.js is the runtime; downloads are the library.
2. `/raw` is the audit trail; `/assets` is the contract.
3. Manifest is generated (`library.json`), so it cannot drift from disk.
4. Two stage kits. Lessons name a kit and add only what they teach.
5. Steps never spawn meshes.
6. If a laptop can fail the build, the laptop fails the build.

See **HLD** for the boxes; **LLD** for the schemas those boxes must honour.
See `CONTENT-ARCHITECTURE.md` for why library, stage, and lesson stay separate.
See `VR-Learning-PRD.md` §4.2 for which eleven lessons this pipeline feeds first.
