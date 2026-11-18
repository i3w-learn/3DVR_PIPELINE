/**
 * Who is in the room.
 *
 * One entry per headset, kept up to date from the heartbeat each headset
 * sends every second to the meeting point on this tablet. The screens ask
 * this for a headset's state in plain words — ready, playing, removed,
 * reconnecting, disconnected — and never look at heartbeats themselves.
 *
 * A kit is sent out with a known number of headsets, numbered from 1. Those
 * are listed from the start, so the teacher can see which ones are missing.
 * A headset with any other number is added when it is first heard.
 */

import { ClassroomTransport } from '../core/classroom-transport.js';
import { TOPIC } from '../core/transport.js';

/** Three missed heartbeats: the headset is trying to come back. */
const QUIET_MS = 3000;
/** Still silent after this: it is gone, and the teacher is told. */
const LOST_MS = 10000;
/** At or below this, the battery is shown as a warning. */
export const LOW_BATTERY = 20;

/**
 * Tell the room that no lesson is on.
 *
 * The meeting point keeps the last "where the class is" message and hands it
 * to every headset that joins. If the app was closed in the middle of a
 * lesson, that message is still there, and a headset switched on the next
 * morning would be handed yesterday's lesson before the teacher had touched
 * anything. So every time the app opens it replaces that message with "the
 * class is nowhere", which is what a headset's waiting screen means.
 *
 * Sent once, on a connection of its own that is closed straight after, so it
 * is never sent again later and can never land on top of a running lesson.
 */
export function sendEveryoneToWaiting(classroom, lang) {
  const socket = new WebSocket(classroom);
  socket.onopen = () => {
    // Counted from the clock, like the teacher's own messages, so that it is
    // newer than anything a headset is still holding.
    // The language goes along, so the headsets' own screens are in the
    // tablet's language before any lesson has been chosen.
    const payload = { seq: Date.now(), lesson: null, step: 0, lang };
    socket.send(JSON.stringify({ topic: TOPIC.state, payload, retain: true }));
    console.log('teacher ✓ app opened: every headset to its waiting screen');
    socket.close();
  };
  // No meeting point yet: there is nothing kept there to replace.
  socket.onerror = () => {};
}

export class Room {
  #headsets = new Map(); // id → { id, battery, worn, seen }

  /**
   * @param {object} options
   * @param {number} options.expected how many headsets the kit has
   * @param {string|null} options.classroom the meeting point, `ws://…`
   * @param {boolean} options.demo pretend headsets, to look at the screens
   */
  constructor({ expected, classroom, demo }) {
    for (let id = 1; id <= expected; id += 1) this.#entry(id).kit = true;

    if (classroom) {
      const transport = new ClassroomTransport(classroom);
      transport.connect();
      transport.subscribe(TOPIC.statusWildcard, (beat) => this.#beat(beat));
      transport.subscribe(TOPIC.willWildcard, ({ id }) => this.#gone(id));
    } else if (demo) {
      this.#pretend(expected);
    }
  }

  /** Every headset, in number order, expected ones first. */
  get headsets() {
    return [...this.#headsets.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }

  /**
   * A headset's state, in the design's words.
   * @param {object} headset an entry from `headsets`
   * @param {boolean} playing whether the lesson is running right now
   */
  stateOf(headset, playing) {
    if (!headset.seen) return 'looking';
    const quiet = Date.now() - headset.seen;
    if (quiet > LOST_MS) return 'disconnected';
    if (quiet > QUIET_MS) return 'reconnecting';
    if (!playing) return 'ready';
    return headset.worn ? 'playing' : 'removed';
  }

  /**
   * Stop listing headsets that left a while ago.
   *
   * Called while the teacher is pairing. The app can stay open for days, and
   * a headset that was here yesterday is not "still connecting" today: one
   * of the kit's own goes back to "Looking for…", and a visitor from another
   * kit is dropped from the list.
   */
  forgetLost() {
    for (const [key, headset] of this.#headsets) {
      if (!headset.seen || Date.now() - headset.seen <= LOST_MS) continue;
      if (headset.kit) Object.assign(headset, { seen: 0, battery: null, worn: false });
      else this.#headsets.delete(key);
    }
  }

  /** How many headsets are connected right now. */
  get readyCount() {
    return this.headsets.filter((h) => this.stateOf(h, false) === 'ready').length;
  }

  get expectedCount() {
    return this.#headsets.size;
  }

  #entry(id) {
    const key = String(Number.isNaN(Number(id)) ? id : Number(id));
    let headset = this.#headsets.get(key);
    if (!headset) {
      headset = { id: key, battery: null, worn: false, seen: 0, kit: false };
      this.#headsets.set(key, headset);
    }
    return headset;
  }

  #beat({ id, battery, worn }) {
    if (id === undefined || id === null) return;
    const headset = this.#entry(id);
    headset.seen = Date.now();
    headset.worn = worn === true;
    headset.battery = typeof battery === 'number' ? battery : null;
  }

  /** The meeting point says the connection closed: do not wait three seconds. */
  #gone(id) {
    const headset = this.#headsets.get(String(id));
    if (headset?.seen) headset.seen = Date.now() - QUIET_MS - 1;
  }

  /**
   * Pretend headsets, for looking at the screens on a laptop with no
   * headset in reach (`?demo` in the address). They join one at a time, one
   * has a low battery, and nothing is sent anywhere.
   */
  #pretend(expected) {
    const batteries = [86, 78, 91, 64, 55, 72, 14, 80];
    let joined = 0;
    const join = setInterval(() => {
      joined += 1;
      if (joined >= expected) clearInterval(join);
    }, 900);
    setInterval(() => {
      for (let id = 1; id <= joined; id += 1) {
        this.#beat({ id, battery: batteries[(id - 1) % batteries.length], worn: true });
      }
    }, 1000);
  }
}
