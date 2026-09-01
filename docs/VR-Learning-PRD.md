# VR Learning for Pre-Primary — Product Requirements Document

**Version** 0.3 (draft for team review)
**Date** August 2026
**Owner** i3w
**Status** For discussion — open questions listed in §12

**Changed in 0.3** — a named build order for the first eleven lessons (§4.2), so
content work can start before the headset decision lands; the role switch made
concrete in the shell, including the user-gesture constraint on entering VR
(§6.2); precedent and its limits for shipping a web app as an APK (Appendix A);
stale references to React Native removed (§3, §5.6, §9).

**Changed in 0.2** — the tablet and headset are now one application in two roles
(§6.2), which withdraws the separate React Native app (§8, Appendix A); lesson
steps carry a `duration` and advance on their own, driven by a single timer on the
tablet (§7.1, §7.2); the teacher's view of the lesson is a local render rather than
a stream, which partly closes open question 7 (§2, §12).

---

## 1. Summary

A teacher-led virtual reality classroom for children aged 3 to 6 in Anganwadi centres and pre-primary schools.

Each child wears a headset. The teacher holds a tablet. The teacher decides what every child sees — a farm, a zoo, a market, a classroom of letters and numbers — and taps a button to move all headsets forward together.

The technical bet: **a VR scene is a web page.** The entire product is HTML files rendered by A-Frame, packaged as an offline Android app, coordinated by a small message broker on the classroom's own router. No game engine. No internet. No paid dependencies.

That bet pays twice. The same page that fills a child's field of view in the
headset fills the teacher's tablet screen as a flat, moving picture — so the
teacher watches the lesson play like a video while the children stand inside it,
from one codebase and with no video streamed anywhere.

### Why this shape

| Constraint | Design response |
|---|---|
| Children can't read or navigate menus | Teacher controls everything; child only looks and taps |
| Rural centres have no reliable internet | All content ships inside the app; nothing streams |
| Team is web developers with no 3D background | A-Frame — HTML tags, not a game engine |
| Teacher must see the lesson to narrate it | Same app, flat mode on the tablet — not a stream from a headset |
| 109 curriculum topics, small team | Fixed scene templates + JSON recipes, not bespoke builds |
| No budget for licences | Every tool and asset source is free and CC0 |

---

## 2. Goals and non-goals

### Goals

1. A teacher with no technical training can run a 10-minute VR lesson for 25 children.
2. Lessons run with zero internet connectivity.
3. Adding a new lesson requires writing a JSON file, not writing application code.
4. Adding a new language requires swapping audio files, not re-authoring lessons.
5. A headset that crashes mid-lesson rejoins at the correct step automatically.
6. Total software and asset licensing cost: zero.

### Non-goals (v1)

- Free child movement or locomotion. The child is seated; the teacher controls the scene.
- Multiplayer or child-to-child interaction.
- Assessment, scoring, or progress tracking per child.
- Content authoring by teachers. Content comes from the pipeline.
- Cloud sync, accounts, or analytics.
- Live video *streamed from* a child's headset to the tablet. (Deferred — see §12. The teacher
  still sees the lesson: the tablet renders the same scene itself. See §6.2.)

---

## 3. Users

**The child (3–6).** Cannot read. Short attention span. Seated. Wears the headset for 8–12 minutes. Sees a 3D world, hears narration in their own language, occasionally looks at an object and taps.

**The teacher.** Holds the tablet. Watches the same lesson play on it, flat, as the children watch it in the round — so she can narrate over it and see what they are reacting to. Reads a script aloud or lets recorded narration play. Pauses, repeats, or blacks out when she needs the room's attention. Glances at a strip showing which headsets are alive, their battery, and whether a child has taken theirs off.

**The content team.** Writes lesson JSON, pulls CC0 assets, reviews scenes on a real headset before release.

---

## 4. Scope of content

The Pre-Primary curriculum (Nursery, LKG, UKG across English, Maths, EVS, Hindi, GK) is **109 topics**. These collapse into a small number of repeating interaction patterns.

### 4.1 Templates (build ~5 for v1, ~10 eventually)

| Template | Pattern | Example topics |
|---|---|---|
| `identify` | Object highlights, narration names it | Farm animals, fruits, vehicles |
| `count` | N objects appear, narration counts them | Numbers 1–10 |
| `match` | Two sets, child links them | Animal to home, shape to shape |
| `sequence` | Steps play in order | Brushing teeth, seed to plant |
| `explore` | Free look, tap any object to hear its name | Market, classroom, kitchen |

A topic becomes a small JSON recipe naming which template, which objects, which audio.

