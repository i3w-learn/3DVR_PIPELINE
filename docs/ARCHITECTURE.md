# Architecture

**Companion to** `VR-Learning-PRD.md`. The PRD says *what* we build and *why*.
This says *how the code is laid out* and *which rules keep it from rotting*.

**Status** draft v0.1 — for team review

---

## 1. The one rule everything bends around

**Navigating to a new page destroys the WebXR session** and drops the child back
to the headset's home screen.

So: **one HTML shell, loaded once, never reloaded.** No router, no
`location.href`, no `<a href>`, no page reload. A lesson is *data fetched into the
running page*; the scene graph is rebuilt in place.

Every structural decision below follows from this. When in doubt, ask: does this
reload the page? If yes, it is wrong.

---

## 2. Layer map

Four layers. **Dependencies only ever point downward.** Nothing imports upward,
and nothing in `core` knows that A-Frame or a browser DOM exists.

```
  ┌──────────────────────────────────────────────────────┐
  │  roles/          teacher.js · headset.js             │  wiring only
  ├──────────────────────────────────────────────────────┤
  │  ui/             control-bar · status-strip          │  plain DOM
  │  components/     lesson-sync · highlight · gaze-tap  │  A-Frame
  │  templates/      identify · count · match · …        │  A-Frame
  ├──────────────────────────────────────────────────────┤
  │  core/           schema · transport · clock · state  │  pure JS
  └──────────────────────────────────────────────────────┘
```

| Layer | May use | May NOT use |
|---|---|---|
| `core/` | plain JavaScript | A-Frame, three.js, `document`, `window` |
| `templates/` | A-Frame, `core/` | `ui/`, `roles/`, other templates |
| `components/` | A-Frame, `core/`, `templates/` | `ui/`, `roles/` |
| `ui/` | DOM, `core/` | A-Frame internals, `roles/` |
| `roles/` | everything below | — |

**Why this matters, plainly:** `core/` has no browser in it, so it runs in Node.
That means the lesson schema, the step clock and the message contracts can be
unit-tested on a laptop with no headset, no Pi and no browser. Everything hard to
test is pushed into the thin layers above it.

---

## 3. Folder structure

```
/app
  index.html                 the shell — loads once, never reloads
  manifest.json              PWA manifest, input to Bubblewrap
  sw.js                      service worker — caches everything on install

  /lib                       VENDORED libraries. No CDN. Ever.
    aframe.min.js
    aframe-extras.min.js
    mqtt.min.js

  /src
    /core                    no A-Frame, no DOM — testable in Node
      lesson-schema.js       validate a lesson JSON, fail loudly
      transport.js           the transport INTERFACE (see §5)
      mqtt-transport.js      real implementation — mqtt.js over WebSocket
      local-transport.js     dev implementation — in-page, no Pi needed
      clock.js               step timer. Teacher role only. One clock in the room.
      session.js             current lesson + step + language. Single writer.

    /templates               one interaction pattern each (see §6)
      index.js               name → template lookup
      identify.js
      count.js
      match.js
      sequence.js
      explore.js

    /components              A-Frame behaviours. ONE JOB EACH.
      lesson-sync.js         listen to transport → drive the scene
      highlight.js           the pulsing ring. The whole teaching mechanic.
      gaze-tap.js            fuse cursor → emit a tap event
      idle-motion.js         gentle bob, so a scene reads as film not photo

    /ui                      plain DOM. Teacher role only. Not 3D.
      control-bar.js         script line, Pause, Back, Next, Blackout
      status-strip.js        one tile per headset

    /roles
      teacher.js             owns the clock; publishes; renders control bar
      headset.js             subscribes; publishes heartbeat only

  /lessons                   CONTENT. JSON only, never code.
    evs-lkg-farm-animals.json
    evs-lkg-zoo-animals.json

  /assets
    /models                  cow.glb  hen.glb  tree.glb   (standardised — §7)
    /textures                grass.jpg  ground.jpg
    /audio
      /mr  cow.mp3  hen.mp3
      /hi  cow.mp3  hen.mp3
      /or  cow.mp3  hen.mp3

/tools
  standardise.sh             raw model → standardised model (build time)
  validate-lessons.js        run every lesson JSON through the schema

/docs
  VR-Learning-PRD.md
  ARCHITECTURE.md
```

Two folder rules that are not negotiable:

- **`/lib` is vendored, never CDN.** The app must run with the network off. A
  `<script src="https://unpkg.com/...">` is a silent dependency on the internet and
  will pass every laptop test before failing in the classroom.
- **`/lessons` and `/assets` contain zero code.** If content needs code to work,
  the template is wrong.

---

## 4. SOLID, mapped onto this project

A-Frame is already an entity-component system, which is most of the way to SOLID
by construction. These are the specific readings that apply here.

### S — Single Responsibility: one component, one job

A component does one thing and is named after that thing. This is not style; it
is what makes content additions free.

