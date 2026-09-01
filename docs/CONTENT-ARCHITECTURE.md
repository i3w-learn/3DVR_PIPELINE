# Content Architecture

**Companion to** `ARCHITECTURE.md` (code layout) and `VR-Learning-PRD.md` (product).
This covers the other half: **models, land, and the library** — how 3D content is
sourced, normalised, stored and assembled into a lesson.

**Status** draft v0.1 — for team review

---

## 1. Three things, and they never touch each other

The single most useful idea in this document. Most 3D projects rot because these
three get mixed into one pile of files.

```
   LIBRARY                 STAGE                  LESSON
   what exists          where it stands        what it teaches
   ─────────            ─────────────          ──────────────
   cow.glb              outdoor: ground        highlight cow,
   hen.glb              texture, sky colour,   say "this is a cow",
   tree.glb             5 tree placements      wait 6 seconds
   grass.jpg

   pure asset data      reusable set-up        a JSON recipe
```

The contract between them, one direction only:

```
  library ──named by──▶ stage ──dressed by──▶ lesson ──driven by──▶ template
```

- The **library** does not know any stage exists.
- A **stage** does not know which lesson will use it.
- A **lesson** does not know how a model is built, scaled or compressed.

Break any of these and the symptom is always the same: a fix for one lesson
silently changes another.

---

## 2. The library

### 2.1 What it is

A folder of standardised assets plus **one generated manifest**.

```
/assets
  manifest.json          GENERATED — never hand-edited
  /models   cow.glb  hen.glb  goat.glb  tree.glb  rock.glb
  /textures grass.jpg  soil.jpg  woodfloor.jpg
  /audio
    /mr  cow.mp3  hen.mp3
    /hi  cow.mp3  hen.mp3
```

### 2.2 The manifest is generated, not written

This is the important decision. A hand-written asset list drifts from the files
on disk within a month and then lies to you. So `tools/build-manifest.js` reads
the actual `.glb` files and emits the truth:

```json
{
  "generated": "2026-09-01T10:22:00Z",
  "models": {
    "cow": {
      "file": "models/cow.glb",
      "height": 1.48,
      "triangles": 3120,
      "bytes": 412000,
      "clips": ["Idle", "Walk", "Gallop", "Eating"],
      "rigged": true,
      "source": "Quaternius — Ultimate Animated Animals",
      "licence": "CC0"
    },
    "tree": {
      "file": "models/tree.glb",
      "height": 4.20,
      "triangles": 890,
      "bytes": 61000,
      "clips": [],
      "rigged": false,
      "source": "Kenney — Nature Kit",
      "licence": "CC0"
    }
  }
}
```

`source` and `licence` are the only fields a human supplies (a small sidecar file
per download). Everything else is measured. Consequences worth the effort:

- **Lesson validation becomes possible.** A recipe asking for `clip: "Walk"` on a
  model with no clips fails at build time, on a laptop — not in a classroom.
- **The budget becomes checkable.** Sum the triangles a lesson references and
  compare to the 150,000 ceiling before anyone puts a headset on.
- **The licence audit is free.** One file answers "what is in this build and under
  what terms", which a government programme will eventually ask for in writing.

### 2.3 The model contract

Every model in `/models` honours the same five rules, without exception:

| Rule | Value |
|---|---|
| Scale | 1 unit = 1 metre |
| Origin | at the base, centred — feet on the ground |
| Orientation | facing **+Z** |
| Compression | Draco geometry, textures ≤ 1024 px |
| Name | lowercase, one word, `.glb` — `cow.glb` |

**Why this is architecture and not housekeeping:** the contract is what makes any
model substitutable for any other. When it holds, a stage can place `cow.glb` and
`goat.glb` with identical code. When it breaks, the scene grows a per-model
correction — a `scale: 0.33` here, a `yaw: 90` there — and those corrections leak
into lesson JSON, where they are permanent.