### 4.2 The first eleven lessons

Content is the long pole, and none of it depends on which headset is bought. The
build order below is chosen so that work can start immediately and prove the whole
pipeline early:

- every object listed has a known CC0 model, so nothing waits on commissioning
- all five templates are exercised, so each is tested before it is frozen
- eleven lessons are dressed from **three** scene set-ups, so asset work compounds

| # | Lesson | Template | Stage |
|---|---|---|---|
| 1 | Farm animals | `identify` | outdoor |
| 2 | Wild animals (zoo) | `identify` | outdoor |
| 3 | Fruits | `identify` | indoor |
| 4 | Vehicles | `identify` | outdoor |
| 5 | Numbers 1–5 | `count` | outdoor — farm set reused |
| 6 | Numbers 6–10 | `count` | outdoor — farm set reused |
| 7 | Shapes | `match` | indoor |
| 8 | Animal homes | `match` | outdoor |
| 9 | Brushing teeth | `sequence` | indoor |
| 10 | Seed to plant | `sequence` | outdoor |
| 11 | Classroom or market | `explore` | indoor |

**Order of work within content, and it is strict:** standardised models first
(§7.4), then the five templates, then the JSON recipes. A recipe cannot reference
`cow.glb` before `cow.glb` exists, and a template cannot be frozen before a real
lesson has been run through it.

**Narration is not on this critical path.** Author `script` text only and let the
teacher read it aloud. Because language is a folder and never part of a lesson
file (§7.1), recorded audio can be added later without reopening a single lesson.

### 4.3 Environments

Full 3D scenes, not 360° photographs. A textured ground plane, a flat or gradient sky, reused tree and prop models, and animated animals.

Two base stages — **outdoor** (ground + sky + nature props) and **indoor** (room shell + furniture props) — dressed differently produce farm, forest, zoo, classroom, home, and kitchen.

> **Correction to earlier planning:** an earlier draft proposed 360° panorama backdrops as the primary technique. The reference material the team is targeting is full real-time 3D. 360° panoramas are retained only as an optional cheap backdrop for distant scenery, not as the main approach.

---

## 5. Architecture — the wiring

### 5.1 Physical layer

A battery or mains travel router in the classroom creates a Wi-Fi network. It has **no WAN connection**. It runs DHCP and hands addresses to the tablet and every headset.

A small single-board computer (Raspberry Pi Zero 2 W or similar) plugs into the router and runs the message broker.

```
                    Travel router (Wi-Fi, no internet)
                                 |
        +------------------------+------------------------+
        |                        |                        |
   Teacher tablet          Pi (Mosquitto)          25 × headsets
```

**Why the broker sits on the Pi and not the tablet:** if the teacher's tablet crashes or is rebooted, the session state survives. The tablet becomes just another client.

### 5.2 Message layer — MQTT

MQTT is a publish/subscribe protocol over TCP. The tablet publishes; headsets subscribe; the broker fans out. The tablet never knows how many headsets exist.

Two MQTT features do the heavy lifting and are the reason for choosing it over a raw WebSocket:

- **Retained messages.** The broker stores the last message on a topic. A headset that reboots mid-lesson subscribes and immediately receives current state — it rejoins at the right step with no reconnect logic written by us.
- **Last Will and Testament.** Each headset registers a message at connect time. If it disconnects ungracefully, the broker publishes that message on its behalf. Dead-headset detection for the teacher's status board, free.

### 5.3 Topics

| Topic | Publisher | Subscribers | Retain | QoS |
|---|---|---|---|---|
| `class/state` | Tablet | All headsets | yes | 1 |
| `class/command` | Tablet | All headsets | no | 1 |
| `headset/<id>/status` | Headset | Tablet | no | 0 |
| `headset/<id>/lwt` | Broker (on death) | Tablet | yes | 1 |

The tablet subscribes to `headset/+/status` — one subscription covers all 25.

### 5.4 Message contracts

**`class/state`** — the authoritative lesson position. Sent as full state, never as a delta, so a headset that missed a message still lands correctly.

```json
{
  "seq": 47,
  "lesson": "evs-lkg-farm-animals",
  "step": 3,
  "lang": "mr",
  "highlight": "cow"
}
```

**`class/command`** — transient actions that are not state.

```json
{ "cmd": "pause" }
{ "cmd": "blackout" }
{ "cmd": "recentre" }
```

**`headset/<id>/status`** — heartbeat, published every 1000 ms.

```json
{ "id": 7, "battery": 62, "worn": true, "seq": 47, "fps": 74 }
```

**`headset/<id>/lwt`** — registered at connect, published by the broker on ungraceful disconnect.

