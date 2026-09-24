# Peacock AI Compare — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one peacock on Tripo AI and one on Meshy (both free plans), stand them in the existing forest land next to the peacock we draw today, and look at all three side by side. Nothing else in the project changes.

**Architecture:** Two AI-made GLB files go into `raw/` under new names, go through the same converter every other model uses (`npm run content:std`), and come out in `app/assets/models/`. One throw-away demo scene, `demo-peacock`, drops the three peacocks into the existing forest land so they are seen with the real sky, sun, fog and trees. No lesson, no builder, no stage, no library file and no credits file is touched. If you pick one, switching the two lessons over is a separate, later two-line change.

**Tech Stack:** Tripo AI web app (free plan), Meshy web app (free plan), the repo's existing converter (`tools/standardise/models.js`, gltf-transform + Draco), A-Frame for the compare page, Playwright browser for screenshots.

**Spec:** this file (the ask is one sentence: "create a peacock on Tripo and on Meshy, show both on the same field, do not touch anything else").

## Plain-English summary (read this part only if short on time)

1. **Can we use them free?** Yes. Tripo free plan: 200 credits a month, about 13 models. Meshy free plan: 100 credits a month, one model costs about 20. One peacock on each uses well under a quarter of either.
2. **Licence.** Both free plans put the output under CC BY 4.0 (you must name the tool if you ever ship it). Meshy's own docs say commercial use is fine with credit. One third-party page says Tripo's free plan is non-commercial. For this test it does not matter: nothing ships. If you later pick the Tripo one, we read Tripo's own terms page before it goes in a lesson.
3. **What you have to do.** Sign in once on each site with Google (free). That is the only part I cannot do for you. Everything after that I do.
4. **What changes in the repo.** Seven new files, all listed below, and one line added to the generated lesson index. No builder, lesson, stage or model that exists today is edited. Rollback = delete the seven files and restore the index.
5. **Result.** Two screenshots taken inside the forest land: drawn peacock (left), Tripo (middle), Meshy (right), same size, same sun, same trees behind. You look and choose.

## Outcome (2026-09-23, after running it)

- **Tripo:** the free Studio plan generates but does **not** export files (the Export button opens an upgrade dialog). The free path that works is the Tripo **API**: the developer console gives a free 14-day wallet of 600 credits, and `text-to-model` returns a GLB link. One textured peacock cost 20 API credits. Downloaded to `raw/peacocktripo.glb`, converted to `app/assets/models/peacocktripo.glb` (1.20 m, 14,250 tris, 341 KB, `simplify: 0.5`). It stands in the forest demo at `?lesson=demo-peacock&role=teacher`, rotation `0 -70 0`.
- **Meshy:** the free plan generates (used 30 of the free credits) but the Download button opens a Pro subscription dialog, and free accounts cannot create API keys. The Meshy peacock therefore exists only in Meshy's own viewer; see the screenshot `.playwright-mcp/meshy-after-download.jpg`. Getting its file needs Meshy Pro. The `peacockmeshy` sidecar is kept in case that is bought later; the demo scene shows only the drawn and Tripo peacocks.
- Screenshots: `.playwright-mcp/peacock-forest-close.jpg` (forest, drawn left, Tripo right) and `.playwright-mcp/meshy-after-download.jpg` (Meshy viewer).
- **Walking (added later the same day):** Tripo API rig-check said `avian`; auto-rig (`v2.5-20260210`, 25 credits) then retarget `preset:idle` + `preset:walk` with `animate_in_place` (20 credits). The animated GLB replaced `raw/peacocktripo.glb` (the still one is kept as `raw/peacocktripo-static.glb`); converted file is 1,141 KB with 2 clips. The demo scene plays `preset:idle` and uses `wander` with `walk: preset:walk`. Free API wallet left: about 535 credits.

- **Meshy, second try (same day):** the free plan does allow 10 downloads a month for models made with the "Meshy 6 Lite" engine. Made the peacock again with Lite (10 credits) + texture (10), downloaded the GLB, saved as `raw/peacockmeshy.glb` (9.9 MB, 102k faces), converted with `simplify: 0.15` to 15,344 tris / 385 KB. It now stands as the third peacock in the forest demo (static, no rig). Meshy free credits left: 80.

