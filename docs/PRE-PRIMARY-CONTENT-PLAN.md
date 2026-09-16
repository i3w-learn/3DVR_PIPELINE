# Pre-Primary VR Content Plan — Nursery, LKG, UKG

**Source** `VR Content.pdf` — Curriculum List, Pre-Primary section (pages 1–8 of 366).
**Covers** 13 subject tracks, 57 chapters, **109 topics**.
**Companion to** `CONTENT-ARCHITECTURE.md` (library / stage / lesson), `CONTENT-CREATION-PIPELINE.md` (the six stations), `VR-Learning-PRD.md` (the product).
**Status** plan v1 — for review before any asset is downloaded.

This document is the *how*. It does not write a single lesson. It decides what
we build, in what order, and what has to exist before the order makes sense.

---

## 1. The scope, counted

| Grade | Subject | Chapters | Topics |
|---|---|---:|---:|
| NUR | English | 6 | 18 |
| NUR | Maths | 4 | 16 |
| NUR | EVS | 4 | 4 |
| NUR | Hindi | 2 | 2 |
| **NUR total** | | **16** | **40** |
| LKG | English | 7 | 11 |
| LKG | Maths | 4 | 9 |
| LKG | EVS | 8 | 11 |
| LKG | Hindi | 1 | 2 |
| LKG | G.K. | 1 | 1 |
| **LKG total** | | **21** | **34** |
| UKG | English | 2 | 2 |
| UKG | Maths | 3 | 8 |
| UKG | EVS | 11 | 18 |
| UKG | Hindi | 3 | 6 |
| UKG | G.K. | 1 | 1 |
| **UKG total** | | **20** | **35** |
| **Grand total** | | **57** | **109** |

One topic = one lesson file. 109 lesson JSONs is the deliverable.

### What already exists in this repo

Eleven lessons are built. Measured against this curriculum, they cover **three**
topics:

| Existing lesson | Curriculum topic it satisfies |
|---|---|
| `gk-lkg-school-tour` | NUR-EVS → A Visit to the School |
| `evs-ukg-solar-system` | UKG-EVS → Solar System |
| `evs-lkg-farm-yard` | UKG-EVS → Visit to the Farm (partial) |

The other eight (`our-classroom`, `school-hall`, `school-office`,
`school-kitchen`, `playground`, `chem-lab`, `physics-lab`, `farm-animals`) are
not curriculum topics. **We keep them as stages, not as lessons.** They are
eight rooms already modelled and already inside budget — that is eight stage
kits we do not have to build. Retiring them as lessons and promoting them to
stages is the first cheap win available.

---

## 2. The one idea that makes 109 lessons affordable

109 lessons built one at a time is a two-year project. 109 lessons built as
**seven recipes running over ten sets** is a two-quarter project. Everything
below follows from that.

Three things stay separate, as the architecture already insists:

```
  LIBRARY            STAGE               LESSON
  what exists        where it stands     what it teaches
  (a cow, a ball)    (a farm, a table)   (a 7-minute script)
```

The cost of a lesson is **not** the JSON. It is the new models it drags in and
the new stage it needs. So the plan is organised around killing both:

1. **One stage serves many lessons.** Ten stage kits cover all 109 topics.
2. **One new stage — `tabletop` — covers 45 of them on its own.**
3. **Anything a computer can draw, we draw.** Shapes, letters, numerals,
   Devanagari, number lines, balance scales, lines and curves are code, not
   downloads. That is roughly 40 lessons with a near-zero asset bill.
4. **Memory checks reuse the teaching scene exactly.** Five topics in this
   curriculum are "memory check in X". They cost zero new assets.

---

## 3. The `tabletop` stage — why it is the whole plan

Read the curriculum and count how many topics are really *"here are some
objects, look at them, compare them, count them, sort them"*:

> Big and Small · Thick and Thin · Fruits · Vegetables · Colours · Shapes ·
> Counting 1–100 · Addition · Subtraction · Odd and Even · Half and Whole ·
> Two-letter words · Hindi Swar · Hindi Matra · Odd One Out · …

**45 of 109.** None of them needs a farm, a forest or a sky. They need a table
in front of a seated child, at the right height, with three to eight objects on
it and good light.

So `tabletop` is one stage — a small indoor volume, a surface at seated
eye-height, a neutral backdrop, one light rig — and it is the single highest-
value thing to build in this entire programme. Build it once, and 45 lessons
become "list the objects and write the script".

**Why this is architecture and not a shortcut:** the alternative is that every
comparison lesson invents its own little scene, and then "the objects are too
far away for a three-year-old" has to be fixed 45 times instead of once.

### Stage coverage across all 109 topics

| Stage | Status | Lessons | What it is |
|---|---|---:|---|
| `tabletop` | **new — build first** | ~45 | seated close-up surface, neutral, one light rig |
| `outdoor` | exists | ~15 | dressed as garden / forest / park / field by ground + props |
| `farmyard` | exists | ~10 | animals, shed, fence |
| `classroom` | exists | ~8 | desks, board, child seats |
| `street` | **new** | ~8 | road, shopfronts; dressed as market or traffic |
| `home` | **new** | ~7 | two or three rooms; reuses `room.js`, `furniture.js` |
| `water` | **new** | ~5 | pond / river / shallow sea |
| `india` | **new** | ~3 | map plate, monuments, symbol plinths |
| `school` | exists | ~3 | the existing tour campus |
| `sky` | **new** | ~2 | above-ground, cloud layer, balloon basket |
| `solar` | exists | 1 | already built |
| `snow` | **new** | 1 | outdoor with snow ground + pines |

Four exist, seven are new, and `tabletop` is worth more than the other six
combined.

---

## 4. The seven templates