```json
{ "id": 7, "state": "offline" }
```

### 5.5 Rules that prevent most bugs

1. **Sequence numbers.** Every `class/state` carries `seq`. A headset ignores any message whose `seq` is lower than its current one.
2. **Full state, never deltas.** Never publish "next step". Publish "you are now on step 3".
3. **Keepalive 30 s.** Broker declares a client dead after 1.5× that and fires its Will.
4. **Clean session false.** Broker remembers subscriptions across reconnects.

### 5.6 Transport detail

Browsers cannot open raw TCP sockets, and both roles run in a browser engine, so `mqtt.js` connects over **MQTT-over-WebSocket**. Mosquitto is configured with two listeners:

```
listener 1883
protocol mqtt

listener 9001
protocol websockets

allow_anonymous true
```

`allow_anonymous true` is acceptable only because the network is physically isolated with no WAN. Revisit if the router ever gains internet access.

---

## 6. The application

### 6.1 The critical constraint

**Navigating to a new page destroys the WebXR session** and returns the child to the Quest home screen.

Therefore the app is a **single HTML shell that never reloads.** Lessons are data fetched into it, and the scene graph is rebuilt in place. There is no routing, no page navigation, no `location.href`.

This is the single most important architectural rule in the product.

### 6.2 One app, two modes

The same build serves both devices. There is no separate tablet application and no
separate headset application — one shell, one set of lessons, one set of assets,
distinguished at launch by a role flag.

```
                    one scene file
                          |
          +---------------+---------------+
          |                               |
   Tablet — flat mode              Headset — VR mode
   canvas fills the screen,        canvas fills the field of view,
   teacher controls on top         no overlay of any kind
```

| | `?role=teacher` (tablet) | `?role=headset` (headset) |
|---|---|---|
| Render | A-Frame canvas, flat, full screen | A-Frame canvas, WebXR immersive |
| Looks like | a video playing | the world |
| Overlay | control bar: script text, Pause, Back, Next, Blackout | none |
| MQTT | publishes `class/state` and `class/command` | subscribes only |
| Step timer | owns it | none — obeys what it is told |

**Why this works.** A-Frame renders to an ordinary canvas by default and enters
WebXR only when asked. Flat rendering is not a fallback or a simulation — it is
the same scene graph, the same models, the same animations, drawn to a rectangle
instead of to two eye buffers. The teacher is therefore looking at exactly what
the children are looking at, produced locally, with no video stream between them.

**Why the controls are plain HTML.** The overlay is a `<div>` positioned over the
canvas — ordinary buttons and text, not 3D objects. Nothing about the teacher's
control bar has to be built in 3D, and in the headset role the element is simply
not rendered.

**How the switch is made.** One read at start-up, before anything else:

```js
const role = new URLSearchParams(location.search).get('role') || 'headset';
document.body.dataset.role = role;          // CSS hides the overlay unless teacher
```

```css
body[data-role="headset"] #controls { display: none; }
```

The teacher role additionally owns the step timer and is the only client that
publishes. The headset role subscribes and never publishes anything but its
heartbeat.

**One trap, and it decides a screen.** A browser will not enter immersive VR on
its own — WebXR requires a user gesture, so `scene.enterVR()` called on page load
is rejected. The headset therefore opens on a calm waiting screen — the centre's language,
a status line reading *searching* then *connected, waiting for teacher*, and one
large Connect target filling most of the view. That single tap is the gesture. It is not a
compromise: it also gives the child a moment to settle the headset on their face
before the world appears, and it is the only tap the child ever makes.

**Confirm this in Phase 0.** Whether a Bubblewrap-packaged app on the chosen
headset can enter VR with one gesture, and stay there across a full lesson, is
part of the same feasibility question as offline storage (§9, Phase 0).

**Consequence for packaging.** Both roles ship as Bubblewrap APKs from the same
source. The tablet APK launches at `?role=teacher`, the headset APK at
`?role=headset`. The teacher never sees a browser, an address bar, or a URL.

### 6.3 Structure

```
/app
  index.html          the shell — loads once, never reloads
  sw.js               service worker, caches everything
  manifest.json       PWA manifest for Bubblewrap
  /lessons
    evs-lkg-farm-animals.json
    evs-lkg-zoo-animals.json
  /assets
    /models    zebra.glb  cow.glb  tree.glb  banana.glb
    /textures  grass.jpg  ground.jpg
    /audio
      /mr      cow.mp3  hen.mp3      Marathi
      /hi      cow.mp3  hen.mp3      Hindi
      /or      cow.mp3  hen.mp3      Odia
```

