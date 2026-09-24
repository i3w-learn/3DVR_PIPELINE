# Review — transport-decision.md

**Date** September 2026
**Verdict** Adopt. Fix five things first.

---

## Verdict

The core call is right. §3 is the argument that wins: the Pi is the only box a
teacher cannot recover by switching something off and on again. The tablet is
equally a box whose software we control, so the Pi's one advantage disappears.

Build with WebSocket. Drop the Pi.

---

## The five fixes

### 1. Headsets serve themselves at `http://localhost` — not a TWA

**This one is load-bearing.** §4.2 and §5.1 put the headset app in a Bubblewrap
TWA *and* have it open `ws://192.168.8.100:9001`. That combination cannot work:

- A TWA is an **https** page, and an https page may not open a plain `ws://`
  connection to a LAN address. The browser blocks it.
- A TWA also refuses to launch until Google's servers verify the domain, which
  needs internet.

**Fix:** package the headset app as an APK that serves itself on
`http://localhost:8080` and opens the Quest browser there. `localhost` is
trusted enough for VR, and because the page is not https, the plain `ws://` to
the tablet is allowed. Everything else in the document then works unchanged.

### 2. Static IP on the tablet, not a DHCP reservation on the router

§4.5 recommends a router DHCP reservation; §8 admits it is lost if the router is
reset. That is the same silent, unrecoverable failure §3 condemns the Pi for — a
power cut kills the classroom and nobody on site can diagnose it.

**Fix:** set a static IP on the tablet itself (one screen in Android Wi-Fi
settings, done at HQ). It survives any router reset because it does not live on
the router.

### 3. Guard the reconnect race in `onClose`

A headset that reconnects overwrites its entry in `connections`; the old
connection's `onClose` then fires and removes the **new** one. The headset
silently stops receiving state while the scene freezes in front of the child.

```kotlin
override fun onClose(code: WebSocketCloseCode, reason: String, byRemote: Boolean) {
    id?.let { if (connections[it] === this) connections.remove(it) }
}
```

### 4. Pick one dead-headset design

§4.4 says the server marks a headset offline after 3s of no reconnect. §6's
`onClose` does nothing and its comment says the tablet notices missing
heartbeats. Two designs, neither implemented. The teacher's status strip depends
on this — choose one and write it.

### 5. Declare `foregroundServiceType`

On Android 14+ a foreground service throws on start without it. Add the
attribute in the manifest and the matching permission.

---

## Smaller things

- The tablet must announce itself as id `"tablet"` or heartbeats route nowhere.
  §6 assumes this but never states it.
- Any client can send `type: "state"`. Check the sender is the tablet, or the
  one-publisher rule is unenforced.
- Mark `currentState` `@Volatile` — it is read and written from NanoWSD worker
  threads.
- "~60 lines" is optimistic once heartbeat timeouts and the notification are in.
  Call it 200. The argument survives either way.
- §7's claim that no maintained Android MQTT broker exists is overstated
  (Moquette). It does not change the conclusion.

---

## Good news the document misses

§9's migration list is far heavier than reality. The codebase already has a
`Transport` contract (`app/src/core/transport.js`), and `lesson-sync` never
touches MQTT — it only calls those four methods.

So the change is:

1. Write `WsTransport` implementing `connect` / `publish` / `subscribe` /
   `disconnect`.
2. Change one line in `app/src/main.js`.

No MQTT code exists yet, so this costs nothing today.