The architecture doc plans five (`identify`, `count`, `match`, `sequence`,
`explore`). Two are built. Running the real curriculum through them, five is
one short and one misnamed. The set we actually need:

| Template | Built? | Lessons | The verb | Covers |
|---|---|---:|---|---|
| `identify` | **yes** | 21 | *look and name* | animals, birds, fruits, colours, shapes, symbols |
| `compare` | new | 22 | *two things, one difference* | every "Let's Compare" topic, opposites, prepositions |
| `match` | new | 20 | *pair A with B* | animal↔sound, animal↔baby, letter↔object, matra↔word |
| `count` | new | 12 | *how many* | 1–100, addition, subtraction, more/less, odd/even |
| `sort` | new | 11 | *put into groups* | classification, odd one out, healthy/unhealthy, sink/float |
| `explore` | **yes** | 15 | *walk and look* | all virtual tours |
| `sequence` | new | 8 | *first, then, last* | water cycle, germination, days, months, seasons, habits |

`compare` is the one the original five missed, and it is the **largest single
template in the pre-primary curriculum** — 22 lessons. NUR-Maths is almost
entirely comparison. Building it early unblocks a fifth of the programme.

### Memory checks are a mode, not a template

Five topics are "Memory check in …" or "… Quiz". The temptation is a `quiz`
template. Resist it.

A memory check is the *same scene* as the lesson that taught it, with the
narration changed from "this is a cow" to "where is the cow?", and a tap
expected instead of a pause. Same stage, same objects, same budget. So it is a
flag on the lesson:

```json
{ "id": "eng-nur-animals-check", "template": "sort", "mode": "check",
  "reuses": "eng-nur-domestic-animals" }
```

**Why from first principles:** a separate template means a separate scene means
separate assets means the check drifts away from the lesson it checks. Children
then fail the check because the cow is standing somewhere else, not because
they forgot the cow. Sharing the scene makes that impossible.

---

## 5. The asset library

Roughly **190–210 distinct models** across 109 lessons. Thirteen exist today.
They are not 200 unrelated downloads — they are **eleven packs**, and a pack is
bought, styled and standardised once, then serves many lessons.

| Pack | ~Models | Serves | Notes |
|---|---:|---|---|
| Farm & domestic animals | 12 | 15 lessons | cow✓ goat✓ hen✓ sheep✓ horse✓ + dog, cat, buffalo, duck, pig, donkey, camel |
| Wild animals | 12 | 6 lessons | elephant✓ + lion, tiger, bear, deer, monkey, giraffe, zebra, fox, rhino, hippo, crocodile |
| Birds | 8 | 3 lessons | parrot, peacock, crow, pigeon, sparrow, owl, duck, hen✓ |
| Water animals | 8 | 4 lessons | fish, dolphin, turtle, crab, octopus, frog, starfish, whale |
| Insects | 7 | 2 lessons | butterfly, bee, ant, spider, grasshopper, ladybird, dragonfly |
| Animal babies | 7 | 2 lessons | calf, chick, puppy, kitten, lamb, kid, foal |
| Fruits & vegetables | 22 | 8 lessons | the tabletop workhorse pack |
| Transport | 16 | 5 lessons | car, bus, truck, cycle, auto, train, plane, boat, tractor, ambulance, fire engine… |
| People & community helpers | 14 | 5 lessons | child✓ didi✓ + doctor, teacher, farmer, police, postman, vendor, tailor… |
| Household & tabletop props | 25 | ~20 lessons | cups, bottles, balls, boxes, books, cloth, bucket, toys |
| Specials | ~30 | 10 lessons | instruments, sports gear, festival props, dinosaurs, snakes, monuments, balloon |

**Procedural — zero download, zero licence, zero bytes:** shapes, capital and
small letters, Devanagari swar / vyanjan / matra, numerals 0–100, number lines,
balance scales, lines and curves, footprints, rainbow, clouds and rain, sorting
bins, plant cutaways, season skies. These carry ~40 lessons. `building.js`,
`room.js`, `path.js`, `furniture.js` already prove the pattern works.

**Audio:** ~25 animal and bird sounds (6 exist), ~10 instrument sounds, 26+ 
phonics sounds, a handful of vehicle and ambience beds.

### The intake rules do not relax at scale

Every model still passes the contract in `CONTENT-ARCHITECTURE.md` §2.3 — one
unit = one metre, origin at the base, facing +Z, Draco, ≤1024px textures, CC0
or CC-BY. And still one art style. **A realistic tiger beside a cartoon cow is
the most visible failure available, and avoiding it costs nothing at intake and
is unfixable later.** Pick the style with the farm pack in Wave 1 and reject on
style thereafter, however convenient the model.

---

## 6. The decision that has to be made before Wave 2

Today the whole app is one build with a **40 MB bundle ceiling**. Start from
what is actually on disk, not from an estimate:

| Measured today | |
|---|---:|
| `app/assets` total | **18 MB** |
| — of which models | 14 MB for **13 models** |
| average per model | **1.1 MB** |
| heaviest | `realhorse` 2.6 MB, `shed` 2.1 MB, `realtree` 1.9 MB |

Project that forward:

- ~200 models at today's measured 1.1 MB ≈ **220 MB**
- textures, HDRIs, sound effects ≈ **10 MB**
- narration: 109 lessons × ~8 steps × 4 languages ≈ **3,500 clips** ≈ **100 MB**

That is roughly **330 MB**. **The current shipping model does not survive this
curriculum.** It has to change, and it is cheaper to change it now than after
forty lessons are written against the old assumption.

### Shrink before you re-architect

Three of those 330 MB are avoidable without any new machinery, and they should
be tried first because they may remove the problem entirely:

| Lever | Where | Likely effect |
|---|---|---|
| **KTX2 / Basis textures** instead of WebP | the `textureCompress` call in `tools/standardise.js` | smaller on disk *and* in Quest VRAM — the biggest single lever |
| **Turn `simplify` on** for the heavy models | it is opt-in per sidecar today, so the Sketchfab-sourced models are not using it | large, on exactly the models that are large |
| **Check `keepClips` is actually trimming** | sidecars | `docs/README.md` records a cow going 1.6 MB → 0.2 MB from this alone; the 28-clip horse is still 2.6 MB |
| **Opus mono for narration** | `ffmpeg` after `build-narration.js` | ~10 KB per clip instead of ~30 KB — 100 MB → ~35 MB |
| **Drop `mr` and `or` for the pilot** | a decision, not code | halves narration again — 3,500 clips → 1,750 |

Do these five before choosing between the three options below. If they land,
per-grade bundles are comfortable and nothing else is needed.

Three ways out, in plain terms:

1. **One bundle per grade.** Nursery, LKG and UKG ship as three apps. Simple,
   no new machinery, ~50 MB each. Cost: a school running all three stores three
   copies of the shared animals.
2. **A small core plus downloadable packs.** The app ships with the templates,
   stages and a starter pack; a teacher downloads "Wild Animals" over wifi when
   they need it. Best on device storage, needs a pack manifest, a downloader
   and an offline story.
3. **Lazy-load per lesson from a local server.** The headset fetches a lesson's
   assets when the teacher opens it. Smallest install, but it assumes a
   reliable local network in an Anganwadi classroom — which is exactly the
   assumption this programme should not make.

**Recommendation: (1) now, (2) later.** Per-grade bundles need no new code and
unblock everything today; packs are the right long-term answer once there is a
pilot telling us which lessons are actually used. Whichever is chosen, the
validator's budget check has to be re-pointed at the new unit (per-grade
bundle, not per-build) in Wave 0, or it will start failing on lesson 40 and
everyone will learn to ignore it.

---

## 7. Comfort and safety rules — non-negotiable

The child in the headset is three to six years old and, per the PRD, **stays
seated**. Four rules that must hold in every lesson in this plan:

1. **No continuous camera motion.** The balloon ride and the river crossing are
   the two topics that beg for it. Move the world, or fade-cut between fixed
   viewpoints (`view-fade.js`, `portal.js` already do this). A moving camera
   with a still body is the fastest way to make a four-year-old sick, and the
   first time it happens in a classroom the programme loses the teacher.
2. **Nothing large moves toward the child.** Dinosaurs and the elephant stay at
   a distance, in profile, and never approach. Scale is the point of a
   dinosaur; looming is not.
3. **No sudden sound.** Animal sounds fade in. The serpentarium has no strike.
4. **Total session ≤ 10 minutes**, headset off between lessons. That is the
   pacing target every script is written to.

### Three topics need sign-off before they are built

| Topic | Issue | Gate |
|---|---|---|
| UKG-EVS → Awareness of Good touch and Bad touch | child-protection content | script written with a child-protection specialist; clothed cartoon figures only; teacher-led, no free exploration, no headset-alone mode; reviewed before any asset work |
| UKG-EVS → Religious Places and Symbols | neutrality | equal screen time, equal treatment, equal production value for every faith shown; reviewed by someone outside the build team |
| UKG-EVS → A visit to the dinosaur park / Serpentarium | fear response | tested with real children before release; a visible, always-available way for the teacher to end the scene |

These are listed here so they are scheduled, not so they are avoided. All three
are good VR topics. They just are not topics to improvise.

---

## 8. Source-document notes

Three things in the curriculum PDF that need a decision from the curriculum
owner before the affected lesson is built:

1. **LKG-EVS Chapter 4** is titled *"Awareness Road Safety"* but its only topic
   is *"Healthy food and Unhealthy food"*. Either a road-safety topic is
   missing or the chapter is mis-titled. The plan below builds the food topic
   and flags the chapter.
2. **NUR-EVS → A Visit to the School** is already built in this repo as an
   **LKG** lesson (`gk-lkg-school-tour`). The curriculum places it in Nursery.
   Re-target it; it is a rename, not a rebuild.
3. **"Wild Animals" and "Wild Animals and their Characteristics"** (NUR-English
   Ch1) are two topics over one asset set. Built as two lessons sharing one
   stage — no extra asset cost, but worth confirming they are meant to be two
   separate sessions.

---

## 9. The full build map — all 109 topics

`✓` = asset or stage already exists. Lesson id follows the repo convention
`subject-class-topic`.

### NUR — English (18)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Learn about Birds | `eng-nur-birds` | identify | outdoor✓ | Birds pack |
| 2 | Birds and Animals with their sounds | `eng-nur-bird-animal-sounds` | match | outdoor✓ | Birds + Farm✓ + sfx |
| 3 | Wild Animals | `eng-nur-wild-animals` | identify | outdoor✓ (forest) | Wild pack |
| 4 | Wild Animals and their Characteristics | `eng-nur-wild-animal-traits` | identify | outdoor✓ (forest) | reuses #3 |
| 5 | Domestic Animals | `eng-nur-domestic-animals` | identify | farmyard✓ | Farm pack (mostly ✓) |
| 6 | Water Animals | `eng-nur-water-animals` | identify | water | Water pack |
| 7 | Memory check — Domestic, Water, Wild | `eng-nur-animals-check` | sort · check | tabletop | **reuses #3 #5 #6** |
| 8 | Fruits | `eng-nur-fruits` | identify | tabletop | Fruit pack |
| 9 | Vegetables | `eng-nur-vegetables` | identify | tabletop | Veg pack |
| 10 | Colors identification | `eng-nur-colors` | identify | tabletop | procedural |
| 11 | Memory check in Colors | `eng-nur-colors-check` | sort · check | tabletop | **reuses #10** |
| 12 | Identify the shapes | `eng-nur-shapes` | identify | tabletop | procedural |
| 13 | Find the shapes | `eng-nur-find-shapes` | sort · find | classroom✓ | shapes hidden in room |
| 14 | Memory check in shapes | `eng-nur-shapes-check` | sort · check | tabletop | **reuses #12** |
| 15 | An Elephant Story | `eng-nur-elephant-story` | sequence | outdoor✓ | elephant✓ + props |
| 16 | Insects | `eng-nur-insects` | identify | outdoor✓ (garden) | Insect pack |
| 17 | Animals and their Sound | `eng-nur-animal-sounds` | match | farmyard✓ | reuses #5 + sfx |
| 18 | Capital and Small Alphabets with objects | `eng-nur-alphabets` | match | tabletop | procedural letters + 26 props |