Audio filenames never carry the language. Language is the folder — see §7.1.

### 6.4 The shell

```html
<!DOCTYPE html>
<html>
<head>
  <script src="lib/aframe.min.js"></script>
  <script src="lib/aframe-extras.min.js"></script>
  <script src="lib/mqtt.min.js"></script>
</head>
<body>
<a-scene lesson-sync
         renderer="antialias: false; colorManagement: true"
         vr-mode-ui="enabled: false">

  <a-sky id="sky" color="#9fd8f5"></a-sky>

  <a-plane id="ground" rotation="-90 0 0"
           width="80" height="80" repeat="25 25"></a-plane>

  <a-entity id="stage"></a-entity>

  <a-sound id="voice"></a-sound>

  <a-light type="ambient" intensity="0.8"></a-light>
  <a-light type="directional" position="3 5 2" intensity="0.6"></a-light>

  <a-camera position="0 1.2 0" wasd-controls-enabled="false">
    <a-cursor fuse="true" fuse-timeout="800"></a-cursor>
  </a-camera>

</a-scene>
</body>
</html>
```

`a-camera` sits at 1.2 m — seated child height, not the 1.6 m adult default.
`fuse="true"` means gaze-and-dwell selection, which works without controllers. A 3-year-old should not need to hold anything.

### 6.5 The sync component

```js
AFRAME.registerComponent('lesson-sync', {
  init: function () {
    const stage  = document.querySelector('#stage');
    const sky    = document.querySelector('#sky');
    const ground = document.querySelector('#ground');
    const voice  = document.querySelector('#voice');

    const id = localStorage.getItem('headsetId') || '0';
    let currentLesson = null;
    let lastSeq = -1;

    const client = mqtt.connect('ws://192.168.8.1:9001', {
      clientId: `headset-${id}`,
      keepalive: 30,
      clean: false,
      will: {
        topic: `headset/${id}/lwt`,
        payload: JSON.stringify({ id, state: 'offline' }),
        qos: 1,
        retain: true
      }
    });

    client.on('connect', () => {
      client.subscribe('class/state',   { qos: 1 });
      client.subscribe('class/command', { qos: 1 });

      setInterval(() => {
        client.publish(`headset/${id}/status`, JSON.stringify({
          id,
          battery: this.battery,
          worn: document.querySelector('a-scene').is('vr-mode'),
          seq: lastSeq,
          fps: this.fps
        }), { qos: 0 });
      }, 1000);
    });

    client.on('message', async (topic, payload) => {
      const msg = JSON.parse(payload.toString());

      if (topic === 'class/command') return this.runCommand(msg);
      if (msg.seq <= lastSeq) return;
      lastSeq = msg.seq;

      if (msg.lesson !== currentLesson) {
        const lesson = await fetch(`lessons/${msg.lesson}.json`).then(r => r.json());
        this.buildScene(lesson);
        currentLesson = msg.lesson;
        this.lesson = lesson;
      }

      this.applyStep(msg);
    });
  },

  buildScene: function (lesson) {
    const stage = document.querySelector('#stage');
    stage.innerHTML = '';

    document.querySelector('#sky').setAttribute('color', lesson.sky);
    document.querySelector('#ground')
      .setAttribute('src', `assets/textures/${lesson.ground}`);

    lesson.objects.forEach(o => {
      const el = document.createElement('a-entity');
      el.setAttribute('id', o.id);
      el.setAttribute('gltf-model', `assets/models/${o.model}`);
      el.setAttribute('position', o.position);
      el.setAttribute('rotation', o.rotation || '0 0 0');
      el.setAttribute('scale', o.scale || '1 1 1');
      if (o.clip) el.setAttribute('animation-mixer', `clip: ${o.clip}`);
      stage.appendChild(el);
    });
  },

  applyStep: function (msg) {
    const step = this.lesson.steps[msg.step];
    if (!step) return;

    document.querySelectorAll('#stage > a-entity')
      .forEach(el => el.removeAttribute('highlight'));

    if (msg.highlight) {
      const target = document.querySelector(`#${msg.highlight}`);
      if (target) target.setAttribute('highlight', '');
    }

    const voice = document.querySelector('#voice');
    voice.setAttribute('src', `assets/audio/${msg.lang}/${step.audio}`);
    voice.components.sound.playSound();
  },

  runCommand: function (msg) {
    const scene = this.el;
    if (msg.cmd === 'pause')    scene.pause();
    if (msg.cmd === 'blackout') document.querySelector('#sky')
                                       .setAttribute('color', '#000');
  }
});
```

### 6.6 The highlight component

The visual cue that replaces text labels, because the audience cannot read.

```js
AFRAME.registerComponent('highlight', {
  init: function () {
    const ring = document.createElement('a-torus');
    ring.setAttribute('radius', 0.9);
    ring.setAttribute('radius-tubular', 0.04);
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', '0 0.02 0');
    ring.setAttribute('color', '#ffe14d');
    ring.setAttribute('animation', {
      property: 'scale',
      to: '1.15 1.15 1.15',
      dir: 'alternate',
      loop: true,
      dur: 900,
      easing: 'easeInOutSine'
    });
    this.ring = ring;
    this.el.appendChild(ring);
  },
  remove: function () {
    if (this.ring) this.el.removeChild(this.ring);
  }
});
```

A pulsing ring on the ground under the object. Language-independent, readable by a 3-year-old, and cheap to render.

### 6.7 Characters without a 3D artist

Faces are built from A-Frame primitives parented to a plain model. No Blender required.

```html
<a-entity gltf-model="assets/models/banana.glb" position="0 1.4 -3"
  animation="property: position; to: 0 1.65 -3; dir: alternate;
             loop: true; dur: 1600; easing: easeInOutSine">

  <a-sphere position="-0.09 0.28 0.22" radius="0.045" color="#111"></a-sphere>
  <a-sphere position=" 0.09 0.28 0.22" radius="0.045" color="#111"></a-sphere>
  <a-torus  position="0 0.14 0.21" radius="0.09" radius-tubular="0.018"
            theta-start="180" theta-length="180" color="#7a2b2b"></a-torus>
