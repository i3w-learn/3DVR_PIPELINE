/**
 * Where the class currently is.
 *
 * One object, one writer. The role module writes it; components and the UI
 * read it. The proof-of-concept's first pass scattered this across four
 * mutable globals and every component reached for all of them — which worked,
 * and was untouchable.
 *
 * `seq` is what makes a message stream safe to lose. Every state message
 * carries one, and anything arriving with a lower number is a straggler and is
 * ignored. Together with publishing full state rather than "next", a headset
 * that missed five messages still lands in the right place.
 */

export class Session {
  #listeners = new Set();

  constructor({ lesson = null, step = 0, lang = 'hi', seq = 0 } = {}) {
    this.lesson = lesson;
    this.step = step;
    this.lang = lang;
    this.seq = seq;
  }

  /**
   * Apply an incoming state message.
   * @returns {boolean} false if the message was stale and nothing changed
   */
  apply({ seq, lesson, step, lang }) {
    if (seq !== undefined && seq <= this.seq) return false;

    if (seq !== undefined) this.seq = seq;
    if (lesson !== undefined) this.lesson = lesson;
    if (step !== undefined) this.step = step;
    if (lang !== undefined) this.lang = lang;

    this.#emit();
    return true;
  }

  /** The teacher's side: move the class, and take the next sequence number. */
  advance(step) {
    this.step = step;
    this.seq += 1;
    this.#emit();
    return this.toMessage();
  }

  toMessage() {
    return { seq: this.seq, lesson: this.lesson, step: this.step, lang: this.lang };
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener(this);
  }
}