### NUR — Maths (16)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Taller and Shorter | `math-nur-taller-shorter` | compare | outdoor✓ | tree✓ shrub✓ child✓ |
| 2 | Big and Small | `math-nur-big-small` | compare | tabletop | props |
| 3 | In and Out | `math-nur-in-out` | compare | tabletop | box + ball |
| 4 | Near and Far | `math-nur-near-far` | compare | outdoor✓ | ✓ |
| 5 | One and Many | `math-nur-one-many` | compare | tabletop | props |
| 6 | Long and Short | `math-nur-long-short` | compare | tabletop | procedural |
| 7 | Light and Heavy | `math-nur-light-heavy` | compare | tabletop | procedural balance |
| 8 | Memory check — Heavier and Lighter | `math-nur-weight-check` | compare · check | tabletop | **reuses #7** |
| 9 | Thick and Thin | `math-nur-thick-thin` | compare | tabletop | procedural |
| 10 | Wide and Narrow | `math-nur-wide-narrow` | compare | outdoor✓ | `path.js`✓ |
| 11 | Long and Round Things | `math-nur-long-round` | sort | tabletop | props |
| 12 | Counting and Number names 1–20 | `math-nur-count-1-20` | count | tabletop | procedural numerals |
| 13 | Counting and Number names 21–50 | `math-nur-count-21-50` | count | tabletop | procedural |
| 14 | Counting Numbers 51–100 | `math-nur-count-51-100` | count | tabletop | procedural |
| 15 | 1 to 100 Quiz | `math-nur-count-check` | count · check | tabletop | **reuses #12–14** |
| 16 | Up and Down | `math-nur-up-down` | compare | playground✓ | slide, swing ✓ |

### NUR — EVS (4)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | A Visit to the School | `evs-nur-school-visit` | explore | school✓ | **already built** — re-target from LKG |
| 2 | Explore the Rainbow | `evs-nur-rainbow` | explore | sky | procedural rainbow |
| 3 | Our Festival — Diwali, Sankranti, Holi, Christmas | `evs-nur-festivals` | explore | home + street | Festival props |
| 4 | Good Habits | `evs-nur-good-habits` | sequence | home | child✓ + props |

### NUR — Hindi (2)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Sangit vadhy yantr | `hin-nur-vadya-yantra` | identify | tabletop | Instrument pack + sfx |
| 2 | Janvar aur Boliya | `hin-nur-janvar-boliya` | match | farmyard✓ | **reuses NUR-Eng #17** |

### LKG — English (11)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Types of Transport | `eng-lkg-transport-types` | identify | street | Transport pack |
| 2 | Classification of Transport Vehicle | `eng-lkg-transport-sort` | sort | street | **reuses #1** |
| 3 | Animals and their product | `eng-lkg-animal-products` | match | farmyard✓ | Farm✓ + milk/egg/wool |
| 4 | Animals and the names of their sounds | `eng-lkg-animal-sound-names` | match | farmyard✓ | reuses NUR-Eng #17 |
| 5 | In, On, and Under | `eng-lkg-in-on-under` | compare | classroom✓ | table✓ + ball |
| 6 | Days of the Week | `eng-lkg-days-week` | sequence | classroom✓ | procedural cards |
| 7 | Months of the Year | `eng-lkg-months-year` | sequence | classroom✓ | procedural + season cues |
| 8 | My Self | `eng-lkg-myself` | identify | home | child avatar + mirror |
| 9 | Two Letter Words | `eng-lkg-two-letter-words` | match | tabletop | procedural + props |
| 10 | Discover the three-letter words | `eng-lkg-three-letter-words` | match | tabletop | **reuses #9** |
| 11 | Hot and Cold | `eng-lkg-hot-cold` | compare | kitchen✓ | tea, ice |

### LKG — Maths (9)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Full and Empty | `math-lkg-full-empty` | compare | kitchen✓ | glass, bucket |
| 2 | Wet and Dry | `math-lkg-wet-dry` | compare | home | cloth, towel |
| 3 | Same and Different | `math-lkg-same-different` | sort | tabletop | props |
| 4 | Half and Whole | `math-lkg-half-whole` | compare | tabletop | fruit, roti |
| 5 | More, Less, Same | `math-lkg-more-less-same` | count | tabletop | procedural |
| 6 | Open and Close | `math-lkg-open-close` | compare | home | `door.js`✓ `gate.js`✓ |
| 7 | Learn about Opposites | `math-lkg-opposites` | compare | tabletop | **reuses all compare props** |
| 8 | Odd and Even Numbers | `math-lkg-odd-even` | count | tabletop | procedural |
| 9 | Lines and Curves | `math-lkg-lines-curves` | identify | tabletop | procedural |

