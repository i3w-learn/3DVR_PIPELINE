/**
 * Frame rate, measured over a short rolling window.
 *
 * This is the only performance number that means anything. A scene that holds
 * 72 fps in a laptop browser says nothing about a mobile chip, so every other
 * budget in the pipeline is a proxy and this one is the measurement. It rides
 * in the headset heartbeat so the content team sees which lessons breach
 * budget in real classrooms rather than in review.
 */

export class FpsMeter {
  #frames = 0;
  #since = 0;
  #value = null;

  /** Window length in ms. Short enough to notice a stutter, long enough to be stable. */
  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
    this.#since = now();
  }

  /** Call once per rendered frame. */
  tick() {
    this.#frames += 1;

    const elapsed = now() - this.#since;
    if (elapsed < this.windowMs) return;

    this.#value = Math.round((this.#frames * 1000) / elapsed);
    this.#frames = 0;
    this.#since = now();
  }

  /** Frames per second over the last window, or null before the first one closes. */
  get value() {
    return this.#value;
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
