/**
 * Template: sort.
 *
 * Put things into groups, or pick the one that does not belong. Odd one out,
 * healthy and unhealthy food, classification of vehicles, sink and float.
 *
 * ## The only template where the child answers
 *
 * `identify`, `compare`, `count` and `match` are shown. This one asks. A step
 * names the right answer, the child taps, and the scene responds — which makes
 * it the only template that can be wrong, and the only one that has to decide
 * what being wrong looks like.
 *
 * **A wrong tap is not a failure state.** It rings the object briefly in a
 * warm colour and does nothing else: no buzzer, no red cross, no sound that a
 * four-year-old will read as being told off. The step does not advance and the
 * teacher can simply ask again. The first time a child is punished by a
 * headset is the last time they want to wear one.
 *
 * ## Reusing the narration path
 *
 * A correct tap emits `explore-chose`, the same event the explore template
 * raises when a child picks an animal. `lesson-sync` already listens for it
 * and plays that object's own line. The meaning matches exactly — "the child
 * chose this thing, say what it is" — so this is reuse rather than a
 * shortcut, and it means no change to the sync layer for a fifth template.
 */

import { RING, applyShow, clearHighlights, find, placeAll, ringOn, teardown } from './scene.js';

/** How long a wrong answer stays lit before the scene forgets it. */
const WRONG_MS = 900;

export default {
  name: 'sort',

  build(stage, { lesson }) {
    // Tappable, because answering is the point.
    placeAll(stage, lesson, { tappable: true });

    for (const child of stage.children) {
      child.addEventListener('click', () => answer(stage, child));
    }
  },

  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearHighlights(stage);
    applyShow(stage, lesson, step);

    // Which taps count, carried on the stage so the click handler can read it
    // without holding a reference to the step.
    stage.dataset.answer = JSON.stringify(accepted(step));
  },

  teardown(stage) {
    delete stage.dataset.answer;
    teardown(stage);
  },
};

/** A step may accept one object or several — sink and float sorts a handful. */
function accepted(step) {
  if (Array.isArray(step.answer)) return step.answer;
  return step.answer ? [step.answer] : [];
}

function answer(stage, el) {
  const correct = JSON.parse(stage.dataset.answer || '[]');

  // `highlight` has no `update` — it draws its ring once, in `init`. So
  // setting a new colour on an entity that already has one changes the
  // component's data and nothing on screen. Every colour change has to remove
  // the component first, which is why the templates all clear before they
  // ring, and why a second tap on an already-ringed object would otherwise
  // keep the colour of the first.
  el.removeAttribute('highlight');

  // No answer set for this step: the step is showing, not asking. Tapping is
  // then simply choosing, exactly as it is in `explore`.
  if (!correct.length) {
    clearHighlights(stage);
    ringOn(el, RING.subject);
    el.emit('explore-chose', { id: el.id, walking: false }, true);
    return;
  }

  if (!correct.includes(el.id)) {
    ringOn(el, RING.wrong);
    setTimeout(() => find(stage, el.id)?.removeAttribute('highlight'), WRONG_MS);
    return;
  }

  ringOn(el, RING.subject);
  el.emit('explore-chose', { id: el.id, walking: false }, true);
}