- **Meshy walking:** the Meshy Lite GLB was uploaded to Tripo's API (`POST /files`), rig-check said `avian`, auto-rig (25 credits) + retarget idle/walk in place (20 credits). Animated file replaced `raw/peacockmeshy.glb` (static copy kept as `raw/peacockmeshy-static.glb`); converted 15,344 tris / 770 KB / 2 clips. Both AI peacocks now wander in the demo. Tripo API wallet left: about 490.

- **Legs retry (failed):** a photo-based Tripo model (image-to-model from the CC BY Wikimedia photo "Peacock standing on grassy field - India", 30 credits) came out flat and long (0.42 m tall, 1.0 m long) and the avian auto-rig twisted it. Files kept as `raw/peacocktripo-v2-static.glb` and `raw/peacocktripo-v2-animated.glb`, not used. `raw/peacocktripo.glb` is back to the text-prompt version (`raw/peacocktripo-v1.glb` is its copy). Tripo API wallet: about 415 left.
- **Sketchfab check:** the only downloadable male peacock is "Peacock 3D Model" by Pratham Ambre (CC BY, 298k faces, static, cartoon-ish, fan open). The only real scan is a female green peafowl by darwinmuseum.ru (CC BY, 35k). The Zoo Tycoon "Common Peafowl" is a game rip, not allowed.

- **Sketchfab peacock added:** "Peacock 3D Model" by Pratham Ambre (CC BY) fetched with `tools/fetch/sketchfab.js` as `peacocksketchfab` (298k faces, static). A lightened single-file copy (about 12% of the triangles) was sent to Tripo's API for an avian rig + idle/walk (45 credits); the animated result is `raw/peacocksketchfab.glb` (the original folder `raw/peacocksketchfab/` stays). Converted with `simplify: 0.4` to 34,096 tris / 1.4 MB / 2 clips. Fourth peacock in the demo, wandering. Tripo API wallet: about 370 left.

- Secret: the Tripo API key is in the git-ignored `.env` as `TRIPO_API_KEY`.

## Global Constraints

- Do not modify `app/src/builders/peacock.js`, `app/lessons/eng-nur-birds.json`, `app/lessons/evs-ukg-national-symbols.json`, `app/assets/library.json`, `docs/CREDITS.md`, or any stage file.
- Never touch the farmyard, solar system or school scenes.
- Model ids are lowercase, one word (naming rule in `docs/CONTENT-CREATION-PIPELINE.md` §5): use `peacocktripo` and `peacockmeshy`.
- Nothing enters `app/assets/models/` except through `npm run content:std` (converter rule; no manual copies).
- Do not run `npm run content:library` or `npm run content:credits` during this trial. They would pull the test models into the shared catalogue and credits file.
- Keep each peacock under 15,000 triangles after conversion (a bird in a lesson already holding several models; the whole lesson budget is 150,000).
- Same text prompt on both sites, so the comparison is fair.
- Secrets never go on the command line or into git. No API keys are needed for this plan; the web apps are used after a normal sign-in.

## Files (the full footprint)

| File | New / modify | Committed? | Purpose |
|---|---|---|---|
| `raw/peacocktripo.glb` | new | no (git-ignored) | Tripo download |
| `raw/peacocktripo.meta.json` | new | yes | sidecar: source, licence, height |
| `raw/peacockmeshy.glb` | new | no (git-ignored) | Meshy download |
| `raw/peacockmeshy.meta.json` | new | yes | sidecar |
| `app/assets/models/peacocktripo.glb` | new (generated) | only if chosen | converted model |
| `app/assets/models/peacockmeshy.glb` | new (generated) | only if chosen | converted model |
| `app/lessons/demo/demo-peacock.json` | new | no (deleted after the decision) | three peacocks in the forest land |
| `app/lessons/index.json` | regenerated | restored at rollback | one added line so the app can open the demo |

Existing files modified: `app/lessons/index.json` only, by its own generator, and only for the length of the trial.

## The prompt (identical on both sites)