</a-entity>
```

Two spheres and half a torus. This technique turns any CC0 fruit, vegetable, or object model into a character.

### 6.8 Offline packaging

1. Service worker caches the shell, all lesson JSON, all models, textures, and audio on install.
2. `manifest.json` declares the PWA.
3. Bubblewrap wraps it into a signed APK.
4. `adb install` sideloads to each headset.

```bash
npx @bubblewrap/cli init --manifest ./manifest.json
npx @bubblewrap/cli build
adb install app-release-signed.apk
```

All three tools are free. No developer account purchase, no store submission.

---

## 7. Content pipeline

### 7.1 Lesson JSON schema

```json
{
  "id": "evs-lkg-farm-animals",
  "template": "identify",
  "sky": "#9fd8f5",
  "ground": "grass.jpg",

  "objects": [
    { "id": "cow",   "model": "cow.glb",  "position": "-1 0 -4",
      "rotation": "0 40 0", "clip": "Idle" },
    { "id": "hen",   "model": "hen.glb",  "position": "1.5 0 -3",
      "scale": "0.6 0.6 0.6", "clip": "Idle" },
    { "id": "tree1", "model": "tree.glb", "position": "-7 0 -13" },
    { "id": "tree2", "model": "tree.glb", "position": "6 0 -15",
      "scale": "1.3 1.3 1.3" }
  ],

  "steps": [
    { "highlight": "cow", "audio": "cow.mp3", "duration": 6000,
      "script": { "mr": "ही गाय आहे.", "hi": "यह गाय है।" } },
    { "highlight": "hen", "audio": "hen.mp3", "duration": 5000,
      "script": { "mr": "ही कोंबडी आहे.", "hi": "यह मुर्गी है।" } }
  ]
}
```

`duration` is what makes a lesson feel like a video rather than a slideshow. Steps
advance on their own; the teacher is not tapping Next every few seconds. See §7.2.

Note that `audio` has no language in the filename. Language is a **folder**: `assets/audio/mr/cow.mp3`. Adding a language is adding a folder, never editing a lesson.

`script` carries the text the **teacher** reads aloud on the tablet — the fallback that lets a lesson ship before any audio is recorded.

### 7.2 Playback model — why it reads as a video

A lesson is not a rendered video file, and it must not be one. A video cannot
carry a highlight ring around the object being named, and highlighting is the
whole teaching mechanic for an audience that cannot read. So the lesson is a live
3D scene that *behaves* like a video.

Three things produce that feeling, and none of them is a video codec:

1. **Steps advance on a timer.** Each step declares a `duration`. When it elapses,
   the next step begins — narration, highlight, and all.
2. **Objects are always in motion.** Every animal carries an idle animation clip;
   props bob gently. A still scene reads as a picture, a moving one reads as film.
3. **The camera never moves.** Objects animate, the viewpoint does not. This is a
   hard rule, not a stylistic one — camera motion the child's body has not asked
   for is the primary cause of nausea, and most acutely at ages 3–6.

**The timer lives only on the tablet.** Headsets run no timer of their own. The
tablet counts the duration down, then publishes the next `class/state`; every
headset simply obeys. This is what keeps the class in step: there is only one
clock in the room, so there is nothing to drift.

```
tablet:   step 0 ──6s──▶ step 1 ──5s──▶ step 2
             │              │              │
             ▼              ▼              ▼
          publish        publish        publish     (headsets only listen)
