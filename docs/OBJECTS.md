# How to add a realistic object

_The road every object takes, from "the lesson needs a pumpkin" to a pumpkin
a child can see in the headset. Written 30 September 2026, after 186 objects
had gone down it. Follow it in order; every step is one command._

## The short version

| Step | Command | Time |
|---|---|---|
| 1. Find | `npm run content:find -- "pumpkin=pumpkin"` | 1 minute, plus looking |
| 2. Download | `node --env-file=.env tools/fetch/sketchfab.js <uid> realpumpkin 0.25` | 10 seconds |
| 3. Convert | `npm run content:std realpumpkin && npm run content:library` | 30 seconds |
| 4. Place | `npm run content:place -- evs-lkg-market pumpkin realpumpkin` | 1 second |
| 5. Check | `npm run content:check` | 30 seconds |
| 6. Look | open the lesson with `&look=pumpkin` | 1 minute |
| 7. Credit | `npm run content:credits && npm run content:objects` | 10 seconds |

Costs nothing. Sketchfab and Poly Haven are free; only step 8 (AI) costs money,
and only when steps 1 and 2 find nothing.

Model ids are one lowercase word, `real` in front: `realpumpkin`. The `real`
says it came from a scan or a photo-real model; the plain name is kept for the
drawn one it replaced, if there was one.

## 1. Find — look before you download

```
npm run content:find -- "pumpkin=pumpkin" "tabla=tabla drum"
```

Left of the `=` is the id the model will get; right is what to search for.
For each, a picture sheet lands in `.work/find/<id>.jpg` — twelve free,
downloadable, CC-BY or CC0 models under 60,000 faces, most liked first — and
the download command for each is printed beside its number.

**Open the sheet and look.** Sketchfab matches names, not things: the top hit
for "ladybird" is a bikini, for "tabla" a surfboard, for "cobra" a staff. Pick
by eye. What to look for:

- **Is it the thing?** A real pumpkin, not a lantern, not a cartoon.
- **Is it one thing?** Packs of ten vegetables can be used (see `keepNodes`
  below), but a single model is less work.
- **Faces.** Under 20,000 is easy; 20,000–60,000 needs `simplify`; over that,
  look for another. A lesson has 150,000 in total, shadows included.
- **No brand.** No Coke can, no airline livery, no logo. A classroom is not an
  advertisement.
- **No see-through glass** if you can help it. The converter makes glass
  thin and cheap, but a bottle with juice inside is easier when the glass is
  simply painted.
- **Does it move?** "moves" in the list means it has animation clips. Animals
  should move; props should not need to.

Nothing good? Try other words (`"dhol=indian drum"`, `"bansuri=bamboo
flute"`), raise the limit (`MAX_FACES=120000 npm run content:find -- …`) and
plan to thin it, or go to step 8.

## 2. Download

```
node --env-file=.env tools/fetch/sketchfab.js <uid> realpumpkin 0.25
```

The last number is the height in metres the model will be standardised to —
its real size. A pumpkin is 0.25, a hen 0.4, a cow 1.5, a bus 3. This writes
the download into `raw/realpumpkin/` and a record beside it,
`raw/realpumpkin.meta.json`, with the source, author and licence. The record
is what makes the credits page honest; never skip it.

The download needs `SKETCHFAB_TOKEN` in `.env`, which git ignores. The tool
refuses anything that is not CC0 or CC-BY.

Poly Haven (CC0 scans, no key): `node tools/fetch/polyhaven.js <slug> <id> <height>`.

## 3. Convert

```
npm run content:std realpumpkin
npm run content:library
```

This puts the model on the contract — one metre is one metre, feet on the
ground, facing the child — thins it, fixes its materials, and writes
`app/assets/models/realpumpkin.glb`. The second command adds it to the list
the app and the checker read.

Most models need one or two lines added to the record first. Open
`raw/realpumpkin.meta.json` and add what applies:

| Line | When | What it does |
|---|---|---|
| `"fit": "longest"` | Anything that lies flat or long: a bat, a pen, a boat, a fence | `targetHeight` becomes the longest side, not the height |
| `"yaw": 90` | It faces the wrong way | Turns it about the vertical, in degrees. Look, then set. |
| `"pitch": 90` | It stands when it should lie, or lies when it should stand | Tips it over |
| `"roll": -66` | It is posed at an angle no pitch or yaw will straighten | Leans it |
| `"simplify": 0.3` | Over 20,000 faces | Keeps that fraction of the faces. `"simplifyError": 0.01` keeps the shape closer at the cost of fewer faces removed. |
| `"join": true` | Many separate parts (a bicycle, an aeroplane) | Joins them so the headset draws it in a few strokes, not two hundred |
| `"smoothAngle": 60` | Flat-shaded, faceted look on curves | Smooths the shading. Also what lets a hard-edged model thin. |
| `"keepNodes": ["Pumpkin_01"]` | A pack of many things | Keeps only the named parts |
| `"dropNodes": ["Floor"]` | A model that comes with a floor, a stand, a plate | Removes the named parts |
| `"keepPieces": {"x": [null, 0.9]}` | One mesh holding two things side by side | Keeps the loose pieces whose centre is inside the box, in the file's own units |
| `"palette": {"Straw": "#7fc23a"}` | A colour must change | Tints the named material. Add `"plain": ["Straw"]` to replace its texture with the colour instead of tinting it. |
| `"metallic": true` | A car, a bicycle, a bell | Keeps its shine; everything else is made matt |
| `"alphaMode": "mask"` | Leaves and grass cut out of a texture | Hard cut-outs instead of blending, which costs a second drawing pass |
| `"emissive": 0.3` | A scan that glows because its light map is its colour map | Dims the glow |
| `"castShadow": false` | in the **lesson**, not here — see step 4 | |

