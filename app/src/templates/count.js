/**
 * Template: count.
 *
 * How many. Counting to twenty, to a hundred, addition, subtraction, more and
 * less, odd and even — twelve topics that are all the same motion: things
 * appear one at a time while a number keeps up with them.
 *
 * ## Why nothing is created as it counts
 *
 * The obvious implementation adds a mango to the scene on each step. It is
 * also the one thing the architecture forbids, and for a reason that only
 * shows up on a headset: loading geometry mid-lesson drops frames, and a
 * dropped frame in VR is felt in the body rather than seen. Ten mangoes that
 * appear smoothly and one that stutters teach the same number and leave very
 * different impressions of the room.
 *
 * So every object is placed at build and hidden. Counting is `visible`
 * flipping, which costs nothing and never stutters.
 *
 * ## The tally
 *
 * One glyph card that shows the number reached so far. The template writes it,
 * the lesson never repeats it — so a lesson cannot say "4" in its script while
 * the card behind it says 3.
 */

import { applyShow, clearHighlights, find, placeAll, ring, teardown } from './scene.js';

/** The object id the running number is written into, unless a lesson renames it. */
const TALLY = 'tally';

export default {
  name: 'count',

  build(stage, { lesson }) {
    placeAll(stage, lesson);
  },

  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearHighlights(stage);

    // What is on the table at this point in the count.
    applyShow(stage, lesson, step);

    // The one just added — so the child sees which thing the number counted.
    ring(stage, step.highlight);

    if (step.tally == null) return;

    // `setAttribute(component, property, value)` updates one property and
    // leaves the rest of the card — its size, its colours — alone.
    find(stage, lesson.tally ?? TALLY)?.setAttribute('glyph', 'char', String(step.tally));
  },

  teardown,
};