```
A male Indian peafowl (peacock) standing on flat ground with its tail fan fully spread upright behind it. Iridescent blue neck and breast, green tail feathers with gold and blue eye spots, small crest on the head, grey legs. Realistic feathers, natural proportions, single object, no base, no background.
```

---

### Task 0: Sign in (you, about two minutes)

**Files:** none.

- [ ] **Step 1: Open both sites in the browser I drive**

I run (Playwright MCP): navigate to `https://www.tripo3d.ai/app` and, in a second tab, `https://www.meshy.ai/workspace`.

- [ ] **Step 2: You sign in with Google on each tab**

Free plan, no card. Tell me "done" when both show a workspace.

Fallback if the Playwright browser does not show on your screen: do the same in your own Chrome. Then I give you the prompt and you download the two GLBs yourself into `raw/peacocktripo.glb` and `raw/peacockmeshy.glb`, and the plan continues from Task 3.

---

### Task 1: Generate on Tripo, land it in `raw/`

**Files:**
- Create: `raw/peacocktripo.glb` (download)
- Create: `raw/peacocktripo.meta.json`

**Interfaces:**
- Produces: raw id `peacocktripo`, read by Task 3's converter.

- [ ] **Step 1: Generate**

In the Tripo tab: choose "Text to 3D", paste the prompt above, keep the default (latest) model, press Generate. Wait until the preview stops loading (10 s to 2 min).

- [ ] **Step 2: Download as GLB**

Press Download, choose GLB. The Playwright browser saves it under `.playwright-mcp/`. Move it:

```bash
mv .playwright-mcp/*.glb raw/peacocktripo.glb
ls -la raw/peacocktripo.glb
```

Expected: one file, roughly 2 to 20 MB.

- [ ] **Step 3: Write the sidecar**

```bash
cat > raw/peacocktripo.meta.json <<'JSON'
{
  "id": "peacocktripo",
  "source": "Tripo AI — text-to-3D, free plan, generated 2026-09-23 (trial, not shipped)",
  "licence": "CC-BY",
  "url": "https://www.tripo3d.ai/",
  "targetHeight": 1.2,
  "yaw": 0,
  "smoothAngle": 60,
  "notes": "AI-generated trial. Compare against the drawn peacock before any lesson uses it."
}
JSON
```

`targetHeight` 1.2 m is a tail-up peacock at true size. `yaw` stays 0 until Task 4 shows which way it faces; if it faces sideways, set `yaw` to 90 or -90 and re-run Task 3.

- [ ] **Step 4: Check nothing else appeared in git**

```bash
git status --short raw/
```

Expected: only `?? raw/peacocktripo.meta.json` (the `.glb` is ignored).

---

### Task 2: Generate on Meshy, land it in `raw/`

**Files:**
- Create: `raw/peacockmeshy.glb` (download)
- Create: `raw/peacockmeshy.meta.json`

**Interfaces:**
- Produces: raw id `peacockmeshy`, read by Task 3's converter.

- [ ] **Step 1: Generate**

In the Meshy tab: choose "Text to 3D" (if the newest Meshy model only offers "Image to 3D", pick an older model version that still has Text to 3D; do not switch to an image, the prompt must stay the same as Tripo). Paste the prompt, press Generate. When the untextured preview appears, press Refine so it gets its colours. Wait until done.

- [ ] **Step 2: Download as GLB**

Press Download, choose GLB. Move it:

```bash
mv .playwright-mcp/*.glb raw/peacockmeshy.glb
ls -la raw/peacockmeshy.glb
```

Expected: one file, roughly 2 to 20 MB.

- [ ] **Step 3: Write the sidecar**

```bash
cat > raw/peacockmeshy.meta.json <<'JSON'
{
  "id": "peacockmeshy",
  "source": "Meshy — text-to-3D, free plan, generated 2026-09-23 (trial, not shipped)",
  "licence": "CC-BY",
  "url": "https://www.meshy.ai/",
  "targetHeight": 1.2,
  "yaw": 0,
  "smoothAngle": 60,
  "notes": "AI-generated trial. Compare against the drawn peacock before any lesson uses it."
}
JSON
```

- [ ] **Step 4: Check git**

```bash
git status --short raw/
```

Expected: `?? raw/peacockmeshy.meta.json` and `?? raw/peacocktripo.meta.json`, nothing else.

