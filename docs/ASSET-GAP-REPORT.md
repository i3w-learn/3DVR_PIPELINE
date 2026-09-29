# Asset Gap Report

## Status on 29 September 2026

What happened to each recommendation in section 6. The rest of this report is
as it was written on 24 September; its numbers are from that day.

| # | Recommendation | Status |
|---|---|---|
| 1 | Buy nothing | **Done.** Nothing was bought. 80 realistic models were added, all free (CC-BY) from Sketchfab. |
| 2 | Delete the unused drawn twins | **Done.** 55 drawn models that a realistic one replaced are deleted. 41 drawn models with no realistic twin are kept as spares. |
| 2 | Keep one peacock, delete two | **Open.** Waiting for Manas to pick one. All three still stand in the peacock demo. |
| 3 | Record the style decision | **Done.** `CONTENT-CREATION-PIPELINE.md` section 3 now says the style is realistic. |
| 4 | Shrink the files | **Open.** See below. |
| 5 | Decide how lessons are packaged | **Open.** A decision for Manas, not code. |

**Where the lessons stand now.** Every model a lesson shows is realistic:
186 of 186. The live list is `docs/OBJECT-REPORT.md`, made by
`npm run content:objects`.

**Size today.**

| | 24 Sep | 29 Sep |
|---|---:|---:|
| `app/assets` | 167 MB | 211 MB |
| — models | 93 MB | 134 MB |
| — narration | about 70 MB | 68 MB |
| Model files | 298 | 353 |

The folder grew because the letter beach and the realistic objects were added.
No single lesson is over its 40 MB limit; the check (`npm run content:check`)
passes for every lesson but the peacock demo.

**Why the shrink steps in section 5 are still open.** Each one changes
something Manas has already looked at and approved, so none was done without
asking:

- **Smaller textures (KTX2).** The biggest saving, but the app must learn to
  read the new format first, and every model has to be looked at again after.
- **Thinner heavy models.** The ten heaviest are trees, people and vehicles
  that were tuned by eye. Thinning them changes how they look.
- **Smaller narration files (Opus).** Would cut narration to about a third.
  Older iPads cannot play the format, so the teacher's tablet must be checked.
- **Drop Marathi and Odia for the pilot.** A decision, not code.

---

**Generated** 24 September 2026
**Method** every `"model"` reference in `app/lessons/*.json` and `app/stages/*.json`,
compared against `app/assets/models/*.glb` on disk. Same lookup the validator does.
**Scope** 111 lesson files, 25 stage kits, 298 models.

---

## 1. The answer, up front

You asked how many objects you still have to get, and from where.

| Question | Answer |
|---|---:|
| Objects still to **download** from Sketchfab | **0** |
| Objects still to **generate** with Tripo / Meshy | **0** |
| Objects still to **create** by any route | **0** |
| Objects **referenced but missing** | **0** |

**Every model that any lesson or stage names already exists on disk.** Nothing in
the built content is blocked on an asset. The acquisition phase of this programme
is finished.

The costing work we did — ₹2,561 for a prop gap, ₹11,174 for environments — was
sizing a gap that the repo closed some time ago. The plan doc still says
*"Thirteen exist today"* (§5); the real number is 298.

---

## 2. What is actually on disk

| Measure | Count |
|---|---:|
| Models in `app/assets/models` | **298** |
| Referenced by at least one lesson or stage | **181** |
| Downloaded but never referenced | **117** |
| Referenced but absent | **0** |

| Measure | Size |
|---|---:|
| `app/assets` total | **167 MB** |
| — models | 93 MB |
| — audio, textures, HDRI, planets, sfx | 74 MB |
| `/raw` (audit trail, not shipped) | 1.8 GB |
| Average per model | 0.30 MB |

Lesson authoring is also done: **111 lesson files, every one complete** — none is a
stub, all have objects and two or more steps. The curriculum in
`PRE-PRIMARY-CONTENT-PLAN.md` §1 targets 109 topics. You have 111 files.

---

## 3. Coverage by pack

Checked against the eleven packs in `PRE-PRIMARY-CONTENT-PLAN.md` §5.

| Pack | Target | On disk | Status |
|---|---:|---:|---|
| Farm & domestic animals | 12 | 12 | Complete |
| Wild animals | 12 | 12+ | Complete |
| Birds | 8 | 8 | Complete |
| Water animals | 8 | 10 | Complete |
| Insects | 7 | 7 | Complete |
| Fruits & vegetables | 22 | 27 | Exceeds target |
| Transport | 16 | 23 | Exceeds target |
| Household & tabletop props | 25 | ~21 | Sufficient for built lessons |
| People & community helpers | 14 | 8 | Fewer than planned, but no lesson is blocked |
| Animal babies | 7 | 4 | `lamb`, `kid`, `foal` absent — no lesson references them |
| Specials | ~30 | ~20 | Instruments, sports, dinosaurs, snakes all present |