The existing PoC is the worked example: its `fit-ground` component recomputes a
bounding box on **every model load**, and `walk-through` carries a per-model yaw
offset, purely because the raw Quaternius animals are ~4.5 units tall and face
arbitrary directions. Both components exist only to apologise for unstandardised
assets. Fix the assets and both delete themselves.

### 2.4 The intake pipeline

Nothing enters `/models` except through this. There is no manual copy.

```
  download ──▶  /raw  ──▶  standardise  ──▶  /assets/models  ──▶  manifest
   (CC0)      (untouched)   (Blender +        (contract           (measured)
                            gltf-transform)     holds)
```

```bash
# geometry + texture pass
npx @gltf-transform/cli optimize raw/cow.glb assets/models/cow.glb \
  --compress draco --texture-size 1024
```

Scale, origin and orientation need a Blender pass — `gltf-transform` will not do
them. Until that pass is automated, they are done by hand *once per model*, in
`/raw`, and never in the scene.

**`/raw` is the audit trail, and the sidecars are the part that is committed.**
Each one records the source, the author, the licence, the exact URL, and every
processing parameter — 68 KB of text that makes a build reproducible. The
binaries behind them are 300 MB and every one is re-fetchable from the URL in
its own sidecar, so they are git-ignored. Nothing in `/raw` ever ships.

### 2.5 Intake rules

| Rule | Reason |
|---|---|
| CC0 preferred; every licence recorded | government/NGO delivery |
| One art style — stylised low-poly, flat shaded | a realistic cow beside a cartoon hen is the most visible failure available, and avoiding it is free |
| Rigged if it must move; never auto-rig | auto-rigging is humanoid-only; animals fail |
| Download before generating | for anything a 3-year-old recognises, a clean CC0 model already exists |
| Reject on style, however convenient | style violations are unfixable later |

---

## 3. The land

### 3.1 Land is geometry, not a download

Nothing about the ground or sky is a model file.

| Part | What it actually is | Cost |
|---|---|---|
| Ground | one `<a-plane>`, a tiled 1024 px texture | 1 draw call |
| Sky | one flat or gradient colour | ~0 |
| Distant scenery | optional flat backdrop or HDRI | 1 draw call |
| Props | 3–4 models, repeated | 3–4 draw calls |

A 1024 px grass texture tiled 25×25 covers an 80-metre field. That is the entire
ground: one image, one plane.

### 3.2 Props: reuse, never add

**One tree model, five placements** — different position, scale and rotation —
reads as five different trees. This is the main lever for staying inside the
100-draw-call budget, and it is a content rule, not a rendering trick.

The budget line is explicit: **3–4 distinct tree/prop models per scene**, reused.
A scene needing a fifth distinct prop is a scene that needs rethinking.

### 3.3 Stage kits — where 11 lessons come from 3 set-ups

Two base stages, stored as data, dressed differently:

```json
// stages/outdoor.json
{
  "id": "outdoor",
  "sky": "#9fd8f5",
  "ground": "grass.jpg",
  "groundRepeat": "25 25",
  "props": [
    { "model": "tree", "position": "-7 0 -13" },
    { "model": "tree", "position": "6 0 -15",  "scale": 1.3, "rotation": 40 },
    { "model": "tree", "position": "-12 0 -20", "scale": 0.8, "rotation": 120 },
    { "model": "rock", "position": "3 0 -8",   "scale": 0.9 }
  ]
}
```

A lesson names a stage and overrides only what differs:

```json
{
  "id": "evs-lkg-zoo-animals",
  "stage": "outdoor",
  "stageOverride": { "ground": "soil.jpg" },
  "objects": [ ... ]
}
```

Farm, forest, zoo and roadside are all `outdoor` with a different ground texture
and different animals. Classroom, kitchen and home are all `indoor`. That is why
eleven lessons cost three set-ups, and why asset work compounds instead of
restarting each time.

---

## 4. How a lesson assembles