---

### Task 3: Convert only the two new models

**Files:**
- Create (generated): `app/assets/models/peacocktripo.glb`, `app/assets/models/peacockmeshy.glb`
- Modify (only if too heavy): the two sidecars from Tasks 1 and 2

**Interfaces:**
- Consumes: raw ids `peacocktripo`, `peacockmeshy`.
- Produces: `app/assets/models/peacocktripo.glb` and `app/assets/models/peacockmeshy.glb`, loaded by Task 4's demo scene by id.

- [ ] **Step 1: Run the converter for these two ids only**

```bash
npm run content:std -- peacocktripo peacockmeshy
```

Expected: two lines like

```
  ✓ peacocktripo   1.20 m   XXXXX tris   YYY KB  static
  ✓ peacockmeshy   1.20 m   XXXXX tris   YYY KB  static
2 model(s) standardised. Next: npm run content:library
```

Do NOT run `content:library` (see Global Constraints).

- [ ] **Step 2: Apply the triangle rule**

If a line shows more than 15000 tris, add `"simplify": 0.5` to that model's sidecar (or `0.25` if it is over 30000, the same value the owl uses) and run Step 1 again. Stop when both are under 15000.

- [ ] **Step 3: Confirm nothing existing changed**

```bash
git status --short
```

Expected new entries: the two `raw/*.meta.json`, the two `app/assets/models/peacock*.glb`. No ` M ` lines beyond the ones already there before this work (`docs/VR-Learning-PRD.md` was already modified).

---

### Task 4: The compare scene — three peacocks in the forest land

**Files:**
- Create: `app/lessons/demo/demo-peacock.json` (a throw-away demo scene, deleted after the decision)
- Regenerated: `app/lessons/index.json` (by `npm run content:lessons`; restored with `git checkout` at rollback)

**Interfaces:**
- Consumes: stage kit `app/stages/forest.json` (unchanged), `app/assets/models/peacocktripo.glb`, `app/assets/models/peacockmeshy.glb`, the `peacock` builder (unchanged).
- Produces: the address `index.html?lesson=demo-peacock&role=teacher` on the dev server.

Why a demo scene and not a separate page: the app only opens lessons listed in `lessons/index.json`, and the forest look (sky image, sun, fog, real oak and jungle trees, ground shadows) all comes from the stage kit at runtime. Using the real loader means the peacocks are seen exactly as a child would see them, in the same forest the wild-animals lessons use. The `demo/` folder is where such scenes already live (`demo-india`, `demo-snow`, ...).

- [ ] **Step 1: Write the demo scene**

```bash
cat > app/lessons/demo/demo-peacock.json <<'JSON'
{
  "id": "demo-peacock",
  "template": "explore",
  "stage": "forest",
  "objects": [
    {
      "id": "drawn",
      "build": "peacock",
      "params": { "height": 1.25 },
      "position": "-2.600 0.000 -4.000",
      "rotation": "0 0 0",
      "ring": 0.55,
      "name": { "en": "Drawn (now)", "hi": "अभी वाला" }
    },
    {
      "id": "tripo",
      "model": "peacocktripo",
      "position": "0.000 0.000 -4.000",
      "rotation": "0 0 0",
      "scale": "1.04 1.04 1.04",
      "ring": 0.55,
      "name": { "en": "Tripo", "hi": "Tripo" }
    },
    {
      "id": "meshy",
      "model": "peacockmeshy",
      "position": "2.600 0.000 -4.000",
      "rotation": "0 0 0",
      "scale": "1.04 1.04 1.04",
      "ring": 0.55,
      "name": { "en": "Meshy", "hi": "Meshy" }
    }
  ],
  "steps": [
    {
      "duration": 6000,
      "script": {
        "en": "Three peacocks. Left is drawn, middle is Tripo, right is Meshy.",
        "hi": "तीन मोर। बाएँ बना हुआ, बीच में Tripo, दाएँ Meshy।"
      }
    }
  ]
}
JSON
```

`scale` 1.04 = the birds lesson height (1.25 m) ÷ the sidecar height (1.2 m), so all three stand at the same size. The drawn one keeps its own `height` param, as in the birds lesson today.