The two under-target packs are under target **against the plan**, not against the
lessons. No built lesson names a model that is missing, so neither gap is holding
anything up. If a future lesson needs a postman or a lamb, that is a one-object
decision at that time, not a pack to buy now.

---

## 4. The real finding: you have a surplus, not a shortage

**117 of 298 models — 39% of the library — are never referenced by any lesson or
stage.**

Unused models weigh **7.9 MB** of the 93 MB in `app/assets/models`. They are not
the size problem, but they are noise in the library and in every licence audit.

### 4.1 The style split resolved itself

75 objects exist twice — once stylised, once with a `real` prefix:

```
apple / realapple      cow  (stylised)  …  realhorse
bus   / realbus        hen  (stylised)  …  realteacher
```

`CONTENT-CREATION-PIPELINE.md` §1 says *"A realistic cow beside a cartoon hen is
rejected, however convenient."* That rule has effectively been decided already:

| Style | References from lessons and stages |
|---|---:|
| `real*` (realistic) | **332** |
| plain (stylised) | 148 |

The realistic track won, roughly 2:1. Of the 75 duplicated objects, **68 stylised
twins are referenced by nothing at all** and can be deleted — 2.1 MB reclaimed, and
one art-style contradiction removed from the repo.

This should be written into the pipeline doc as a decision, not left as drift.
Right now §1 states a rule the library does not follow.

### 4.2 The three peacocks

```
peacocksketchfab   1.45 MB   referenced by: nothing
peacocktripo       1.17 MB   referenced by: nothing
peacockmeshy       0.79 MB   referenced by: nothing
```

A three-way generator comparison was run and never concluded. All three are still
on disk, none is in a lesson, and 3.4 MB is sitting there.

Tripo's is 19% smaller than the Sketchfab download; Meshy's is 46% smaller. If the
comparison is settled, keep one as `peacock` and delete the other two. If it is
not settled, that is the decision to make — not a new generator to evaluate.

---

## 5. What is actually blocking the programme

Not assets. **Size.**

| | Value |
|---|---:|
| `app/assets` today | **167 MB** |
| Validator per-lesson ceiling (`L11`) | 40 MB |
| Plan doc §6 projection at full curriculum | ~330 MB |

`PRE-PRIMARY-CONTENT-PLAN.md` §6 raised this when assets measured 18 MB and called
it *"the decision that has to be made before Wave 2."* Assets are now **167 MB** —
nine times that — and the decision is still open. Wave 2 has effectively arrived
without it.

§6 also lists five shrink levers to try before re-architecting. Their current state:

| Lever | Status |
|---|---|
| KTX2 / Basis textures instead of WebP | Not applied — biggest single lever, also cuts Quest VRAM |
| Turn `simplify` on for heavy models | Opt-in per sidecar; the heavy `real*` models are not using it |
| Verify `keepClips` is trimming | `realhorse` is still 2.62 MB — suggests clips are not trimmed |
| Opus mono for narration | Not applied — would take narration from ~100 MB to ~35 MB |
| Drop `mr` / `or` for the pilot | A decision, not code |

The ten heaviest models are all `real*` trees, people and vehicles at 2–2.9 MB
each. `realfir` and `realfirfar` together are 5.7 MB — two variants of one tree.

---

## 6. Recommendation

1. **Buy nothing.** No Tripo credits, no Skybox AI subscription, no downloads. The
   library covers every built lesson with 117 models to spare. Revisit only if a
   new lesson names something absent.

2. **Delete the 68 unreferenced stylised twins** and two of the three peacocks.
   Reclaims ~5 MB and removes the art-style contradiction between the pipeline doc
   and the library.

3. **Record the style decision.** Amend `CONTENT-CREATION-PIPELINE.md` §1 to say
   the programme ships the realistic track. The doc currently states a rule the
   repo contradicts, which will mislead the next person at intake.

4. **Run the §6 shrink levers.** KTX2 textures and `simplify` on the `real*` models
   first, then Opus mono narration. These may remove the packaging problem without
   any new machinery.

5. **Then decide the packaging model.** §6's option (1) — one bundle per grade —
   needs no new code and unblocks shipping. Re-point the validator's budget check
   at the new unit in the same change, or it will start failing and be ignored.

---

## 7. Method

```bash
# referenced ids
grep -ho '"model"[[:space:]]*:[[:space:]]*"[^"]*"' \
  app/lessons/*.json app/lessons/demo/*.json app/stages/*.json \
  | sed 's/.*: *"//;s/"//' | sort -u > referenced.txt

# ids on disk
ls app/assets/models/*.glb | xargs -n1 basename | sed 's/\.glb$//' | sort -u > ondisk.txt

comm -23 referenced.txt ondisk.txt   # missing  -> 0 rows
comm -13 referenced.txt ondisk.txt   # unused   -> 117 rows
```

Counts in this report are reproducible from the repo as of 24 Sep 2026. Licence
figures come from the 295 `.meta.json` sidecars in `/raw`: 202 CC-BY, 93 CC0,
zero paid.
