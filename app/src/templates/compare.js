/**
 * Template: compare.
 *
 * Two things and one difference between them: taller and shorter, big and
 * small, in and out, hot and cold, greater than and less than. It is the
 * largest single pattern in the pre-primary curriculum — the whole of Nursery
 * maths is comparison — and the original five templates did not have it.
 *
 * What makes it its own template rather than `identify` twice: a comparison is
 * not two separate namings. The child has to hold both things in view at once
 * and see which is which. So two rings are lit together, in different colours,
 * and the narration names them in the order the eye reads them — yellow first,
 * blue second.
 *
 * That ordering is the entire teaching mechanic. "This tree is TALL" while one
 * ring is lit teaches a label. "THIS tree is taller than THAT tree" while both
 * are lit teaches a relation, which is the thing being examined.
 */

import { RING, applyShow, clearHighlights, placeAll, ring, teardown } from './scene.js';

export default {
  name: 'compare',

  build(stage, { lesson }) {
    placeAll(stage, lesson);
  },

  /**
   * `highlight` is the thing being named; `against` is what it is being
   * compared to. A step may light only one — the first step of a comparison is
   * usually "here is a tall tree" before "and it is taller than this one".
   */
  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearHighlights(stage);
    applyShow(stage, lesson, step);

    ring(stage, step.highlight, RING.subject);
    ring(stage, step.against, RING.against);
  },

  teardown,
};