### LKG — EVS (11)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Community Helpers | `evs-lkg-community-helpers` | identify | street | People pack |
| 2 | Information about Profession | `evs-lkg-professions` | match | street | People pack + tools |
| 3 | Market Places | `evs-lkg-market` | explore | street (market) | stalls + Fruit/Veg pack |
| 4 | Healthy food and Unhealthy food ⚠ | `evs-lkg-healthy-food` | sort | tabletop | Food pack — *chapter mis-titled, §8* |
| 5 | Special Vehicle | `evs-lkg-special-vehicles` | identify | street | Transport pack |
| 6 | Animals and their Babies | `evs-lkg-animal-babies` | match | farmyard✓ | Babies pack |
| 7 | Animals Habitats Exploration | `evs-lkg-animal-habitats` | sort | outdoor✓ + water | **reuses animal packs** |
| 8 | Learn about What animals Eat | `evs-lkg-animal-food` | match | farmyard✓ | food props |
| 9 | Animals and their Footprints | `evs-lkg-animal-footprints` | match | outdoor✓ | procedural prints |
| 10 | Parts of the Face & Body Parts | `evs-lkg-body-parts` | identify | classroom✓ | labelled child avatar |
| 11 | Parts of the House | `evs-lkg-house-parts` | explore | home | `room.js`✓ `building.js`✓ |

### LKG — Hindi (2) · LKG — G.K. (1)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Khet ki mulakat — Niche kya? Upar kya? | `hin-lkg-khet-upar-niche` | compare | farmyard✓ | root veg + tree fruit |
| 2 | Sabjiya aur unke Rang | `hin-lkg-sabji-rang` | match | tabletop | **reuses Veg pack** |
| 3 | Sports and their Equipment | `gk-lkg-sports-equipment` | match | playground✓ | Sports pack |

### UKG — English (2) · UKG — Maths (8)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Phonics and its Sound | `eng-ukg-phonics` | match | tabletop | letters✓proc + 26 props + phonics sfx |
| 2 | Behind and In Front of | `eng-ukg-behind-front` | compare | classroom✓ | reused props |
| 3 | Simple Addition: Single Digit | `math-ukg-add-single` | count | tabletop | procedural |
| 4 | Simple Addition: Double Digit | `math-ukg-add-double` | count | tabletop | procedural |
| 5 | Simple Subtraction: Single Digit | `math-ukg-sub-single` | count | tabletop | procedural |
| 6 | Simple Subtraction: Double Digit | `math-ukg-sub-double` | count | tabletop | procedural |
| 7 | Division of Single Digit | `math-ukg-divide-single` | count | tabletop | procedural |
| 8 | Multiplication of Single Digit | `math-ukg-multiply-single` | count | tabletop | procedural |
| 9 | Find the Odd One Out | `math-ukg-odd-one-out` | sort | tabletop | **reuses all packs** |
| 10 | Greater than, Less than, Equal to | `math-ukg-compare-numbers` | compare | tabletop | procedural |

### UKG — EVS (18)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | States of India | `evs-ukg-states-india` | explore | india | map plate + markers |
| 2 | National Symbols of India | `evs-ukg-national-symbols` | identify | india | tiger, peacock, lotus, banyan, mango, flag |
| 3 | Different culture of India | `evs-ukg-india-culture` | explore | india | costumes, dance, food |
| 4 | Parts of the Plant | `evs-ukg-plant-parts` | identify | outdoor✓ | procedural cutaway |
| 5 | Plant Germination | `evs-ukg-germination` | sequence | outdoor✓ | procedural seed stages |
| 6 | Flowers and its Plants | `evs-ukg-flowers` | match | outdoor✓ | Flower pack |
| 7 | Religious Places and Symbols ⚠ | `evs-ukg-places-of-worship` | explore | street | 4 places of worship — *§7 gate* |
| 8 | Solar System | `evs-ukg-solar-system` | explore | solar✓ | **already built** |
| 9 | Seasons: Winter, Summer, Monsoon | `evs-ukg-seasons` | sequence | outdoor✓ | sky + ground dressing |
| 10 | Life in Village and City | `evs-ukg-village-city` | compare | outdoor✓ + street | `building.js`✓ dressing |
| 11 | Hot Air Balloon Ride ⚠ | `evs-ukg-balloon-ride` | explore | sky | balloon + basket — *§7 rule 1* |
| 12 | Visit to the Farm | `evs-ukg-farm-visit` | explore | farmyard✓ | **near-complete already** |
| 13 | River crossing Adventure ⚠ | `evs-ukg-river-crossing` | explore | water | boat, bank — *§7 rule 1* |
| 14 | A visiting Serpentarium ⚠ | `evs-ukg-serpentarium` | explore | indoor (vivarium) | Snake pack — *§7 gate* |
| 15 | A visit to the dinosaur park ⚠ | `evs-ukg-dinosaur-park` | explore | outdoor✓ (park) | Dino pack — *§7 gate* |
| 16 | Camp in the snow | `evs-ukg-snow-camp` | explore | snow | tent, fire, pines |
| 17 | The Water Cycle | `evs-ukg-water-cycle` | sequence | outdoor✓ + sky | procedural cloud, rain, sun |
| 18 | Awareness of Good touch and Bad touch ⚠⚠ | `evs-ukg-safe-touch` | sequence | classroom✓ | *§7 gate — specialist sign-off first* |

### UKG — Hindi (6) · UKG — G.K. (1)

