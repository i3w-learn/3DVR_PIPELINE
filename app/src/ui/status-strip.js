/**
 * The teacher's view of the headsets.
 *
 * One small tile per headset, in a row above the script line: its number,
 * its battery, and a colour that says what the teacher would otherwise have
 * to walk over and check. Green is on a child's head and following; amber is
 * connected but taken off; grey has not been heard from for three seconds —
 * switched off, out of battery, or out of range.
 *
 * Everything here comes from the heartbeats the headsets send every second,
 * and from the meeting point's word that one has gone. The strip also does
 * its own counting, so that if the meeting point itself goes away, every tile
 * turns grey within three seconds instead of staying confidently green.
 */

/** Three missed heartbeats. */
const SILENCE_MS = 3000;

export class StatusStrip {
  #root;
  #tiles = new Map(); // id → { element, seen }

  /** @param {Element} root the element the strip is drawn into */
  constructor(root) {
    this.#root = root;
    this.#root.classList.add('headsets');
    setInterval(() => this.#sweep(), 1000);
  }

  /** A heartbeat arrived. */
  beat({ id, battery, worn }) {
    if (id === undefined || id === null) return;
    const tile = this.#tile(id);
    tile.seen = Date.now();
    tile.element.dataset.state = worn ? 'worn' : 'off';
    tile.element.querySelector('.battery').textContent =
      typeof battery === 'number' ? `${battery}%` : '';
  }

  /** The meeting point says this headset has gone. */
  gone(id) {
    const tile = this.#tiles.get(String(id));
    if (tile) tile.element.dataset.state = 'gone';
  }

  #tile(id) {
    const key = String(id);
    let tile = this.#tiles.get(key);
    if (tile) return tile;

    const element = document.createElement('span');
    element.className = 'headset';
    element.dataset.id = key;
    element.innerHTML = '<b></b><small class="battery"></small>';
    element.querySelector('b').textContent = key;
    this.#root.appendChild(element);

    tile = { element, seen: 0 };
    this.#tiles.set(key, tile);
    return tile;
  }

  #sweep() {
    const now = Date.now();
    for (const tile of this.#tiles.values()) {
      if (now - tile.seen > SILENCE_MS) tile.element.dataset.state = 'gone';
    }
  }
}
