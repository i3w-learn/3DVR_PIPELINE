/**
 * The step clock.
 *
 * There is exactly one of these in a classroom, and it lives on the teacher's
 * tablet. Headsets run no timer at all — they are told which step they are on
 * and they obey. One clock in the room means there is nothing to drift.
 *
 * This is also what makes a lesson feel like a video rather than a slideshow:
 * steps advance on their own, so the teacher narrates instead of tapping Next
 * every few seconds.
 */

export class Clock {
  #timer = null;
  #remaining = 0;
  #startedAt = 0;
  #onElapsed;

  /** @param {() => void} onElapsed called when a step's duration runs out */
  constructor(onElapsed) {
    this.#onElapsed = onElapsed;
  }

  get running() {
    return this.#timer !== null;
  }

  /** Begin (or restart) a countdown of `duration` milliseconds. */
  start(duration) {
    this.stop();
    this.#remaining = duration;
    this.#run();
  }

  /**
   * Hold the countdown where it is.
   *
   * A teacher pausing because the children are engaged must not lose the
   * remaining time, so what is banked is the unelapsed remainder — not the
   * whole duration, and not zero.
   */
  pause() {
    if (!this.running) return;
    this.#remaining -= Date.now() - this.#startedAt;
    this.stop();
  }

  resume() {
    if (this.running || this.#remaining <= 0) return;
    this.#run();
  }

  stop() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #run() {
    this.#startedAt = Date.now();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#remaining = 0;
      this.#onElapsed();
    }, this.#remaining);
  }
}