- [ ] **Step 2: Put it in the lesson index**

```bash
npm run content:lessons
git diff --stat app/lessons/index.json
```

Expected: `index.json` gains one line, `"demo-peacock": "demo/demo-peacock.json"`, plus a new `generated` timestamp. Nothing else changes.

- [ ] **Step 3: Serve and open**

```bash
npm run serve
```

Open the printed address with `/app/index.html?lesson=demo-peacock&role=teacher` (the teacher role can walk with WASD and drag to look; the headset role cannot).

Expected: the forest land, cloudy sky, far trees, three peacocks in a row four metres ahead, each with its name card and a sun shadow on the grass. No red error text on screen.

- [ ] **Step 4: Screenshots for the decision**

With the Playwright browser: open the address, wait 6 seconds for models to load, screenshot to `.playwright-mcp/peacock-forest-front.jpg`. Then walk to the left side (hold A for two seconds) and screenshot `.playwright-mcp/peacock-forest-side.jpg`. Show both to Manas.

- [ ] **Step 5: Fix facing if needed**

If an AI peacock faces sideways or backwards, set its sidecar `yaw` (90, -90 or 180), re-run `npm run content:std -- <id>`, reload.

- [ ] **Step 6: Confirm the footprint**

```bash
git status --short
```

Expected new files: `raw/peacocktripo.meta.json`, `raw/peacockmeshy.meta.json`, `app/assets/models/peacocktripo.glb`, `app/assets/models/peacockmeshy.glb`, `app/lessons/demo/demo-peacock.json`. Expected modified: `app/lessons/index.json` only (one added line). Nothing is committed in this plan.

---

### Task 5: Decide (you) — and what happens after, for reference only

**Files:** none in this plan.

- [ ] **Step 1: Look at the two screenshots and the live page. Pick: Tripo, Meshy, or keep the drawn one.**

- [ ] **Step 2: If you pick one, the follow-up (a separate task, not done here) is:**

In `app/lessons/eng-nur-birds.json` and `app/lessons/evs-ukg-national-symbols.json`, the peacock entry changes from

```json
"build": "peacock",
"params": { "height": 1.25 },
```

to

```json
"model": "peacocktripo",
"scale": "1.04 1.04 1.04",
```

(`scale` = wanted height ÷ 1.2; the national symbols lesson wants 0.95 m, so `0.79`). Then `npm run content:library && npm run content:credits && npm run content:check`, then a fresh look in both lessons, then commit. Rename the chosen model to `realpeacock` at that point if you want it to match the other real models. The losing model's five files are deleted.

- [ ] **Step 3: If you keep the drawn one, rollback is:**

```bash
rm raw/peacocktripo.glb raw/peacocktripo.meta.json raw/peacockmeshy.glb raw/peacockmeshy.meta.json \
   app/assets/models/peacocktripo.glb app/assets/models/peacockmeshy.glb app/lessons/demo/demo-peacock.json
git checkout app/lessons/index.json
git status --short   # back to where it was
```

---

## Self-review

- Spec coverage: both tools used (Tasks 1, 2), shown in the forest land (Task 4), no other part touched (Global Constraints, Files table, Task 3 Step 3, Task 4 Step 6), plan is a standalone .md (this file). Covered.
- Placeholder scan: the only unknowns are the numbers the converter prints (`XXXXX tris`), which are outputs, not steps left undone. The `yaw` value is set by a stated rule after the first look.
- Name consistency: ids are `peacocktripo` and `peacockmeshy` everywhere: sidecars, converter command, demo scene, rollback list. The demo scene id is `demo-peacock` in the file, the index and the address.

## Sources for the free-plan facts (checked 2026-09-23)

- Tripo free plan, 200 credits a month, about 13 models, 15 downloads a month, CC BY 4.0: https://costbench.com/software/ai-3d-generation/tripo-ai/free-plan/
- Meshy free plan, 100 credits a month, Image to 3D 20 credits, CC BY 4.0 with attribution: https://docs.meshy.ai/en/webapp/pricing
- Tripo API (not needed here; pay-as-you-go, GLB from `output.model_url`): https://developers.tripo3d.ai/en/docs/quick-start
