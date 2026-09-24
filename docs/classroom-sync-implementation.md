# Classroom sync — implementation plan

**Date** September 2026
**Audience** The engineer building it
**Status** Ready to start once Phase 0 tests pass

---

## What this document is

A self-contained implementation plan for the classroom sync layer: how the
teacher's tablet controls 25 VR headsets over a local Wi-Fi network with no
internet. It covers architecture, the build, the fallback strategies for
browser restrictions we can't predict from documentation, and the Phase 0
tests that decide which path we take.

Read this document on its own. It does not require the PRD or the transport
decision document, though both exist in the repo for background.

---

## 1. The problem

A teacher holds a tablet. Up to 25 children wear VR headsets. The teacher taps
"Next" and every headset advances to the same lesson step at the same time.
Each headset reports its battery, whether it's worn, and whether it's alive.

Constraints:

- **No internet.** A travel router creates a local Wi-Fi network. Nothing
  leaves the room.
- **No technical staff on site.** A rural Anganwadi teacher must be able to
  start a lesson by launching an app. If something breaks, restarting the
  tablet or the router must fix it. There is no IT support.
- **The app is a web page.** The lesson is an A-Frame HTML scene. It must run
  in a browser to get WebXR. The sync layer must work from within that browser
  context.

## 2. The design

### 2.1 Architecture

```
              Travel router (Wi-Fi, no internet)
                           |
      +--------------------+--------------------+
      |                                         |
 Teacher tablet                           25 × headsets
 (Android APK)                           (Android APK)
   ├─ WebSocket server (Kotlin service)    ├─ HTTP server (Kotlin service)
   ├─ HTTP server (serves web app)         │   serves web app on localhost
   └─ Web app in browser (A-Frame)         └─ Web app in browser (A-Frame)
      teacher controls, flat render             VR render, no controls
```

Both devices run a small Android APK. Inside each APK:

1. A **Kotlin Android service** (~200 lines on the tablet, ~80 on the headset)
   that serves the web app on `http://localhost` and, on the tablet only, runs
   a WebSocket server.
2. The **web app** itself — HTML, A-Frame, vanilla JS — served from the APK's
   bundled assets. This is where all the product logic lives.

The Kotlin is plumbing. The product is the web app.

### 2.2 Why not MQTT / a Raspberry Pi

The original PRD put an MQTT broker (Mosquitto) on a Raspberry Pi plugged into
the router. MQTT's retained messages and Last Will features are genuinely
useful — but only when the broker is an independent device that outlives its
clients. In practice, if the tablet dies, the lesson is already dead (the
tablet is the sole clock and controller). The Pi survives a crash that nothing
else survives.

Meanwhile the Pi is the only device a non-technical teacher can't recover. It
fails silently, has no screen, its SD card can corrupt, and its Wi-Fi config
can drift. Eliminating it removes the one piece of infrastructure that can't be
fixed by "restart the tablet."

MQTT's two features are replaced with trivial application logic at this message
volume:

| MQTT feature | Replacement |
|---|---|
| Retained messages (new client gets current state) | Server pushes full state to every new WebSocket connection on open |
| Last Will (detect dead headset) | Server marks a headset offline after 3 seconds of missed heartbeats |

### 2.3 Message format

Two message types. That's it.

**State** — published by the tablet, received by all headsets:

```json
{
  "type": "state",
  "seq": 47,
  "lesson": "evs-lkg-farm-animals",
  "step": 3,
  "lang": "mr",
  "highlight": "cow"
}
```

Full state, never deltas. A headset that missed five messages still lands
correctly on the next one. Headsets ignore any message with `seq` ≤ their
current value.

**Heartbeat** — published by each headset, forwarded to the tablet:

```json
{
  "type": "heartbeat",
  "id": 7,
  "battery": 62,
  "worn": true,
  "seq": 47,
  "fps": 74
}
```

Sent every 1 second. The tablet uses these for the status strip (battery,
worn/off, alive/dead). A headset silent for >3 seconds is marked offline.

**Commands** — transient actions from the tablet:

```json
{ "type": "command", "cmd": "pause" }
{ "type": "command", "cmd": "blackout" }
```

Not state. Not retained. Fire and forget.

### 2.4 How headsets find the tablet

Set a **static IP on the tablet** in Android Wi-Fi settings (e.g.,
`192.168.8.100`). This is configured once at HQ before the tablet ships to the
centre. It survives router resets because it lives on the tablet, not on the
router.

The headset APK is built with this IP baked into its config. If every classroom
uses the same router model and subnet, one build serves all sites. If subnets
differ, it's one config value to change per build.

---

## 3. The browser security question — and three fallback strategies

This is the part that can't be answered from documentation. It must be tested
on the actual headset.

### 3.1 The problem

WebXR requires a **secure context** — the page must be served over HTTPS or
from `localhost`. We serve from `http://localhost`, which qualifies.

But the page also needs to open a WebSocket to the **tablet's LAN IP** (e.g.,
`ws://192.168.8.100:9001`). Whether a localhost-origin page can open a plain
`ws://` connection to a non-loopback address is **ambiguous in the spec and
untested on the Quest browser.** Chromium treats localhost as a "potentially
trustworthy origin," but it's unclear whether that permits outbound `ws://` to
a LAN target.

### 3.2 Three strategies — test in order

The implementation does not depend on any single browser behaviour. Three
strategies are pre-designed. Phase 0 determines which one ships.

---

#### Strategy A: Direct connection

The simplest path. The headset's web app opens `ws://192.168.8.100:9001`
directly.

```
Headset browser                          Tablet
─────────────────                        ──────
http://localhost:8080                     WebSocket server on :9001
  └── new WebSocket('ws://192.168.8.100:9001')
         ──────────────────────────────▶  accepts connection
```

**Works if:** the Quest browser (or Wolvic) allows a localhost-origin page to
open `ws://` to a LAN IP.

**Code cost:** zero extra code. The web app connects directly.

**Test:** Phase 0, test #1 (see §5).

---

#### Strategy B: Localhost proxy (the safe default)

If the browser blocks direct `ws://` to a LAN IP, the headset's own Android
service runs a WebSocket proxy on `ws://localhost:9002`. The web app connects
there. The native service bridges to the tablet over a plain TCP socket, where
no browser rules apply.

```
Headset browser                 Headset native service         Tablet
─────────────────               ──────────────────────         ──────
http://localhost:8080            proxy on localhost:9002
  └── new WebSocket                    │
       ('ws://localhost:9002')         │
         ─────────────────────▶ accepts │
                                       └── TCP socket to
                                           192.168.8.100:9001
                                             ─────────────────▶ accepts
```

