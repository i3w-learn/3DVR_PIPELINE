/**
 * The teacher's control bar.
 *
 * Plain HTML over the canvas — ordinary buttons and text, not 3D objects.
 * That is the visible payoff of the whole product being a web page: nothing
 * about the teacher's controls has to be modelled.
 *
 * The constraint that drives the layout: a teacher must be able to run a
 * lesson without looking away from the children for more than about two
 * seconds. So the script line is large, and there are five controls, not
 * fifteen.
 */

export class ControlBar {
  #root;
  #scriptLine;
  #position;
  #handlers;

  /** @param {{onPause, onResume, onBack, onNext, onBlackout, onLands}} handlers */
  constructor(root, handlers) {
    this.#root = root;
    this.#handlers = handlers;
    this.#render();
  }

  /** Show the narration the teacher reads aloud, and where the class is. */
  update({ script, lang, step, total }) {
    this.#scriptLine.textContent = script?.[lang] ?? '';
    this.#position.textContent = total ? `${step + 1} / ${total}` : '';
  }

  setPaused(paused) {
    this.#root.querySelector('[data-action="pause"]').textContent = paused ? '▶ Resume' : '❚❚ Pause';
  }

  #render() {
    this.#root.innerHTML = `
      <p class="script" id="script-line"></p>
      <div class="controls">
        <span class="position" id="position"></span>
        <!-- Nothing else on screen says these exist, and a teacher will not
             guess them. Small, and out of the way of the five real controls. -->
        <span class="hint">W A S D walk · drag to look · scroll to zoom · tap an animal</span>
        <button data-action="lands">⌂ Lands</button>
        <button data-action="back">◀ Back</button>
        <button data-action="pause">❚❚ Pause</button>
        <button data-action="next">Next ▶</button>
        <button data-action="blackout" class="danger">Blackout</button>
      </div>
    `;

    this.#scriptLine = this.#root.querySelector('#script-line');
    this.#position = this.#root.querySelector('#position');

    this.#root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const action = button?.dataset.action;
      if (!action) return;

      // Hand focus back to the page. A button that keeps it swallows the
      // space bar into a second press, and leaves the scene's own keys
      // looking dead.
      button.blur();

      const handler = {
        lands: this.#handlers.onLands,
        back: this.#handlers.onBack,
        pause: this.#handlers.onPause,
        next: this.#handlers.onNext,
        blackout: this.#handlers.onBlackout,
      }[action];

      handler?.();
    });
  }
}