```

**Teacher override.** Pause stops the countdown. Next and Back move immediately
and restart it. A teacher who wants to dwell on a step because the children are
engaged is never fighting the timer.

**Consequence for authoring.** `duration` should be set slightly longer than the
narration clip for that step — enough for the child to look at the highlighted
object after hearing its name. Where audio has not been recorded yet and the
teacher is reading `script` aloud, `duration` is a starting estimate that the
educator review in Phase 2 is expected to correct.

### 7.3 Asset sources — all free, all CC0

| Need | Source | Licence |
|---|---|---|
| Rigged animated animals | Quaternius — Ultimate Animated Animals | CC0 |
| Trees, rocks, nature props | Quaternius Stylized Nature, Kenney Nature Kit | CC0 |
| Food, fruit, vegetables | Kenney Food Kit, Quaternius | CC0 |
| Ground and surface textures | ambientCG, Poly Haven | CC0 |
| General objects | Poly Pizza | CC0 / CC-BY — check per model |
| Optional distant backdrops | Poly Haven HDRIs | CC0 |
| Narration (optional) | IndicParler-TTS, self-hosted | Open source |
| Narration (default) | Teacher reads `script` from tablet | free |

**Rejected on licence grounds:** Skybox AI's free tier is CC-BY-NC — non-commercial — which does not cover delivery to a funded programme. It is excluded entirely rather than relying on a paid tier.

**Rule: download before you generate.** For anything a 3-year-old recognises, a clean CC0 model already exists. Generation is a fallback for genuine gaps only.

### 7.4 Asset standardisation

Every model, regardless of source, passes through one script before entering `/assets/models`:

- **Scale** 1 unit = 1 metre
- **Origin** at the base, centred — feet on the ground, not floating
- **Orientation** facing +Z
- **Compression** Draco geometry, textures resized to 1024 px maximum
- **Naming** lowercase, single word, `.glb` — `cow.glb`, never `Cow_Final_v3.glb`

```bash
npx @gltf-transform/cli optimize raw/cow.glb assets/models/cow.glb \
  --compress draco --texture-size 1024
