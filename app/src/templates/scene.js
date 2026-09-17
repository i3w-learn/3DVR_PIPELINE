/**
 * What every template does the same way.
 *
 * A template is supposed to be the *difference* between one teaching pattern
 * and another — count reveals, compare contrasts, match pairs. Placing an
 * entity and ringing it are not differences; they are the floor all seven
 * stand on. They lived in `identify` and were copied into `explore`, and the
 * copy had already started to drift.
 *
 * So they live here, and a template is left with only the part that is
 * actually its own. `compare.js` is forty lines because this file holds the
 * other two hundred.
 *
 * Nothing here knows what a lesson teaches. It knows how to put a thing in a
 * room and how to point at it.
 */

/**
 * The ring colours.
 *
 * Yellow means "this one" and has meant that since the first lesson. A child
 * who cannot read has learned that cue, so it must never change meaning.
 *
 * Blue is the second thing — what the yellow one is being compared or matched
 * against. It is deliberately cooler and calmer: the eye goes to yellow first,
 * which is the order the narration speaks in.
 */
export const RING = {
  subject: '#ffe14d',
  against: '#7fd4ff',
  wrong: '#ff8a7a',
};

/**
 * One lesson object as an A-Frame entity.
 *
 * `scale` is optional and artistic. It is not a correction: by the time a
 * model reaches this folder it is already 1 unit = 1 metre, standing on its
 * feet and facing +Z. If a lesson ever needs a scale to make a cow look like a
 * cow, the pipeline failed and the fix is at intake.
 *
 * @param {object} object            the lesson's description of it
 * @param {object} [options]
 * @param {boolean} [options.tappable]  give it a hit box and a click handler
 */
export function createObject(object, { tappable = false } = {}) {
  const {
    id, model, build, params,
    position, rotation, scale,
    clip, clipSpeed, wander, visible,
    audio, script,
  } = object;

  const el = document.createElement('a-entity');

  el.setAttribute('id', id);

  // An object is either downloaded or built. A school tour taps buildings and
  // a maths lesson taps numerals; both are boxes, so the same `build` a stage
  // prop uses works here.
  if (build) el.setAttribute(build, params ?? {});
  else el.setAttribute('gltf-model', `assets/models/${model}.glb`);

  el.setAttribute('position', position);
  el.setAttribute('rotation', rotation ?? '0 0 0');
  el.setAttribute('scale', scale ?? '1 1 1');

  // Every animal carries an idle clip. A still scene reads as a photograph; a
  // moving one reads as film, and that difference is most of what makes a
  // lesson hold a three-year-old's attention.
  if (clip) {
    // Speed belongs to the lesson, not to the model. The same eat cycle is
    // right for a horse and far too fast for a hen, and only the person
    // watching it can say so.
    el.setAttribute('animation-mixer', { clip, timeScale: clipSpeed ?? 1 });
    // So the herd does not breathe in unison.
    el.setAttribute('natural-idle', '');
    // A clip can lift the root off the ground; only animated models need this.
    el.setAttribute('seat-on-ground', '');

    // An animal that should be going somewhere. Without this a walk clip plays
    // on something that never leaves its spot, and the legs and the position
    // contradict each other.
    if (wander) el.setAttribute('wander', wander);
  }

  if (visible === false) el.setAttribute('visible', 'false');

  if (tappable) {
    // A plain box the size of the posed model, added by `tap-target`. The
    // model's own mesh is not the hit target: three.js raycasts a skinned mesh
    // against its bind pose and sails straight past an animal that is plainly
    // on screen.
    el.setAttribute('tap-target', '');

    // The line this object says, carried on the object rather than looked up —
    // a template should not have to search a lesson to answer a tap.
    el.dataset.audio = audio ?? '';
    el.dataset.script = JSON.stringify(script ?? {});
  }

  // What makes a thing look like it is standing on the grass rather than
  // hovering over it. Sized from its own footprint once it loads.
  el.setAttribute('contact-shadow', '');

  return el;
}

/** Place everything the lesson will ever show. Steps never add geometry. */
export function placeAll(stage, lesson, options) {
  for (const object of lesson.objects) stage.appendChild(createObject(object, options));
}

export function clearHighlights(stage) {
  for (const child of stage.children) child.removeAttribute('highlight');
}

/**
 * Ring one object.
 *
 * Silent when the id is missing rather than throwing: the validator has
 * already checked that every id a step names exists, so a miss here means the
 * scene is mid-teardown, and a lesson ending must not throw.
 */
export function ring(stage, id, color = RING.subject) {
  if (!id) return;
  stage.querySelector(`#${CSS.escape(id)}`)?.setAttribute('highlight', { color });
}

export function find(stage, id) {
  return id ? stage.querySelector(`#${CSS.escape(id)}`) : null;
}

/**
 * Show and hide, for the templates that reveal things as they go.
 *
 * The rule is deliberately narrow: only objects some step names in a `show`
 * list can be switched at all — the **switchable set**, worked out once when
 * the lesson is built. Everything else is scenery and is never touched, so a
 * lesson that does not use `show` behaves exactly as it always did.
 *
 * Without that rule, one lesson using `show` would hide every object in every
 * lesson that does not.
 */
export function applyShow(stage, lesson, step) {
  const switchable = switchableSet(lesson);
  if (!switchable.size) return;

  const showing = new Set(step?.show ?? []);
  for (const id of switchable) {
    find(stage, id)?.setAttribute('visible', showing.has(id));
  }
}

/**
 * Every id any step asks to show — worked out once and remembered.
 *
 * Cached on the lesson object rather than recomputed each step: `applyStep`
 * runs on every step of every lesson, and this is the same answer every time.
 */
const sets = new WeakMap();

export function switchableSet(lesson) {
  let set = sets.get(lesson);
  if (set) return set;

  set = new Set(lesson.steps.flatMap((step) => step.show ?? []));
  sets.set(lesson, set);
  return set;
}

/** Explicit per-id visibility, for steps that name objects directly. */
export function applyVisible(stage, map = {}) {
  for (const [id, shown] of Object.entries(map)) {
    find(stage, id)?.setAttribute('visible', shown);
  }
}

export function teardown(stage) {
  stage.innerHTML = '';
}