```
  lessons/evs-lkg-farm-animals.json
            │
            │  names a stage      names models        names steps
            ▼
  stages/outdoor.json ─────▶ template.build() ◀───── assets/manifest.json
                                    │                    (validates every
                                    ▼                     model reference)
                              ground + sky
                              + props
                              + lesson objects
                                    │
                                    ▼
                          template.applyStep()  ──▶  highlight + narration
```

Order is fixed and enforced:

1. **stage** — ground, sky, props. Built once, reused across lessons.
2. **objects** — what this lesson is about. Built once per lesson.
3. **steps** — highlight and narration. Applied per step, ~6 seconds apart.

A step never adds geometry. Everything a lesson will ever show is on screen after
build; steps only change what is highlighted and what is heard. That is what
keeps frame time flat for the whole ten minutes.

---

## 5. Where each budget is enforced

The budget only works if something checks it before a classroom does.

| Budget | Checked where | When |
|---|---|---|
| Triangles < 150,000 | manifest sum per lesson | build time |
| Draw calls < 100 | prop count in stage + objects | build time |
| Texture ≤ 1024 px | `gltf-transform` intake | intake |
| Bundle < 40 MB | sum of referenced bytes | build time |
| Model references exist | manifest lookup | build time |
| Clip names exist | manifest lookup | build time |
| **72 fps sustained** | **`fps` in every headset heartbeat** | **runtime, on device** |

Everything except the last row is decidable on a laptop with no headset. That is
the whole point of generating the manifest — it turns "we will find out in the
pilot" into "the build failed".

---

## 6. Naming

| Thing | Form | Example |
|---|---|---|
| Model | lowercase, one word | `cow.glb` |
| Texture | lowercase, what it is | `grass.jpg` |
| Audio | the object, no language | `cow.mp3` |
| Language | a **folder**, never a filename | `audio/mr/cow.mp3` |
| Lesson | `subject-class-topic` | `evs-lkg-farm-animals.json` |
| Stage | one word | `outdoor.json` |

**Language is a folder.** `cow_marathi.mp3` would mean adding a language requires
reopening every lesson file. As a folder, adding Odia is adding `audio/or/` and
nothing else.

---

## 7. Failure modes, and where each one is caught

| Symptom | Real cause | Where it should have been caught |
|---|---|---|
| Model floats above the ground | origin not at base | intake |
| Animal is the size of a house | 1 unit ≠ 1 metre | intake |
| Animal walks backwards | not facing +Z | intake |
| Scene stutters on the headset | too many distinct props | build-time draw-call check |
| Animal does not move | model not rigged, or wrong clip name | manifest clip validation |
| Scene looks incoherent | mixed art style | intake, on style |
| Black sky, missing model | served from `file://` | local dev — always serve over HTTP |
| Lesson references a missing model | typo | manifest lookup |

Every row above the last two is an **intake or build-time** failure. If any of
them reaches a headset, the pipeline — not the scene — is what needs fixing.

---

## 8. Build order — strict

```
  1. standardise script exists       ← before any model is kept
  2. first ~10 models through it     ← farm set: cow, hen, goat, tree, rock…
  3. manifest generator              ← so lessons can be validated
  4. two stage kits                  ← outdoor, indoor
  5. five templates                  ← identify, count, match, sequence, explore
  6. lesson recipes                  ← 11 lessons
```

Two hard dependencies inside that list:

- A recipe cannot reference `cow.glb` before `cow.glb` exists.
- A template cannot be frozen before a real lesson has run through it **on a real
  headset**.

And one ordering that gets skipped and should not be: **step 1 comes before step
2.** Models kept before the script exists are models that will need redoing, and
by then a lesson will already depend on their wrong scale.

---

## 9. Summary — six rules

1. Library, stage and lesson are three separate things. Never merge them.
2. The manifest is generated from the files, so it cannot lie.
3. Every model honours one contract, enforced at intake — not in the scene.
4. Land is geometry, not a download.
5. Props are reused, never added.
6. If it can be checked on a laptop, check it on a laptop.
