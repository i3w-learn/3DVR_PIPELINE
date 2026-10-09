/**
 * The transport for a real classroom.
 *
 * The tablet's app runs a meeting point (`ClassroomServer` in the VR-app
 * repo): one WebSocket that every page in the room keeps open. Whatever one
 * page publishes, the meeting point passes to all the others. This class is a
 * page's end of that.
 *
 * It is `LocalTransport` with a wire attached. Everything published here is
 * delivered in-page first, exactly as before, and then sent out; everything
 * that arrives from the wire is delivered in-page as if it had been published
 * here. So the roles, the sync and the session cannot tell the difference,
 * which is the whole point of the contract.
 *
 * The meeting point keeps retained messages and hands them over on connect, so
 * a headset that restarts mid-lesson is told the current step within a second
 * of the socket opening — the same promise `LocalTransport` makes to a late
 * subscriber, kept across devices.
 *
 * `connect()` resolves at once rather than waiting for the socket, because a
 * headset must come up and show its waiting screen whether or not the tablet
 * is there yet. The socket connects in the background and keeps retrying
 * every second for as long as the page lives: a router that was switched off
 * and on, or a tablet that restarted, is a few seconds' gap and not a fault.
 *
 * One frame per message: `{"topic": …, "payload": {…}, "retain": …}`.
 *
 * Everything that happens on the wire is written to the console with a
 * `classroom` tag — connected, lost, every message out (▶) and in (◀) — so
 * that "did the headset get it?" can be answered by looking. On a headset or
 * a phone the console is a cable away: USB debugging on, then chrome://inspect
 * in Chrome on a laptop lists the device's pages.
 */

import { LocalTransport } from './local-transport.js';
import { Transport } from './transport.js';

/** How long to wait before trying the meeting point again, in milliseconds. */
const RETRY_MS = 1000;

export class ClassroomTransport extends Transport {
  #local = new LocalTransport();
  #url;
  #socket = null;
  #retry = null;
  #closed = false;

  /**
   * What this page has asked the meeting point to retain, by topic.
   *
   * Sent again every time the socket opens. The teacher publishes "step 0"
   * before her socket has finished opening, and a tablet that restarts has
   * forgotten everything — in both cases the meeting point would otherwise
   * hold no state at all, and a headset joining would wait forever.
   */
  #retained = new Map();

  /** @param {string} url the meeting point, e.g. `ws://192.168.8.100:9001` */
  constructor(url) {
    super();
    this.#url = url;
  }

  /** Whether the meeting point can hear us right now. */
  get connected() {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  async connect() {
    this.#open();
    return this;
  }

  publish(topic, payload, { retain = false } = {}) {
    this.#local.publish(topic, payload, { retain });
    if (retain) this.#retained.set(topic, payload);
    // A message the meeting point cannot hear right now is simply lost. State
    // is retained and re-sent on every connect, and heartbeats come again in
    // a second, so nothing worth queueing is ever in the queue.
    if (this.connected) this.#send(topic, payload, retain);
  }

  #send(topic, payload, retain) {
    log('▶', topic, payload);
    this.#socket.send(JSON.stringify({ topic, payload, retain }));
  }

  subscribe(topic, handler) {
    this.#local.subscribe(topic, handler);
  }

  disconnect() {
    this.#closed = true;
    clearTimeout(this.#retry);
    this.#socket?.close();
    this.#local.disconnect();
  }

  #open() {
    if (this.#closed) return;
    const socket = new WebSocket(this.#url);
    this.#socket = socket;

    socket.onopen = () => {
      log('●', `connected to ${this.#url}`);
      for (const [topic, payload] of this.#retained) this.#send(topic, payload, true);
    };

    socket.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      if (typeof frame?.topic !== 'string') return;
      log('◀', frame.topic, frame.payload);
      this.#local.publish(frame.topic, frame.payload ?? {}, { retain: frame.retain === true });
    };

    // `onerror` is always followed by `onclose`, so the retry lives there.
    socket.onclose = () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      if (!this.#closed) log('○', `no connection to ${this.#url}, trying again every second`);
      this.#retry = setTimeout(() => this.#open(), RETRY_MS);
    };
  }
}

function log(mark, what, payload) {
  if (payload === undefined) console.log(`classroom ${mark} ${what}`);
  else console.log(`classroom ${mark} ${what}`, payload);
}