The converter prints what it did: size, faces, "smoothed", "✂ 1" for a dropped
part. If the faces are still high after `simplify`, the model probably has a
normal per face and nothing welds; `smoothAngle` fixes that, because the
normals are dropped before thinning and rebuilt after.

Glass is handled without asking: a glTF glass that asks the renderer to draw
the whole scene twice is made thin and blended at intake.

## 4. Place

```
npm run content:place -- evs-lkg-market pumpkin realpumpkin
npm run content:place -- evs-ukg-flowers marigold realmarigold --size 0.3
npm run content:place -- hin-nur-vadya-yantra dholak realdholak --size 0.3 --rotation "0 45 0"
```

Lesson id, object id, model id. The object keeps the size it had — the new
model's longest side is made to match the old one's. When the object was built
by code and had no old model, say how big with `--size`, in metres. Add
`--rotation` if step 6 shows it facing the wrong way.

Two things the command will not decide for you, in the lesson file:

- `"castShadow": false` on an object that does not need a shadow (a patch of
  grass, a small thing on the ground) saves its faces being drawn twice. Use it
  when step 5 says a lesson is over budget.
- `"contact": false` on an object that is not standing on anything — a kite in
  the air, a starfish lying flat — removes the dark patch under it.
- An animal needs `"clip": "<name>"` to move; the converter prints the clip
  names. The command drops a clip the new model does not have.

## 5. Check

```
npm run content:check
```

Every lesson, against the headset's limits: 150,000 faces with shadows, 100
draw calls, at most four distinct props per stage, every clip and audio file
present, every licence allowed. A lesson over budget names the rule; the usual
cure is `castShadow: false` on something small, or more `simplify` on the
heaviest model.

## 6. Look

```
npm run serve
```

then open

```
http://localhost:4500/app/?lesson=evs-lkg-market&role=teacher&look=pumpkin
```

The page shows a close-up of each named object, the whole set from where the
child sits, and each one's size in metres. `&look=all` shows every object in
the lesson. Click to close. Look for:

- **Size.** Does it look right beside its neighbours? A 0.25 m pumpkin beside
  a 0.08 m apple, not the other way round.
- **Way up and way round.** Handle towards the child; nothing lying on its
  side that should stand.
- **Floating or sinking.** The base should read `y = 0.00` on the ground, or
  the table height on a table.
- **Anything that came with it.** A floor, a stand, a second object: back to
  step 3 with `dropNodes`.

Fix, `npm run content:std` again if the record changed, and look again. Two or
three rounds is normal.

## 7. Credit and report

```
npm run content:credits
npm run content:objects
```

`docs/CREDITS.md` is what CC-BY requires of us; `docs/OBJECT-REPORT.md` is
what is realistic, what is still built by code, and why. Both are generated;
do not edit them by hand.

## 8. When nothing free exists — an AI model

For some things there is no free model worth having: a peacock, an Indian
farmer, a marigold. Then one is made from a sentence or a photo.

| Service | Cost | Notes |
|---|---|---|
| Tripo | Free trial wallet, then paid | Key already in `.env` as `TRIPO_API_KEY`. Can also rig a model and give it a walk. |
| Hyper3D Rodin | Free to try; about $1.50 per model downloaded, or $30 a month | Exports GLB. Also reachable from Blender MCP. |
| Meshy | Free plan cannot download the full-quality model | Paid only, in practice |

Whichever is used: download the GLB, put it at `raw/<id>.glb`, and write the
record by hand, the way `raw/peacocktripo.meta.json` does — `source` naming
the service and date, `licence` `CC-BY`, `url`, `targetHeight`, and a `notes`
line saying it is AI-made. Then steps 3 to 7 as usual.

Be careful with AI animals and people. The first AI peacocks had pale, oddly
long legs; a photo-based retry came out flat and twisted. Look hard in step 6,
and never put one in front of a child without Manas seeing it first.

## What stays built by code, on purpose

Letters, numerals, counters, mats, shapes, the planets. A door and a gate that
must open. The market stall the fruit stands on. These are meant to be simple
or must move in a way a downloaded model cannot. The report lists them with a
reason each; when something new must stay drawn, add its reason to
`tools/build/object-report.js`.

## Rules learned the hard way

- **Look before you download.** Names lie; thumbnails do not.
- **Never replace a model Manas likes.** If it is in a lesson and he has seen
  it, it stays. Ask.
- **Never edit the farmyard, the school or the solar system.** They are his.
- **One at a time in the lesson file.** `content:place` edits one object and
  leaves every other line as it was; hand edits with a script have broken the
  formatting before.
- **Keep the working folder clean when publishing.** Publish from a clean
  copy of `main` (`git worktree add … origin/main`), never from a folder with
  half-recorded audio in it.
- **The check is not the look.** A lesson can pass every rule with a starfish
  standing on its head. Step 6 is not optional.