| # | Topic | Lesson id | Template | Stage | Assets |
|---:|---|---|---|---|---|
| 1 | Hindi Swar | `hin-ukg-swar` | identify | tabletop | procedural Devanagari |
| 2 | Hindi vyanjan | `hin-ukg-vyanjan` | identify | tabletop | procedural |
| 3 | Hindi — Two letter words | `hin-ukg-do-akshar` | match | tabletop | procedural + props |
| 4 | Hindi — Three letter words | `hin-ukg-teen-akshar` | match | tabletop | **reuses #3** |
| 5 | Hindi — Four letter words | `hin-ukg-char-akshar` | match | tabletop | **reuses #3** |
| 6 | Learn about Hindi Matra | `hin-ukg-matra` | match | tabletop | procedural |
| 7 | Sink and Float | `gk-ukg-sink-float` | sort | water | tub + mixed props |

---

## 10. How one lesson gets made

Nine stations. A station never reaches back into an earlier one, and nothing
skips ahead. This is the existing pipeline with two stations added at the front,
because at 109 lessons the expensive mistakes are all made before anyone opens
Blender.

```
 brief ─▶ script ─▶ assets ─▶ stage ─▶ lesson JSON ─▶ validate ─▶ narrate ─▶ headset ─▶ teacher
```

| # | Station | Output | Done when |
|---:|---|---|---|
| 0 | **Brief** | one page: the learning objective, what the child sees, what the check asks | a teacher agrees this is the lesson |
| 1 | **Script** | the steps, with narration in en / hi / mr / or | ≤ 10 min, ≤ 10 steps, native-speaker read |
| 2 | **Assets** | sidecars in `raw/`, standardised `.glb` in `app/assets/` | `content:std` clean, licence recorded, style matches |
| 3 | **Stage** | a stage kit, reused or new | reused by default — a new stage needs a reason |
| 4 | **Lesson** | `app/lessons/<id>.json` | written, never hand-tuned for one model |
| 5 | **Validate** | `npm run content:check` | model refs, clip names, triangles, draw calls, bundle all pass |
| 6 | **Narrate** | `audio/<lang>/*.mp3` | built for all four languages |
| 7 | **Headset** | a real Quest, a real look | scale right, nothing floating, nothing backwards, pacing comfortable |
| 8 | **Teacher** | a real classroom trial | teacher can run it unaided; child stays engaged to the end |

### Definition of done for a lesson

- [ ] Every step teaches one thing and lasts ~6 seconds
- [ ] Narration exists and is correct in all four languages
- [ ] `content:check` passes — no missing model, no missing clip, inside budget
- [ ] Reviewed on a headset: scale, orientation, ground contact, comfort
- [ ] Reuses an existing stage, or its new stage is used by ≥ 3 lessons
- [ ] Every asset's licence is in `CREDITS.md`
- [ ] Runs 72 fps on device
- [ ] A teacher who has never seen it can run it

---

## 11. Build order

The order is chosen so that nothing is ever built twice and so the first real
lesson lands as early as possible.

### Wave 0 — foundations · nothing ships

The five missing templates, the `tabletop` stage, the procedural builders, and
the bundling decision from §6.

Build in this order: `compare` → `tabletop` → procedural shapes/letters/numerals
→ `count` → `match` → `sort` → `sequence` → check mode.

**Why first:** 45 lessons wait on `tabletop`, 22 on `compare`, 40 on the
procedural builders. Writing lesson JSONs before these exist means rewriting
them after.

Also here: re-point the budget validator at whatever unit §6 decides, and
promote the eight non-curriculum school lessons to stages.

### Wave 1 — prove the line · 6 lessons

`eng-nur-domestic-animals`, `eng-nur-animal-sounds`, `evs-nur-school-visit`,
`evs-ukg-solar-system`, `evs-ukg-farm-visit`, `eng-nur-colors`.

Five reuse assets that already exist; one is the first `tabletop` lesson. This
wave exists to run all nine stations end to end and find out what the estimates
really are, on content that costs almost nothing.

**Gate: nothing proceeds until one of these has been in front of real children.**

### Wave 2 — the tabletop sweep · ~45 lessons

All of NUR-Maths, UKG-Maths, UKG-Hindi, the letters and word-building lessons,
fruits, vegetables, colours, shapes. The cheapest lessons in the programme and
almost half the curriculum. Asset bill: one fruit/veg pack and a props box.

### Wave 3 — the animal and plant packs · ~22 lessons

Farm, wild, birds, water, insects, babies, flowers, plants. One pack bought and
styled at a time; every pack unblocks three to six lessons across all three
grades at once.

### Wave 4 — the world outside · ~15 lessons

`street` and `home` stages, then transport, community helpers, professions,
market, house parts, festivals, sports, body parts, habits.

### Wave 5 — the tours · ~12 lessons

`india`, `water`, `sky`, `snow` stages, then States of India, culture, symbols,
village and city, water cycle, seasons, balloon, river, dinosaurs, snow camp,
serpentarium. The most expensive lessons per unit — deliberately last, after the
team knows what a comfortable tour feels like on a headset.

The three gated topics in §7 run their reviews **in parallel with Wave 2**, so
the sign-off is ready when the build slot arrives.

### Wave 6 — the checks · 5 lessons + polish

The memory checks and quizzes. Near-zero asset cost because they reuse the
scenes built in Waves 2 and 3. Then a full narration pass replacing every
placeholder voice, and a licence audit against `CREDITS.md`.

### Rough shape of the effort

Estimates, to be replaced with measured numbers after Wave 1 — that is the
point of Wave 1.

| Kind of lesson | Count | Rough cost each |
|---|---:|---|
| tabletop, procedural or reused assets | ~45 | half a day |
| needs a share of a new asset pack | ~40 | one to two days |
| a tour needing a new stage | ~15 | four to six days |
| memory check reusing a scene | ~5 | two hours |
| Wave 0 foundations | — | three to four weeks |
| narration across four languages | — | two to three weeks |