| Component | Its one job |
|---|---|
| `creature` | swap the model, switch `Idle`↔`Walk` clip |
| `fit-ground` | normalise size, seat feet on the ground |
| `highlight` | draw and pulse the ring |
| `walk-through` | translate toward the viewer |
| `gaze-tap` | turn a fused gaze into a tap event |

**Evidence this works:** in the PoC, adding Donkey and Alpaca was a *zero-code*
change — two lines in the data registry. The components did not know or care
which animal they were operating on.

**The smell:** a component whose name contains "and", or a component that needs a
`switch` on which model it is handling.

### O — Open/Closed: extend with data, never by editing behaviour

| Adding this | Costs | Must NOT cost |
|---|---|---|
| a new lesson | one JSON file | any code change |
| a new object in a lesson | one entry in `objects[]` | any code change |
| a new language | one audio folder | touching a single lesson file |
| a new template | one file in `templates/` | editing `lesson-sync` |

The last row is the one that gets violated first. `lesson-sync` must never grow
an `if (lesson.template === 'count')`. It looks the template up by name and calls
the interface (§6). Five templates and fifteen templates are the same code.

### L — Liskov Substitution: every model is interchangeable

This is the principle that explains **why the asset standardisation pass exists**,
and it is the one most likely to be skipped.

Any `.glb` must be usable anywhere a model is expected, with the scene knowing
nothing about which one it is. That requires every model to honour the same
contract:

- 1 unit = 1 metre
- origin at the base, centred — feet on the ground, not floating
- facing **+Z**
- Draco-compressed, textures ≤ 1024 px
- named lowercase, one word: `cow.glb`

**When this contract is broken, the runtime grows repair code.** The PoC is the
proof: `fit-ground` recomputes a bounding box on every single load, and
`walk-through` carries a per-model `yaw` offset — both purely because the source
GLBs had random scales and random facings. That is the runtime apologising for
dirty assets, every frame, forever.

Fix the asset at build time and both hacks delete themselves. **Repair belongs in
the pipeline, not in the render loop.**

### I — Interface Segregation: an entity gets only what it needs

- A tree gets `gltf-model`. It does not get `animation-mixer`, a raycaster
  target, or a highlight.
- The headset role never loads `ui/`. The teacher role never loads the heartbeat
  publisher.
- MQTT topics stay narrow and single-purpose. `class/state` carries lesson
  position and nothing else; `class/command` carries transient actions and never
  state. A subscriber is never handed a payload it must filter through.

The performance budget makes this concrete rather than academic: every component
attached to an entity costs a `tick` for the life of the scene, and we have 72 fps
to hold on a mobile chip.

### D — Dependency Inversion: depend on contracts, not on concrete things

Three places this is load-bearing:

**1. Components talk through scene events, never by reaching for each other.**

```js
// walk-through.js — announces, and does not know who is listening
this.el.emit('locomotion-start');

// turntable.js and creature.js — listen, and do not know who spoke
this.el.addEventListener('locomotion-start', () => this.stop());
```

The PoC's first pass did the opposite — shared mutable globals (`spinning`,
`window.__walking`, `mi`, `ci`) and components reaching in by ID. It worked and it
was untouchable. Pass 2 replaced all of it with events.

**2. `lesson-sync` depends on a transport interface, not on `mqtt.js`.**

```js
// core/transport.js — the contract, four methods, nothing else
//   connect()
//   publish(topic, payload, opts)
//   subscribe(topic, handler)
//   onStatus(handler)
```

`mqtt-transport.js` implements it for the classroom. `local-transport.js`
implements it in-page for development. **Consequence: the whole app runs on a
laptop with no Pi, no broker and no router** — you build content and templates
before the hardware arrives, and the sync layer stays unit-testable. The PRD's
Appendix B `mosquitto_pub` trick is the same idea from the outside.

**3. Templates depend on the lesson *schema*, not on any lesson.**

A template is given validated data. It never fetches, never parses, never knows a
lesson's id.

---

## 5. Data flow

One direction, always. There is no other path.

```
  lessons/*.json ──fetch──▶ lesson-schema.validate()
                                     │
                                     ▼
  transport ──message──▶ lesson-sync ──▶ template.build()      (once per lesson)
                                     └──▶ template.applyStep()  (once per step)
                                                  │
                                                  ▼
                                         scene graph mutates
```

And who is allowed to speak:

```
  TEACHER (tablet)                       HEADSET (child)
  ────────────────                       ───────────────
  owns clock.js                          owns nothing
  publishes class/state   ──────────▶    subscribes, obeys
  publishes class/command ──────────▶    subscribes, obeys
  subscribes headset/+/status  ◀──────   publishes heartbeat (1 s)
```

Three invariants that kill most of the bugs before they exist:

1. **One clock in the room.** Only the teacher runs the step timer. Headsets run
   none. Nothing can drift because there is nothing to drift against.
2. **Full state, never deltas.** Publish "you are on step 3", never "advance".
   A headset that missed five messages still lands in the right place.
3. **One writer per piece of state.** `session.js` is written by the role module
   and by nothing else. Components read it; they never write it.

---

## 6. The template interface