```

Without this pass, rotation and scale fixes leak into lesson JSON and never come out.

### 7.5 Art style

**One style, enforced.** Stylised low-poly, flat or lightly shaded. Reject any asset that does not match, however convenient.

A realistic cow beside a cartoon hen is the single most visible quality failure available to this project, and it is free to avoid.

### 7.6 Performance budget

Measured on the target headset, not a laptop.

| Metric | Budget |
|---|---|
| Frame rate | 72 fps sustained, never below 60 |
| Draw calls | under 100 |
| Triangles on screen | under 150,000 |
| Texture size | 1024 px maximum |
| Realtime shadows | none |
| Post-processing | none |
| Distinct tree/prop models per scene | 3–4, reused at different positions and scales |
| Lesson bundle size | under 40 MB |

`fps` is reported in every heartbeat so the content team can see which lessons breach budget in real classrooms.

---

## 8. The tablet application

**Stack:** the same web app as the headset, launched at `?role=teacher`, packaged
with Bubblewrap. HTML, A-Frame, `mqtt.js`. No separate framework.

> **Change from earlier planning:** this section previously specified React Native
> + TypeScript as a second, independent application. That is withdrawn. Once the
> teacher needs to *see the lesson* — not a device list, but the scene itself —
> the tablet has to render A-Frame, and A-Frame needs a DOM. React Native has no
> DOM, so the scene would have to live inside a WebView anyway: the same web app,
> with a native shell around it, a message bridge to debug, and a second codebase
> to maintain. Nothing is gained. See Appendix A.

**What the teacher sees.** The lesson canvas fills the screen and plays. Over it
sits one control bar — plain HTML, not 3D:

| Element | Purpose |
|---|---|
| `script` line | The narration text for the current step, set large enough to read at arm's length. The teacher reads it aloud where recorded audio does not yet exist. |
| Pause / Resume | Stops and restarts the step timer on every headset. |
| Back / Next | Moves the class a step at a time, overriding the timer. |
| Blackout | Sky to black on every headset at once. The instant "eyes on me" control. |
| Status strip | One tile per headset: number, battery, and one of live, worn-off, offline. |

**Screens — three, no more:**

1. **Session setup.** Pick class, pick language. One screen, two dropdowns.
2. **Lesson runner.** The scene playing, with the control bar above.
3. **Status board.** The full grid of 25 tiles, when the strip is not enough.

The teacher must be able to run a full lesson without looking away from the
children for more than two seconds at a time. That constraint drives every layout
decision — and it is the reason the scene is on the tablet at all. A teacher who
can see what the class is seeing can narrate it, and can tell from a glance
whether a child reacting oddly is reacting to the lesson or to the headset.

---

## 9. Delivery phases

### Phase 0 — Feasibility (1 week) — blocks everything

One question: **does a packaged A-Frame PWA run offline in VR on the target headset, and what is the storage ceiling?**

Deliverable: a Bubblewrap APK with one scene and 50 MB of assets, installed via adb, launched with Wi-Fi disabled, confirmed rendering in VR at 72 fps.

If this fails, the entire web approach is invalid and the plan changes. Nothing else starts until this is answered.

### Phase 1 — One scene, two headsets (3 weeks)

- The shell, the `lesson-sync` component, the `highlight` component
- Mosquitto on a Pi, `mqtt.js` on both sides
- The same build in the teacher role: scene on screen, Next, Back, Pause, status strip
- One complete `identify` lesson with real CC0 assets
- Demonstrated: teacher taps Next, two headsets move together, one is unplugged and rejoins at the right step

### Phase 2 — Templates and pipeline (4 weeks)

- Five templates built and frozen
- Asset standardisation script and the first 60 standardised models
- Lesson JSON authored for 10 topics
- Educator review of the templates and of VR session length for this age group

### Phase 3 — Content scale-up (ongoing)

- Remaining topics authored against frozen templates
- Every lesson reviewed on a real headset before release
- Native-speaker review of every narration line before it ships

### Phase 4 — Classroom pilot

- 25 headsets, one centre
- Kiosk lockdown, fleet install via adb
- Teacher training, and observation of actual sessions

**Sequencing note:** the asset library is built in parallel from Phase 1 onward. The generator cannot emit a lesson referencing `cow.glb` if `cow.glb` does not exist.

---

## 10. Risks

| Risk | Severity | Response |
|---|---|---|
| **Headset browser restrictions.** Offline storage caps or WebXR limits in the packaged PWA | Critical — invalidates the approach | Phase 0, before all other work |
| **Age rating.** Headset manufacturers rate these devices well above 3–6 | High — procurement and consent issue | Confirm current manufacturer policy in writing; obtain parental consent; escalate to programme stakeholders before pilot |
| **QA is the bottleneck.** The pipeline emits lessons faster than humans can check them | High | Budget review time explicitly, not just build time. Freeze templates so review is per-recipe, not per-scene |
| **Odia narration quality.** Fewest voices, least validated | Medium | Ship with teacher-read `script` as the default. Native-speaker QA on every clip before any recorded Odia ships |
| **Frame rate on device.** Scenes pass on a laptop, stutter on the headset | Medium | Hard performance budget (§7.6); `fps` in every heartbeat; test on device from Phase 1 |
| **Mixed art style.** Assets from many sources look incoherent | Medium | One style, enforced at intake |
| **Shared headsets and hygiene.** Small faces, shared devices | Medium | Wipeable face interfaces, per-session cleaning protocol, IPD suitability check for this age group |
| **Session length and comfort.** Young children in VR | Medium | Seated only, no locomotion, teacher-controlled camera, 8–12 minutes maximum. Educator input from Phase 2 |
| **Fleet management.** Updating many offline headsets | Low for pilot | adb sideload for the pilot. Commercial MDM only becomes worth evaluating past ~100 headsets |

---

## 11. Cost

| Item | Cost |
|---|---|
| A-Frame, three.js, aframe-extras, mqtt.js, Mosquitto, Bubblewrap, gltf-transform, adb | ₹0 |
| 3D models (Quaternius, Kenney, Poly Pizza) | ₹0 |
| Textures (ambientCG, Poly Haven) | ₹0 |
| Narration — teacher-read default | ₹0 |
| Raspberry Pi Zero 2 W, per classroom | ~₹2,000 |
| Travel router, per classroom | ₹3,000–5,000 |
| Headsets and tablets | as already budgeted by the programme |

**Software and asset licensing: zero.** The only new hardware is the router and the Pi.

Optional, if the free route proves insufficient: freelance modelling for Indian-specific objects with no CC0 equivalent — auto-rickshaw, village house, thali, local vegetables, festival props. Roughly 30–40 models. This is the one line item likely to need money, and it can be deferred past the pilot.

---

## 12. Open questions

1. **Age rating.** What is the current manufacturer policy for the specific headset model being procured, and does the programme accept it for ages 3–6? Requires a written answer before pilot.
2. **Which headset model** is the programme actually buying? Storage ceiling, IPD range, and browser capability all depend on it.
3. **Language set for v1.** Earlier planning named English and Hindi; the team training material assumed Marathi, Bengali, and Odia. These need reconciling.
4. **Pilot location and date.**
5. **Educator reviewer** — who, and how much of their time is available?
6. **Native-speaker reviewers** per target language — identified?
7. **Teacher's live view of a child's headset.** Partly resolved: the teacher now
   sees the lesson itself, rendered locally on the tablet (§6.2, §8), which covers
   the narration and pacing need without any streaming. What remains open is
   whether anyone needs to see a *specific child's actual gaze* — a different and
   much more expensive feature, requiring WebRTC as a separate channel. Assumed
   out of scope for v1 unless the pilot shows a need.
8. **Class size per session** — is 25 simultaneous headsets real, or is the pilot smaller?

---

## Appendix A — Why these technology choices

**A-Frame over a game engine.** The team is web developers. A-Frame is HTML tags over three.js — the same renderer a game engine would use in the browser, with a far shorter path from zero to a scene in a headset. The escape hatch exists: `el.object3D` gives raw three.js access wherever A-Frame is insufficient.

**MQTT over raw WebSocket.** Both work. MQTT's retained messages and Last Will directly solve mid-lesson reconnect and dead-headset detection — the two hardest problems in this system — at the cost of one extra process. Raw WebSocket means roughly 500–800 lines of reconnect, acknowledgement, and timeout code written and debugged in-house.

**MQTT over WebRTC.** WebRTC is peer-to-peer and exists to traverse NAT across the internet. On an isolated LAN broadcasting to 25 subscribers, it delivers a 25-connection mesh, still requires a signalling channel, and solves a problem this system does not have. It is the right tool only for the deferred live-video feature.

**One web app in two roles, over a separate native tablet app.** The teacher has to
see the lesson, so the tablet has to render the scene. The scene is A-Frame, which
is HTML over three.js and needs a DOM. React Native does not have one — it would
host the identical web app inside a WebView, adding a native shell, a bridge to
pass messages across, and a second build to keep in step, in exchange for nothing.
A role flag on one codebase gives the same result with none of that. The
`<div>` control bar is the visible sign of this: because the whole product is a web
page, the teacher's buttons are just buttons.

**Bubblewrap over a native wrapper written by hand.** "Web app" does not mean
"website". Bubblewrap emits a signed APK that installs from an icon, opens full
screen with no browser chrome, and runs with the network off. The teacher cannot
tell, and does not need to.

This is ordinary, not exotic. On the desktop, VS Code, Slack, Discord, Figma,
Notion and Teams are all web applications inside a native shell. On Android, the
same packaging as ours — a PWA wrapped for the Play Store — has shipped Twitter
Lite, Uber, Starbucks, MakeMyTrip and, most relevantly for this programme,
Flipkart Lite, which took that route precisely to run well on low-end devices on
poor networks.

**But state the limit honestly.** All of those run on flat screens. Packaged web
apps on *VR headsets* have far thinner precedent than native builds do, and that
gap — not the packaging technique itself — is the actual risk. It is why Phase 0
exists and why it blocks everything else. The tablet role can be taken as proven;
the headset role cannot, until it is measured on the device the programme buys.

**Single-page shell over per-lesson pages.** Page navigation ends the WebXR session. This is not a preference; it is a hard constraint.

**Full 3D over 360° panoramas.** The reference material the team is targeting is real-time 3D with animated characters. Panoramas cannot support per-object highlighting, which is the core teaching mechanic for a non-reading audience.

---

## Appendix B — Local development

```bash
# serve the app folder over the LAN
npx serve ./app

# find the laptop's LAN address
ipconfig getifaddr en0        # macOS
hostname -I                    # Linux

# broker
sudo apt install mosquitto mosquitto-clients

# watch every message during development
mosquitto_sub -h localhost -t '#' -v

# simulate the teacher without the tablet app
mosquitto_pub -h localhost -t class/state -r -q 1 \
  -m '{"seq":1,"lesson":"evs-lkg-farm-animals","step":0,"lang":"mr","highlight":"cow"}'
```

Open `http://<lan-ip>:3000` in the headset's browser to test before packaging.

**Known trap:** images and models will not load from `file://`. A black sky or missing model is almost always this. Always serve over HTTP.