Order of magnitude: **roughly nine to ten months for one person, roughly three
months for a team of three to four** with asset intake, scripting and scene
assembly running in parallel. The single biggest swing factor is asset intake —
if the packs can be bought as coherent styled sets rather than assembled model
by model, the middle two rows collapse.

---

## 12. What could go wrong

| Risk | Why it bites | What we do about it |
|---|---|---|
| Bundle outgrows the device | 200 models + 3,500 audio clips ≈ 150 MB | decide §6 in Wave 0, before lesson 10 |
| Mixed art style | a realistic tiger next to a cartoon cow, unfixable later | pick the style in Wave 1, reject on style thereafter |
| Motion sickness in the tours | balloon and river crossing | no continuous camera motion, ever — §7 rule 1 |
| Narration is a placeholder at pilot | 3,500 clips is the largest single task and the easiest to defer | Wave 1 scripts all four languages from day one; TTS draft, human final for en + hi |
| A new stage per lesson | the fastest way to turn this into a two-year project | a new stage needs three lessons to justify it — enforced at review, not by hope |
| 109 lessons that no teacher can run | built for a validator, not a classroom | Wave 1 gate: real children, real teacher, before Wave 2 starts |
| Gated topics improvised under deadline | good-touch/bad-touch especially | reviews run in parallel with Wave 2, not in the build slot |

---

## 13. What this plan needs from you

1. **§6 — bundling.** Per-grade bundles, downloadable packs, or lazy-load. This
   blocks Wave 0.
2. **§8 — the three curriculum queries.** The mis-titled road-safety chapter,
   the Nursery/LKG placement of the school visit, and whether the two wild-animal
   topics are one session or two.
3. **§7 — who signs off** on the good-touch/bad-touch script and on the
   religious-places lesson.
4. **Narration languages.** The app carries en, hi, mr, or. Confirm all four
   are required for the pilot — it is the difference between 870 clips and 3,500.
5. **Art style.** One reference image, agreed before the farm pack is bought.

---

## Appendix A — The English track, worked through

Three classes, 31 topics, and the asset bill drops sharply as you go up the
grades because each class reuses what the one below it bought.

| Class | Topics | New models needed | Why |
|---|---:|---:|---|
| NUR English | 18 | **~44** | carries all five animal packs and fruit/veg |
| LKG English | 11 | **~25** | one new pack (transport) + a props box |
| UKG English | 2 | **0** | pure reuse — only 26 phonics sound clips are new |
| **Total** | **31** | **~70** | |

### A.1 What to build

| Bucket | Items | Serves |
|---|---|---|
| **Procedural — code, no download** | 52 letters (A–Z, a–z), 7 shapes, colour props, word tiles, day and month cards | NUR shapes / colours / alphabets, LKG days / months / word-building, UKG phonics |
| Birds pack | parrot, peacock, crow, pigeon, sparrow, owl, duck (hen ✓) | NUR ×2 |
| Wild pack | lion, tiger, bear, deer, monkey, giraffe, zebra (elephant ✓) | NUR ×3 |
| Farm pack | dog, cat (cow ✓ goat ✓ hen ✓ sheep ✓ horse ✓) | NUR ×2, LKG ×2 |
| Water pack | fish, dolphin, turtle, crab, octopus, frog | NUR ×1 |
| Insects pack | butterfly, bee, ant, spider, grasshopper, ladybird | NUR ×1 |
| Fruit & Veg pack | ~18 items | NUR ×2, plus word-building props |
| Transport pack | ~16 vehicles | LKG ×2 |
| Small props box | milk, egg, wool, ball, cup, tea, ice, box, mirror | LKG ×4 |
| Audio | ~20 animal and bird sounds (6 ✓), 26 phonics sounds | NUR ×3, UKG ×1 |

Six of NUR English's 18 topics are memory checks or straight reuses of an
earlier scene, so they carry no asset cost at all.

### A.2 The three ways an asset gets made

**1. Draw it in code.** Letters, shapes, colour tiles, word cards, day and
month cards are geometry with text on it — a builder component taking params
from the lesson JSON, exactly like the existing `building.js` and `room.js`.
No download, no licence to audit, no bytes in the bundle. **This alone covers
14 of the 31 English topics.**

**2. Buy one styled pack, never one model.** One source, one author, one
category at a time. Assembling a pack model-by-model from whatever is free that
day is how you end up with a realistic tiger standing next to a cartoon cow —
and that is unfixable once ten lessons depend on both.

**3. Reuse.** The farm pack serves four English topics, then Hindi and EVS on
top. The rule: **a pack has to unblock three or more lessons before we buy it.**

Everything from route 2 still goes through intake unchanged —
`raw/` + sidecar → `npm run content:std` → `library.json` → `content:check`.

### A.3 Build order for English

1. **Procedural builders** — letters, shapes, cards, colour props. Unblocks 14
   topics with nothing purchased.
2. **Farm pack** (2 models) + **Birds pack** + **Fruit & Veg pack** — finishes
   most of NUR English.
3. **Wild, Water, Insects packs** — closes NUR English.
4. **Transport pack** + props box — closes LKG English.
5. **UKG English falls out free** — 26 phonics sound clips and nothing else.

The shape of this is the argument for the whole plan in miniature: do the
procedural work first, buy packs rather than models, and the top grade costs
almost nothing.

---

## Appendix B — How the code should be laid out

The code is not disorganised in general. It is disorganised in one specific
place: **27 components sit in one flat folder doing four different jobs.** Read
the names and they sort themselves.

