/**
 * Template: match.
 *
 * Pair this with that: an animal with its sound, an animal with its baby, a
 * letter with something that starts with it, a vegetable with its colour, a
 * matra with the word it makes.
 *
 * ## Why this is not `compare` with different words
 *
 * A comparison points at two things that are different. A match asserts that
 * two things **belong together**, and belonging is not visible in the objects
 * themselves — a cow and a glass of milk look no more related than a cow and a
 * shoe. So the link has to be drawn.
 *
 * That is what this template adds: a line between the pair while both are
 * ringed. Without it a child sees two lit objects and no reason to connect
 * them, which is the whole content of the lesson.
 */

import { RING, applyShow, clearHighlights, find, placeAll, ring, teardown } from './scene.js';

/** The link is one entity, reused every step rather than created per pair. */
const LINK = '__match-link';

const from = new THREE.Vector3();
const to = new THREE.Vector3();

export default {
  name: 'match',

  build(stage, { lesson }) {
    placeAll(stage, lesson);

    const link = document.createElement('a-entity');
    link.setAttribute('id', LINK);
    link.setAttribute('visible', 'false');

    // `prop` is how `lesson-sync` is told this is not a lesson object: without
    // it the link gets grounded like everything else, and a contact shadow at
    // the link's own origin is a dark ellipse sitting in the middle of the
    // table with nothing above it.
    link.classList.add('prop');

    stage.appendChild(link);
  },

  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearHighlights(stage);
    applyShow(stage, lesson, step);

    ring(stage, step.highlight, RING.subject);
    ring(stage, step.partner, RING.against);

    drawLink(stage, step.highlight, step.partner);
  },

  teardown,
};

/**
 * The line between a pair.
 *
 * Drawn a little above each object's base so it reads as joining the two
 * things rather than lying on the table between them.
 *
 * Hidden whenever a step names only one side — the first step of a matching
 * lesson is usually "here is the cow" on its own.
 */
function drawLink(stage, subjectId, partnerId) {
  const link = find(stage, LINK);
  const subject = find(stage, subjectId);
  const partner = find(stage, partnerId);

  if (!link) return;

  if (!subject || !partner) {
    link.setAttribute('visible', 'false');
    return;
  }

  const LIFT = 0.12;

  from.copy(subject.object3D.position);
  to.copy(partner.object3D.position);

  link.setAttribute('visible', 'true');
  link.setAttribute('line', {
    start: `${from.x} ${from.y + LIFT} ${from.z}`,
    end: `${to.x} ${to.y + LIFT} ${to.z}`,
    color: RING.against,
  });
}