Five patterns cover 109 curriculum topics. Every template implements exactly this,
and `lesson-sync` knows nothing beyond it:

```js
export default {
  name: 'identify',

  build(stage, lesson)            { /* place objects — once, on lesson load */ },
  applyStep(stage, lesson, step)  { /* highlight, narrate — once per step   */ },
  teardown(stage)                 { /* clear, before the next lesson        */ }
};
```

`identify` · `count` · `match` · `sequence` · `explore`.

**Freeze order is strict, and it is a real dependency, not a preference:**
standardised models → templates → lesson recipes. A recipe cannot reference
`cow.glb` before `cow.glb` exists, and a template cannot be frozen until a real
lesson has been run through it on a real headset.

---

## 7. Build-time vs runtime

The dividing line that keeps the render loop clean:

| Belongs at build time (`/tools`) | Belongs at runtime |
|---|---|
| rescale, re-origin, re-orient models | place objects at lesson positions |
| Draco compression, texture resize | play a named animation clip |
| validate every lesson against the schema | swap the highlighted object |
| cache assets into the service worker | fade, pulse, bob |

**Rule: if it can be decided before the child puts the headset on, decide it
before the child puts the headset on.** We have 13 milliseconds a frame; do not
spend them recomputing facts that were knowable yesterday.

---

## 8. Role split

One codebase, one build, two URLs. There is no second application.

```js
// entry — the first thing that runs, before anything else
const role = new URLSearchParams(location.search).get('role') || 'headset';
document.body.dataset.role = role;
```

```css
body[data-role="headset"] #controls { display: none; }
```

| | `?role=teacher` | `?role=headset` |
|---|---|---|
| Render | flat canvas, full screen | WebXR immersive |
| Overlay | HTML control bar | none |
| Transport | publishes | subscribes only |
| Clock | owns it | none |

The teacher's controls are a `<div>` over the canvas — ordinary buttons and text,
not 3D objects. That is the visible payoff of the product being a web page.

**The one trap that shapes a screen:** a browser will not enter immersive VR on
its own; WebXR demands a user gesture, so `enterVR()` on page load is rejected.
The headset therefore opens on a calm waiting screen with one large Connect
target. That single tap is the gesture — and it is the only tap the child ever
has to make.

---

## 9. Anti-patterns — each one already cost us something

| Do not | Why | Where it bit us |
|---|---|---|
| Load a library from a CDN | app must run with the network off | PoC pulls A-Frame from `aframe.io`, extras from jsDelivr |
| Repair a model at runtime | costs every frame, forever | `fit-ground` bounding-box maths; `walk-through` per-model `yaw` |
| Share mutable globals | components become untouchable | PoC pass 1: `spinning`, `window.__walking`, `mi`, `ci` |
| Reach for another component by ID | invisible coupling | PoC pass 1, fixed by events in pass 2 |
| `if (template === ...)` in `lesson-sync` | breaks Open/Closed at the worst place | — |
| Hardcode content in a `.js` file | a lesson then needs a developer | PoC's `CREATURES` registry — fine for a demo, wrong for 109 topics |
| Put the language in a filename | adding a language reopens every lesson | — |
| Move the camera | nausea, worst at ages 3–6 | PoC still ships teleport + `wasd-controls` |
| Add a realtime shadow | blows the frame budget | — |

---

## 10. Testing seams

| What | How | Needs a headset? |
|---|---|---|
| lesson schema | Node unit test | no |
| step clock | Node unit test, fake timers | no |
| message contracts | `local-transport` in Node | no |
| templates | serve locally, drive with `local-transport` | no |
| full sync | `mosquitto_pub` against a real broker | no |
| **frame rate, draw calls, VR entry, offline storage** | **on the target device** | **yes** |

Only the last row needs hardware — and only the last row can be trusted about
performance. A scene that holds 72 fps in Chrome on a laptop tells you nothing
about a mobile chip. `fps` rides in every heartbeat so the content team can see
which lessons breach budget in real classrooms rather than in review.

---

## 11. Open architectural questions

1. **Where does the teacher's step clock live during a `pause`?** Wall-clock
   remainder or elapsed-since-resume — decide before Phase 1 ends.
2. **Asset preloading between lessons.** Build the next lesson's scene graph off
   screen, or accept a black gap? Affects `teardown`.
3. **Service-worker cache versioning** across an `adb` reinstall — needs to be
   settled before the fleet grows past a handful of headsets.
4. **Headset id assignment.** `localStorage` survives reinstall on some devices
   and not others; a QR or a one-time setup screen may be needed.

---

## 12. Summary — the seven rules

1. One shell. Never reload the page.
2. Dependencies point downward. `core/` never sees A-Frame or the DOM.
3. One component, one job, named after that job.
4. New content is data. New behaviour is code. Never mix them.
5. Every model honours the same contract, enforced at build time.
6. Components announce with events; they never reach for each other.
7. One clock in the room, full state on the wire, one writer per piece of state.

---

See also: `CONTENT-ARCHITECTURE.md` — the library, the land, and the asset
intake pipeline.
