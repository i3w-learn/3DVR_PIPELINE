# Transport layer decision: MQTT → WebSocket on the tablet

**Date** September 2026
**Status** Recommendation — for engineer review before implementation
**Supersedes** PRD §5 (MQTT architecture), PRD Appendix A (MQTT vs WebRTC)

---

## 1. Summary

The PRD specifies MQTT over WebSocket, with a Mosquitto broker running on a
Raspberry Pi plugged into the classroom router. This document recommends
**dropping MQTT and the Pi entirely**, replacing them with a plain WebSocket
server embedded as an Android service inside the tablet's Bubblewrap APK.

The message pattern, contracts, and lesson JSON are unchanged. Only the
transport layer moves.

---

## 2. Why reconsider

The PRD chose MQTT for two features:

1. **Retained messages.** The broker stores the last published message. A
   headset that reboots mid-lesson subscribes and immediately receives current
   state — it rejoins at the right step with no reconnect logic.

2. **Last Will and Testament (LWT).** Each headset registers a "I died"
   message at connect time. If it disconnects ungracefully, the broker publishes
   that message on its behalf — dead-headset detection for the teacher's status
   board, with no polling or timeout code.

These are real features that would cost 500–800 lines of hand-written
reconnect and timeout logic to replicate over a raw WebSocket.

**But they only matter when the broker is an independent, always-on process
that outlives its clients.** The PRD puts the broker on a Pi precisely so it
survives a tablet crash. In practice, if the tablet dies, the lesson is already
dead — the tablet is the sole clock, sole publisher, and sole point of control.
The Pi survives a crash that nothing else survives. It is resilience for a
scenario that has no recovery path.

Once the broker is on the tablet, MQTT's pub/sub abstraction is the tablet
talking to itself with extra steps. The message pattern is too simple to need
it:

- Tablet → all headsets: full state, ~100 bytes, every few seconds
- Each headset → tablet: heartbeat, ~50 bytes, every 1 second

That is a WebSocket fan-out. Nothing more.

---

## 3. The operational problem with the Pi

The Pi is the only piece of infrastructure a non-technical teacher cannot
recover by restarting the tablet or the router. It adds:

- A device to power (USB from the router, or its own adapter)
- A device that can fail silently (no screen, no indicator the teacher can read)
- An SD card that can corrupt
- A process (Mosquitto) that must auto-start on boot and stay running
- A Wi-Fi connection to the router that must be pre-configured and maintained

None of this is hard for an engineer to set up once. All of it is hard for a
rural Anganwadi teacher to diagnose when it breaks.

---

## 4. What replaces it

### 4.1 Architecture

```
              Travel router (Wi-Fi, no internet)
                           |
      +--------------------+--------------------+
      |                                         |
 Teacher tablet                           25 × headsets
 (WebSocket server                     (WebSocket clients)
  + lesson controller)
```

The Pi is gone. The tablet is the server.

### 4.2 The WebSocket server

A lightweight WebSocket server runs as an Android foreground `Service` inside
the tablet's Bubblewrap APK. It starts automatically when the app launches and
listens on a fixed port (e.g., `9001`).

**Two mature library options:**

| Library | Language | Size | Notes |
|---|---|---|---|
| **NanoWSD** (part of NanoHTTPD) | Java | ~6 KB | Used inside AOSP itself. Battle-tested on Android for over a decade. Minimal dependencies. |
| **Ktor embedded server** | Kotlin | ~100 lines of setup | Coroutine-based, modern, well-documented. Slightly heavier but cleaner API. |

**Recommendation: NanoWSD.** It is smaller, has no transitive dependencies, and
has the longest track record on Android. Ktor is a fine alternative if the
engineer prefers Kotlin idioms.

The tablet's own web app (running inside the TWA) connects to
`ws://localhost:9001`. Headsets connect to the tablet's LAN IP at the same port.

### 4.3 Connection flow

```
1. Teacher launches the app
2. Android service starts, binds WebSocket server to 0.0.0.0:9001
3. Tablet web app connects to ws://localhost:9001
4. Teacher selects lesson and language
5. Children tap "Connect" on their headsets
   → each headset connects to ws://<tablet-ip>:9001
6. Server pushes current state to each new connection immediately
7. Lesson proceeds: tablet sends state, headsets send heartbeats
```

### 4.4 Replacing MQTT features with application logic

At this message volume (26 clients, <200 bytes per message, 1–2 messages per
second per client), every MQTT feature the PRD relies on is trivially
replaceable:

| MQTT feature | What it does | WebSocket equivalent |
|---|---|---|
| **Retained messages** | New subscriber gets last published state | Server pushes current state to every new WebSocket connection on open |
| **Last Will and Testament** | Broker publishes a "died" message on ungraceful disconnect | Server fires `onClose`/`onError` → marks headset offline after 3s of no reconnect |
| **Clean session = false** | Broker remembers subscriptions across reconnects | Not needed — headset reconnects, server pushes state. There is only one "subscription" (the connection itself) |
| **QoS 1 (at least once)** | Broker retries unacknowledged messages | Not needed at this volume — a missed state message is corrected by the next one in seconds. TCP already guarantees delivery for connected clients |
| **Topic-based routing** | Messages routed by topic string | Two message types, distinguished by a `type` field: `"state"` and `"heartbeat"`. No routing needed |

**Total application logic to write:** ~50–80 lines in the Android service, on
top of the WebSocket library.

### 4.5 Discovery: how headsets find the tablet

Browsers have no mDNS API, so automatic discovery is not available from the
web app. Three practical options, in order of simplicity:

1. **Fixed DHCP reservation.** Configure the router to always assign the tablet
   the same IP (e.g., `192.168.8.100`). Headsets connect to a hardcoded
   address. Simple, reliable, one-time setup per router.

2. **QR code.** The tablet displays a QR code with its current IP on the
   session setup screen. The headset app scans it once. Slightly more flexible,
   no router config needed, but requires a camera interaction before VR entry.

3. **Hardcoded IP in the build.** If every classroom uses the same router
   model with the same DHCP range, bake the tablet IP into the APK config.
   Least flexible but zero runtime setup.

**Recommendation: option 1 (fixed DHCP reservation).** It is a one-time
router setting, requires no camera interaction, and survives tablet reboots.

---

## 5. What changes in the codebase

### 5.1 Things that change

| Component | Before (MQTT) | After (WebSocket) |
|---|---|---|
| **Transport library (JS)** | `mqtt.js` (~100 KB) | Native `WebSocket` API (0 KB, built into every browser) |
| **Broker** | Mosquitto on a Pi | NanoWSD Android service in the tablet APK |
| **Connection string** | `ws://192.168.8.1:9001` (Pi IP) | `ws://192.168.8.100:9001` (tablet IP) |
| **Tablet publish** | `client.publish('class/state', payload, {qos:1, retain:true})` | `connections.forEach(ws => ws.send(payload))` |
| **Headset subscribe** | `client.subscribe('class/state', {qos:1})` | `ws.onmessage = (e) => handleState(e.data)` |
| **Headset heartbeat** | `client.publish('headset/7/status', payload, {qos:0})` | `ws.send(payload)` |
| **Dead headset detection** | LWT message from broker | `onClose` handler + 3s timeout |
| **Reconnect** | `mqtt.js` auto-reconnect + retained message | `WebSocket` reconnect loop + server pushes state on open |
| **Build/packaging** | Bubblewrap only | Bubblewrap + one Android `Service` class |

### 5.2 Things that do not change

- Lesson JSON schema and all lesson files
- Asset pipeline and file structure
- Message payloads (`class/state`, `class/command`, heartbeat)
- The single-page shell and `lesson-sync` component logic
- Sequence numbers and full-state-not-deltas rule
- The teacher's control bar and status strip UI
- Offline packaging via service worker

### 5.3 The sync component, adapted

The `lesson-sync` component (PRD §6.5) changes only in its transport setup.
The message-handling logic is identical:

```js
// Before (MQTT)
const client = mqtt.connect('ws://192.168.8.1:9001', { ... });
client.on('connect', () => {
  client.subscribe('class/state', { qos: 1 });
});
client.on('message', (topic, payload) => {
  const msg = JSON.parse(payload.toString());
  if (msg.seq <= lastSeq) return;
  // ... same logic
});

// After (WebSocket)
const ws = new WebSocket('ws://192.168.8.100:9001');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'command') return this.runCommand(msg);
  if (msg.seq <= lastSeq) return;
  // ... same logic
};
```

Reconnect with backoff:

```js
function connect() {
  const ws = new WebSocket('ws://192.168.8.100:9001');
  ws.onclose = () => setTimeout(connect, 1000);
  ws.onerror = () => ws.close();
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'hello', id: headsetId }));
    // server will push current state in response
  };
  ws.onmessage = (e) => { /* ... */ };
}
```

---

## 6. The Android service (implementation sketch)

This is the only new code beyond what the PRD already specifies. It is a
standard Android foreground service using NanoWSD:

```kotlin
class WebSocketService : Service() {

    private val connections = ConcurrentHashMap<String, WebSocket>()
    private var currentState: String? = null
    private var server: WsServer? = null

    override fun onCreate() {
        super.onCreate()
        server = WsServer(9001)
        server?.start()
    }

    inner class WsServer(port: Int) : NanoWSD(port) {
        override fun openWebSocket(handshake: IHTTPSession): WebSocket {
            return object : WebSocket(handshake) {
                private var id: String? = null

                override fun onOpen() {
                    // new connection gets current state immediately
                    currentState?.let { send(it) }
                }

                override fun onMessage(message: WebSocketFrame) {
                    val msg = JSONObject(message.textPayload)
                    when (msg.optString("type")) {
                        "hello" -> {
                            id = msg.getString("id")
                            connections[id!!] = this
                        }
                        "state", "command" -> {
                            // from the tablet — fan out to all headsets
                            if (msg.optString("type") == "state") {
                                currentState = message.textPayload
                            }
                            broadcast(message.textPayload)
                        }
                        "heartbeat" -> {
                            // from a headset — forward to the tablet only
                            connections["tablet"]?.send(message.textPayload)
                        }
                    }
                }

                override fun onClose(code: WebSocketCloseCode,
                                     reason: String, byRemote: Boolean) {
                    id?.let { connections.remove(it) }
                    // tablet is notified via missing heartbeats
                }

                override fun onPong(pong: WebSocketFrame) {}
                override fun onException(e: IOException) { close() }
            }
        }
    }

    private fun broadcast(payload: String) {
        connections.values.forEach { ws ->
            try { ws.send(payload) } catch (_: Exception) {}
        }
    }

    override fun onBind(intent: Intent): IBinder? = null

    override fun onDestroy() {
        server?.stop()
        super.onDestroy()
    }
}
```

**This is ~60 lines of Kotlin.** It replaces a Raspberry Pi, a Mosquitto
install, a systemd service config, a Wi-Fi config, and a pre-imaged SD card.

Register it in `AndroidManifest.xml` and start it from the main activity's
`onCreate`. Make it a foreground service with a persistent notification so
Android does not kill it during a lesson.

---

## 7. What was ruled out

| Option | Why not |
|---|---|
| **Aedes (JS MQTT broker)** | Requires Node.js `net.createServer`. Cannot run in a browser, service worker, or WebView. |
| **Android MQTT broker libraries** | No maintained option exists. The GitHub projects are abandoned. |
| **HTTP polling** | Works, but strictly worse: 25 headsets × 2 req/s = 50 req/s overhead, latency bounded by poll interval, and WebSocket is natively supported anyway. |
| **WebRTC data channels** | Already rejected in PRD Appendix A. Still requires a signalling server (the Pi stays), still 25 peer connections, still no retained messages or LWT equivalent. Solves a problem (NAT traversal) that does not exist on a local LAN. |
| **Bluetooth Low Energy** | Connection limit of 7–20 depending on device. Cannot support 25 headsets. |
| **mDNS / DNS-SD discovery** | Browsers have no mDNS API. Would need native Android code on every headset, not just the tablet. Use a fixed DHCP reservation instead. |
| **Mosquitto on the tablet via Termux** | Absurd for a non-technical deployment. |

---

## 8. Risks specific to this change

| Risk | Severity | Mitigation |
|---|---|---|
| **Android kills the service during a lesson** | Medium | Run as a foreground service with a persistent notification. This is the standard Android pattern for services that must not be interrupted. Test with the device under memory pressure. |
| **Tablet IP changes** | Low | Fixed DHCP reservation on the router. If the router is reset, the reservation must be re-created — document this as a one-time setup step. |
| **WebSocket reconnect is less robust than mqtt.js** | Low | `mqtt.js` has a mature auto-reconnect with backoff. The WebSocket reconnect loop above is simpler but sufficient — a missed reconnect is corrected on the next attempt 1 second later. |
| **Bubblewrap build becomes more complex** | Low | Bubblewrap generates a standard Android project. Adding one `Service` class and one manifest entry is minimal. The build is still `./gradlew assembleRelease`, not a different tool. |
| **Tablet battery drain from running a server** | Low | The server is idle between messages. At this volume (<200 bytes/s total throughput), power draw is negligible compared to rendering the A-Frame scene. |

---

## 9. Migration path

This change is cleanest if made **before Phase 1** — before any MQTT code is
written. If MQTT code already exists:

1. Remove `mqtt.js` from the web app
2. Replace MQTT connect/subscribe/publish calls with WebSocket
   open/onmessage/send (see §5.3)
3. Add the Android service to the Bubblewrap project
4. Remove the Pi from the hardware list and setup instructions
5. Update the connection string from the Pi's IP to the tablet's IP

The message payloads do not change. The lesson JSON does not change. No
content needs to be re-authored.

---

## 10. Recommendation

Build with WebSocket from the start. The MQTT architecture in the PRD was
sound for a world where the broker is a separate, always-on device. Once
operational reality — non-technical staff, rural sites, no one to debug a
silent Pi — pushes the broker onto the tablet, MQTT's value disappears and its
complexity remains.

A plain WebSocket fan-out is:

- **Less hardware** — no Pi, no SD card, no USB power cable
- **Less software** — native `WebSocket` API, no `mqtt.js` dependency
- **Less to debug** — one device, one process, one failure mode
- **Same messages** — payloads, sequence numbers, full-state rule all unchanged

The only new work is ~60 lines of Kotlin for the Android service.