**Works if:** the browser allows `ws://localhost` (confirmed — this is the
loopback exception in Chromium's mixed-content rules, tested and documented).

**Code cost:** ~50 lines of Kotlin in the headset's Android service. A
`ServerSocket` on `:9002` that accepts WebSocket connections from the browser,
and a `Socket` to the tablet's `:9001` that relays messages in both directions.

**This is the safe default.** It works under every known browser security
model. If you want to skip Phase 0 test #1 and just build, build this.

---

#### Strategy C: Private CA + wss://

If localhost-origin is not treated as a secure context at all (unlikely, but
possible on an unfamiliar browser like Wolvic), generate a self-signed CA at
build time, pin it in both APKs, and serve `wss://` (TLS-secured WebSocket)
from the tablet.

```
Headset browser                          Tablet
─────────────────                        ──────
http://localhost:8080                     wss:// server on :9001
  └── new WebSocket                      (TLS with pinned cert)
       ('wss://192.168.8.100:9001')
         ──────────────────────────────▶  accepts (TLS handshake)
```

**Works if:** the browser accepts a pinned self-signed certificate for a LAN
address.

**Code cost:** Certificate generation in the build script, TLS configuration
in Ktor, certificate pinning in the headset APK's network security config.
More complex build, but the runtime code barely changes.

**This is a last resort.** Only reach for it if both A and B fail.

---

### 3.3 Why this ladder works

The web app's transport code is identical under all three strategies. The only
difference is the WebSocket URL:

| Strategy | URL the web app connects to |
|---|---|
| A | `ws://192.168.8.100:9001` |
| B | `ws://localhost:9002` |
| C | `wss://192.168.8.100:9001` |

The URL is read from a config value at startup. Lesson code, message handling,
scene rendering — none of it changes.

---

## 4. What to build

### 4.1 Project structure

```
classroom-sync/
  tablet/
    app/
      src/main/
        kotlin/
          ai/i3w/classroom/
            MainActivity.kt          starts service, opens browser
            SyncServerService.kt     WebSocket server + HTTP file server
        assets/
          www/                        the web app (shared source)
            index.html
            sw.js
            manifest.json
            lessons/
            assets/
        AndroidManifest.xml
      build.gradle.kts

  headset/
    app/
      src/main/
        kotlin/
          ai/i3w/classroom/
            MainActivity.kt          starts service, opens Quest browser
            LocalServerService.kt    HTTP file server (+ proxy if Strategy B)
        assets/
          www/                        the web app (shared source, same files)
        AndroidManifest.xml
      build.gradle.kts

  web/                                source of truth for the web app
    index.html
    sw.js
    manifest.json
    lessons/
    assets/
    src/
      transport.js                    WebSocket connect/reconnect/send
      lesson-sync.js                  scene loading, step application
      controls.js                     teacher UI (hidden on headset)
```

`web/` is copied into both `tablet/assets/www/` and `headset/assets/www/`
at build time. One web app, two APKs.

### 4.2 The tablet service — SyncServerService.kt

Responsibilities:

1. **Serve the web app** on `http://localhost:8080` (from bundled assets)
2. **Run the WebSocket server** on port `9001`
3. **Fan out** state and command messages from the tablet web app to all
   headset connections
4. **Forward** heartbeats from headsets to the tablet web app
5. **Track** `currentState` and push it to every new connection on open
6. **Detect dead headsets** — mark offline after 3s of missed heartbeats

Implementation notes:

- Use **Ktor embedded server** with the WebSocket plugin. Actively maintained,
  Kotlin-native, coroutine-based.
- Run as an Android **foreground service** with a persistent notification.
  Declare `foregroundServiceType` in the manifest (required on Android 14+ /
  Meta Horizon OS).
- Mark `currentState` as `@Volatile` — it's read and written from Ktor worker
  threads.
- **Sender validation.** Only the connection registered as `"tablet"` may send
  `type: "state"` or `type: "command"`. Enforce this in code.
- **Reconnect race guard.** When a headset reconnects, its new connection
  overwrites the old entry in the connection map. The old connection's
  `onClose` fires afterwards — it must check `connections[id] === this` before
  removing, or it deletes the new connection.

Estimated size: **~200 lines of Kotlin.**

### 4.3 The headset service — LocalServerService.kt

Responsibilities:

1. **Serve the web app** on `http://localhost:8080` (from bundled assets)
2. If Strategy B: **run a WebSocket proxy** on `localhost:9002` that relays
   to the tablet's `9001` over a plain TCP socket

Estimated size: **~80 lines** (Strategy A) or **~130 lines** (Strategy B).

### 4.4 The web app — transport.js

A thin wrapper over the browser's native `WebSocket` API:

```js
const TRANSPORT_URL = getTransportUrl(); // from config, per strategy

let ws;
let lastSeq = -1;

function connect() {
  ws = new WebSocket(TRANSPORT_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'hello', id: DEVICE_ID }));
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'command') {
      handleCommand(msg);
      return;
    }

    if (msg.type === 'state') {
      if (msg.seq <= lastSeq) return;
      lastSeq = msg.seq;
      handleState(msg);
      return;
    }
  };

  ws.onclose = () => {
    setTimeout(connect, 1000);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
```

This is the same code regardless of which strategy is used. Only
`TRANSPORT_URL` changes.

### 4.5 The web app — role switch

One query parameter, read once at startup:

```js
const role = new URLSearchParams(location.search).get('role') || 'headset';
document.body.dataset.role = role;
```

```css
body[data-role="headset"] #controls { display: none; }
```

The tablet APK launches the browser at `http://localhost:8080?role=teacher`.
The headset APK launches at `http://localhost:8080?role=headset`.

The teacher role owns the step timer and publishes state. The headset role
subscribes and publishes only heartbeats.

### 4.6 Offline — how it works without internet

Everything is local:

- The web app is served from files bundled inside the APK, via the Android
  service on `localhost`. No CDN, no remote server.
- Lesson JSON and all assets (models, textures, audio) ship inside the APK
  under `assets/www/`.
- The WebSocket connection is to a device on the same Wi-Fi network. No
  internet involved.
- A service worker caches the app for resilience, but since the source is
  localhost, it's largely a belt-and-suspenders measure.

The router's only job is to provide a Wi-Fi network so the tablet and headsets
can see each other. It needs no internet uplink, no configuration beyond DHCP,
and no special firmware.

---

## 5. Phase 0 — tests before production code

These are quick empirical tests on the actual headset. Each takes 10–30
minutes. They must pass before any production implementation begins.

### Test 1: Direct WebSocket from localhost origin

**Setup:** Sideload a minimal APK onto the headset. The APK serves a test
page on `http://localhost:8080`. The page attempts
`new WebSocket('ws://<laptop-LAN-IP>:9001')` and logs whether it connects.
Run a trivial WebSocket echo server on the laptop.

**Pass:** Connection opens, message round-trips.

**If it fails:** Strategy A is out. Build Strategy B (localhost proxy).

### Test 2: WebXR from localhost origin — Quest browser

**Setup:** Same APK, but the test page includes an A-Frame scene with a
button that calls `navigator.xr.requestSession('immersive-vr')`.

**Pass:** Tapping the button enters immersive VR. Scene renders at 72fps.

**If it fails:** WebXR may require HTTPS even from localhost on this browser.
Try Wolvic (test 3). If both fail, Strategy C (private CA + wss) or a
different packaging approach.

### Test 3: Repeat tests 1 and 2 in Wolvic

**Why:** Wolvic is needed for kiosk lockdown in the eventual fleet deployment
(Quest browser has no kiosk mode). If Wolvic and Quest browser behave
differently, the implementation targets whichever one the fleet uses.

**Pass:** Same conditions as tests 1 and 2.

**If it fails where Quest browser passes:** Kiosk lockdown needs a different
approach (custom Android launcher, or ManageXR/ArborXR MDM with URL pinning).

### Test 4: Foreground service survives a full lesson

**Setup:** The tablet APK runs the WebSocket server service. Two headsets
connect. Run a simulated lesson for 15 minutes with continuous A-Frame
rendering.

**Pass:** Service stays alive for the full duration, no dropped connections,
no Android killing the service.

**If it fails:** Adjust notification priority, test with battery saver
disabled, investigate `FOREGROUND_SERVICE_TYPE` options.

### Test 5: Existing PRD Phase 0 — offline VR at 72fps

**Setup:** As specified in the PRD. A full scene with 50 MB of assets,
installed via adb, Wi-Fi disabled after install.

**Pass:** Renders in VR at 72fps with Wi-Fi off.

**If it fails:** The entire web-based approach is invalid. This gates
everything.

---

## 6. Build order

### Step 1: Phase 0 tests (1 week)

Build the minimal test APKs and run all five tests. This determines:

- Which connection strategy (A, B, or C) to implement
- Whether Wolvic or Quest browser is the target
- Whether the overall approach is viable at all (test 5)

**Do not write production code before this step is done.**

### Step 2: Tablet APK — server and teacher UI (2 weeks)

1. Android project with Ktor embedded server (HTTP + WebSocket)
2. Foreground service, manifest, notification
3. Web app: shell (index.html), transport.js, lesson-sync.js
4. Teacher controls: session setup screen, lesson runner with
   script/pause/next/back/blackout, status strip
5. One working `identify` lesson with real CC0 assets

**Deliverable:** Teacher launches the app, sees a lesson play, can control it
with the buttons. WebSocket server is running and accepting connections.

### Step 3: Headset APK — client and VR entry (1 week)

1. Android project with HTTP server (serves web app on localhost)
2. If Strategy B: add the WebSocket proxy
3. Web app: same files as the tablet, headset role hides controls
4. The "Connect" waiting screen with one large tap target to enter VR
5. Connect to tablet, receive state, render the lesson in VR

**Deliverable:** Headset connects to the tablet, enters VR, follows the
lesson steps. Teacher taps Next, headset advances.

### Step 4: Two-device integration test (3 days)

- Teacher taps Next → both headsets move together
- Headset is powered off mid-lesson → teacher sees it go offline within 3s
- Headset is powered back on → it rejoins at the current step automatically
- Teacher hits Blackout → both headsets go black
- Teacher hits Pause → timer stops, lesson holds

**This is the demo that proves the sync layer works.** Everything after this
is content.

### Step 5: Content pipeline (parallel from Step 2)

Asset standardisation, lesson templates, lesson JSON authoring. This work
does not depend on the sync layer and can start as soon as the first test
lesson exists in Step 2.

---

## 7. Dependencies

### Software — all free

| Tool | Purpose |
|---|---|
| **Ktor** (Kotlin) | Embedded WebSocket + HTTP server in the tablet service |
| **Android Studio** | Build both APKs |
| **A-Frame + aframe-extras** | 3D scene rendering and animation |
| **gltf-transform** | Asset compression (Draco, texture resize) |
| **adb** | Sideload APKs to headsets and tablet |

### Hardware — per classroom

| Item | Purpose | Cost |
|---|---|---|
| Travel router | Local Wi-Fi network | ₹3,000–5,000 |
| Teacher tablet (Android) | Control surface + WebSocket server | As budgeted |
| Headsets (Meta Quest) | VR display | As budgeted |

No Raspberry Pi. No SD card. No extra hardware beyond what was already
planned.

---

## 8. What can go wrong

| Risk | What happens | What to do |
|---|---|---|
| **All three strategies fail** (browser blocks all WebSocket from localhost AND rejects self-signed certs) | Can't connect headsets to tablet from the web layer | Fall back to a native Android WebSocket client in the headset APK, bypassing the browser entirely. The web app receives state via `localhost` from its own service, which connects to the tablet natively. More Kotlin, but it works under any browser policy. |
| **WebXR doesn't work from localhost** | Headset can't enter VR | Investigate alternative packaging: a custom Android WebView with WebXR injected, or a Chromium-based kiosk shell. This is a deeper problem — it means the whole localhost-serving approach needs rethinking. Phase 0 test 2 catches it. |
| **Android kills the foreground service** | WebSocket server dies mid-lesson, all headsets disconnect | Headsets auto-reconnect (1s retry loop). Service restarts automatically if `START_STICKY` is set. The interruption is a few seconds, not a failure. Test this explicitly. |
| **Teacher's tablet runs out of battery** | Lesson stops | The lesson is already dead without the tablet — this is inherent to teacher-controlled design, not specific to this architecture. Keep the tablet plugged in during lessons. |
| **Router loses power** | All connections drop | Same as above — the network is the room's infrastructure. Headsets reconnect automatically when Wi-Fi returns. |
| **25 headsets overwhelm the WebSocket server** | Dropped messages, stuttering | Unlikely at this volume (26 connections, <200 bytes/message, 1–2 msg/s each). But test with 25 simulated clients before the pilot. Ktor handles thousands of concurrent WebSocket connections on far weaker hardware than an Android tablet. |

---

## 9. What this document does not cover

- **Lesson content** — templates, JSON schema, asset pipeline. See the PRD §7.
- **Lesson playback** — step timers, highlighting, narration. See the PRD §7.2.
- **Fleet management** — kiosk lockdown, MDM, bulk updates. Deferred past pilot.
- **Content authoring pipeline** — how lessons are produced. See `tooling.md`.
- **Performance budgets** — frame rate, draw calls, texture sizes. See the PRD §7.6.

This document covers only the sync layer: how the tablet talks to the headsets
and how the APKs are structured to make that work offline.
