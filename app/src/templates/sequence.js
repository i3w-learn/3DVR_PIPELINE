/**
 * Template: sequence.
 *
 * First, then, last. The water cycle, a seed becoming a plant, the days of the
 * week, the months, the seasons, washing your hands before you eat.
 *
 * ## What it teaches that `count` does not
 *
 * `count` accumulates quantity; this accumulates **order**. The child has to
 * see that this one comes *after* that one, which is a different claim from
 * "there are four of them" and needs a different picture.
 *
 * So a step names one stage and three things happen at once:
 *
 *   the current stage is ringed
 *   the stages already passed stay on screen, dimmed
 *   the stages still to come are hidden
 *
 * The dimming is the whole mechanic. Hide the past and each step is an
 * unrelated picture; leave it at full strength and the child cannot tell which
 * one is being talked about now.
 *
 * ## One rule, two shapes
 *
 * Where the objects stand decides what the lesson looks like, and the template
 * does not care which:
 *
 *   spread across the scene  the chain builds up, left to right — days of the
 *                            week, the water cycle
 *   all at one position      each stage replaces the last in place — a plant
 *                            growing, a season changing
 *
 * That is why there is no `mode` here. A second code path would be two things
 * to keep working; the positions already carry the difference.
 */

import { RING, applyShow, clearHighlights, find, placeAll, ring, teardown } from './scene.js';

/** How far a passed stage fades. Enough to recede, not so far it disappears. */
const PASSED_OPACITY = 0.35;

export default {
  name: 'sequence',

  build(stage, { lesson }) {
    placeAll(stage, lesson);
  },

  /**
   * `at` is where the chain has reached. Everything before it is history,
   * everything after it has not happened yet.
   */
  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearHighlights(stage);

    // A lesson may also carry scenery that is not part of the chain — a pond
    // under the water cycle, a pot under the seed. `show` still governs that,
    // exactly as in every other template.
    applyShow(stage, lesson, step);

    const order = chain(lesson);
    const reached = order.indexOf(step.at);
    if (reached < 0) return;

    order.forEach((id, i) => {
      const el = find(stage, id);
      if (!el) return;

      el.setAttribute('visible', i <= reached);
      fade(el, i < reached ? PASSED_OPACITY : 1);
    });

    ring(stage, step.at, RING.subject);
  },

  teardown,
};

/**
 * The chain, in the order the steps walk it — worked out once and remembered.
 *
 * Taken from the steps rather than from `objects`, because the order that
 * matters is the order it is taught in. A lesson may list its objects in any
 * order it likes for layout reasons, and often has to.
 */
const chains = new WeakMap();

function chain(lesson) {
  let order = chains.get(lesson);
  if (order) return order;

  order = [];
  for (const step of lesson.steps) {
    if (step.at && !order.includes(step.at)) order.push(step.at);
  }

  chains.set(lesson, order);
  return order;
}

/**
 * Fade a whole object, however it was made.
 *
 * A built object bakes into one mesh with one material; a downloaded model is
 * a tree of them. Walking the object3D covers both, and is why this is not
 * simply an `opacity` attribute — that only reaches an entity's own material,
 * which a gltf-model does not have.
 */
function fade(el, opacity) {
  const apply = () => {
    el.object3D.traverse((node) => {
      if (!node.isMesh || !node.material) return;

      for (const material of [node.material].flat()) {
        // Remembered once, so a stage that is passed, current, then passed
        // again does not fade a little further each time.
        material.userData.fullOpacity ??= material.opacity ?? 1;
        material.opacity = material.userData.fullOpacity * opacity;
        material.transparent = opacity < 1;
        material.needsUpdate = true;
      }
    });
  };

  apply();
  // A model that has not arrived yet has no materials to dim. It will.
  if (!el.getObject3D('mesh')) el.addEventListener('model-loaded', apply, { once: true });
}
