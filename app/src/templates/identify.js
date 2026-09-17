/**
 * Template: identify.
 *
 * The simplest pattern and the one most of the curriculum reduces to. Objects
 * stand in the scene; each step rings one of them and names it. Farm animals,
 * fruits, vehicles, body parts — all the same template with a different recipe.
 *
 * A template implements exactly three methods. `lesson-sync` calls them and
 * knows nothing else about what happens inside, which is why adding a sixth
 * template later costs no change to the sync layer.
 *
 * Placing and ringing now live in `scene.js`, shared with the other six. What
 * is left here is the whole of what makes this template itself: one object at
 * a time, in the order the lesson chose.
 */

import { applyShow, clearHighlights, placeAll, ring, teardown } from './scene.js';

export default {
  name: 'identify',

  /**
   * Called once, when a lesson loads.
   *
   * Everything the lesson will ever show is placed here. A step never adds
   * geometry — that is what keeps frame time flat for the whole ten minutes,
   * instead of stuttering each time a new model streams in.
   */
  build(stage, { lesson }) {
    placeAll(stage, lesson);
  },

  /**
   * Called on every step. Ring the named object; show what the step asks for.
   *
   * `show` exists because some lessons are a tour rather than a scene. The
   * solar system is the case that needed it: standing next to Jupiter and
   * standing next to Saturn are not two objects in one place, they are two
   * places, and a step has to be able to say which one the class is in.
   */
  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearHighlights(stage);
    ring(stage, step.highlight);
    applyShow(stage, lesson, step);
  },

  teardown,
};
