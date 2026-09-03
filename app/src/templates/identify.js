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
 */

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
    for (const object of lesson.objects) {
      stage.appendChild(createObject(object));
    }
  },

  /** Called on every step. Ring the named object; leave everything else alone. */
  applyStep(stage, { lesson }, stepIndex) {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    for (const child of stage.children) child.removeAttribute('highlight');

    if (step.highlight) {
      stage.querySelector(`#${CSS.escape(step.highlight)}`)?.setAttribute('highlight', '');
    }
  },

  teardown(stage) {
    stage.innerHTML = '';
  },
};

/**
 * One lesson object as an A-Frame entity.
 *
 * `scale` is optional and artistic here. It is not a correction: by the time a
 * model reaches this folder it is already 1 unit = 1 metre, standing on its
 * feet and facing +Z. If a lesson ever needs a scale to make a cow look like a
 * cow, the pipeline failed and the fix is at intake.
 */
function createObject({ id, model, build, params, position, rotation, scale, clip, clipSpeed, wander, visible }) {
  const el = document.createElement('a-entity');

  el.setAttribute('id', id);

  // An object is either downloaded or built. A school tour taps buildings, and
  // a building is boxes — so the same `build` a stage prop uses works here.
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

  // What makes an animal look like it is standing on the grass rather than
  // hovering over it. Sized from the model's own footprint once it loads.
  el.setAttribute('contact-shadow', '');

  return el;
}