| Job | Files today |
|---|---|
| **Builders** — make geometry from params | `building` `room` `wall` `door` `gate` `furniture` `blackboard` `playground` `lab` `path` `flagpole` `portal` `space` |
| **Behaviours** — make things act | `highlight` `tap-target` `wander` `natural-idle` `auto-open` `view-fade` `preview-move` `viewer-rig` `scene-look` |
| **Scene plumbing** — set up the world | `pbr-ground` `sky-environment` `contact-shadow` `seat-on-ground` `merge-boxes` `built` |
| **Orchestrator** — one file, its own kind | `lesson-sync` |

### B.1 The target layout

```
3DVR_pipeLine/
├── app/                        ← what ships to the headset
│   ├── index.html  styles.css
│   ├── lib/                    vendored: aframe, aframe-extras, draco
│   ├── src/
│   │   ├── main.js             imports 4 registries, nothing else
│   │   ├── lesson-sync.js      the orchestrator — alone, on purpose
│   │   ├── builders/           geometry from params
│   │   │   ├── index.js
│   │   │   ├── building  room  wall  door  gate  furniture  blackboard
│   │   │   ├── playground  lab  path  flagpole  portal  space
│   │   │   └── NEW: tabletop  letter  shape  numeral  card
│   │   ├── behaviours/         things that act
│   │   │   ├── index.js
│   │   │   ├── highlight  tap-target  wander  natural-idle  auto-open
│   │   │   └── view-fade  preview-move  viewer-rig  scene-look
│   │   ├── scene/              the world around the lesson
│   │   │   ├── index.js
│   │   │   └── pbr-ground  sky-environment  contact-shadow
│   │   │       seat-on-ground  merge-boxes  built
│   │   └── templates/          the 7 lesson recipes
│   │       ├── index.js
│   │       ├── identify  explore
│   │       └── NEW: compare  count  match  sort  sequence
│   ├── stages/                 12 kits — where a lesson stands
│   ├── lessons/                one file = one curriculum topic
│   │   ├── index.json          GENERATED — id → path, so the browser can resolve
│   │   ├── demo/               scenes that exercise a stage, not curriculum
│   │   └── (grade folders nur/ lkg/ ukg/ once the count justifies them)
│   └── assets/
│       ├── library.json        GENERATED
│       ├── models/  textures/  hdri/  sfx/  planets/
│       └── audio/{en,hi,mr,or}/
│
├── raw/                        audit trail — sidecars committed, binaries ignored
│
├── tools/                      the pipeline — never ships
│   ├── fetch/                  sketchfab  polyhaven  sound  planets
│   ├── standardise/            models  textures  hdri
│   ├── build/                  library  credits  narration
│   ├── check/                  validate-lessons
│   ├── lib/                    contract  materials  skinned-bounds
│   └── serve.js
│
└── docs/
```

### B.2 Why each move

**Components split by job.** Today, to add the `compare` template you have to
know which of 27 files matter. After the split a template author touches
`templates/` only, a stage author touches `builders/` and `scene/`, and nobody
touches `lesson-sync.js`. With five more templates and seven more stages
coming, that boundary is what stops people overwriting each other.

**`lessons/` splits by grade.** 109 files in one folder is unnavigable. More
usefully: if §6 lands on per-grade bundles, **the folder boundary is the ship
boundary** — `lessons/nur/` becomes the Nursery app. Free alignment.

**`lesson-sync.js` moves up beside `main.js`.** It is the only orchestrator.
Leaving it as 1 of 27 components hid the fact that it is a different kind of
thing from the other 26.

**`tools/` groups by pipeline stage.** `fetch → standardise → build → check`
reads left to right, the same order as the diagram in `docs/README.md`. Fifteen flat
scripts do not show their own order.

**One `index.js` per folder.** `templates/index.js` already does this well —
"adding a template is: write the file, add one line here". Copy that for
builders, behaviours and scene, so `main.js` has four imports instead of 27.

### B.3 The rule that keeps it from rotting

Imports only ever point one way:

```
tools/  ──writes──▶  app/assets/

main.js ──▶ lesson-sync ──▶ templates ──▶ builders ──▶ scene
                                          behaviours
```

- `app/src/` never imports from `tools/`
- `builders/`, `behaviours/` and `scene/` never import a template or `lesson-sync`
- a template never imports another template

This is the same idea as `library → stage → lesson` in `CONTENT-ARCHITECTURE.md`
§1, applied to code instead of content. When an arrow points backwards, the
symptom is identical: a fix for one lesson silently changes another.

### B.4 Two things the layout exposes

**`space.js` is 849 lines and serves one lesson.** It is the largest file in the
codebase — bigger than the entire template system — and only the solar system
uses it. Put it in `builders/` for now, and if it has not generalised by the
time `sky` and `india` are built, move it next to its lesson and stop treating
it as reusable. **Rule to adopt: a component used by exactly one lesson is a
smell.**

**Eight of the eleven lessons are not lessons.** `school-hall`, `school-office`,
`school-kitchen`, `our-classroom`, `playground`, `chem-lab`, `physics-lab` and
`farm-animals` are rooms, not curriculum topics. Move them into `app/stages/`
and delete the lesson files. `app/lessons/` then drops to three and honestly
means "one file, one curriculum topic" — which is what this entire plan assumes.

### B.5 Order of work

1. **Commit what is in flight first.** Six modified files and an untracked
   `viewer-rig.js` sitting uncommitted. Move folders before committing and the
   diff becomes unreadable. Delete the stray `buildings school tour` note file
   in the repo root while you are there — its content belongs in this document
   or in an issue.
2. Split `components/` into `builders/`, `behaviours/`, `scene/`.
3. Promote the eight non-curriculum lessons to stages.
4. Add the three new `index.js` registries; trim `main.js`.
5. Split `tools/` by pipeline stage.
6. **Then** start Wave 0 and build `compare`.

Do the reorganisation **before** Wave 0, not during. Moving 27 files while five
new templates are half-written is how a week disappears.
