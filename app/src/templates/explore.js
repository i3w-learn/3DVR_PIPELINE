/**
 * Template: explore.
 *
 * The one pattern where the child leads. Everything stands in the scene at
 * once — a yard with animals in it — and looking at something for a moment
 * makes it introduce itself. Nothing advances on a timer; nothing is
 * highlighted until the child chooses it.
 *
 * Why gaze and not a controller: a three-year-old should not have to hold
 * anything. The cursor in the shell is `fuse="true"`, so resting the gaze on
 * an animal for 800 ms counts as choosing it. On the teacher's tablet the same
 * events come from a mouse or a finger, so both roles behave identically
 * without a second code path.
 *
 * Each object carries its own line, not the lesson's step list. That is the
 * difference between `identify`, where the lesson decides the order, and this,
 * where the child does.
 */

/** Only one animal talks at a time, or a yard of twelve becomes noise. */
let speaking = null;

export default {
  name: 'explore',

  build(stage, { lesson }) {
    for (const object of lesson.objects) {
      stage.appendChild(createObject(object));
    }
  },

  /**
   * Steps still exist, and the teacher still drives them — but here a step is
   * an invitation ("can you find the goat?"), not a thing being pointed at.
   * So a step clears the child's selection and nothing more.
   */
  applyStep(stage) {
    clearHighlights(stage);
    speaking = null;
  },

  teardown(stage) {
    stage.innerHTML = '';
    speaking = null;
  },
};

function createObject({ id, model, build, params, position, rotation, scale, clip, clipSpeed, wander, audio, script }) {
  const el = document.createElement('a-entity');

  el.setAttribute('id', id);

  // An object is either downloaded or built. A school tour taps buildings, and
  // a building is boxes — so the same `build` a stage prop uses works here.
  if (build) el.setAttribute(build, params ?? {});
  else el.setAttribute('gltf-model', `assets/models/${model}.glb`);
  el.setAttribute('position', position);
  el.setAttribute('rotation', rotation ?? '0 0 0');
  el.setAttribute('scale', scale ?? '1 1 1');

  if (clip) {
    // Speed belongs to the lesson, not to the model. The same eat cycle is
    // right for a horse and far too fast for a hen, and only the person
    // watching it can say so.
    el.setAttribute('animation-mixer', { clip, timeScale: clipSpeed ?? 1 });
    el.setAttribute('natural-idle', '');
    // A clip can lift the root off the ground; only animated models need this.
    el.setAttribute('seat-on-ground', '');

    // An animal that should be going somewhere. Without this a walk clip plays
    // on something that never leaves its spot, and the legs and the position
    // contradict each other.
    if (wander) el.setAttribute('wander', wander);
  }

  // What makes it choosable — a plain box the size of the posed animal, added
  // by `tap-target`. The animal's own mesh is NOT `.clickable`: three.js
  // raycasts a skinned mesh against its bind pose and would miss it entirely.
  el.setAttribute('tap-target', '');

  // The line this object says, carried on the object rather than looked up —
  // a template should not have to search a lesson to answer a tap.
  el.dataset.audio = audio ?? '';
  el.dataset.script = JSON.stringify(script ?? {});

  el.addEventListener('click', () => choose(el));

  return el;
}

/**
 * A child has picked something.
 *
 * Ring it, call it over, and quiet whatever was talking. The ring is the same
 * component `identify` uses — the cue a non-reading child has already learned
 * means "this one" must not change meaning between lessons.
 *
 * An animal that can walk comes to the child and speaks when it arrives.
 * Watching a cow decide to come over is a different thing from being told
 * about a cow, and it costs one method call.
 */
function choose(el) {
  const stage = el.parentNode;
  if (!stage) return;

  clearHighlights(stage);
  el.setAttribute('highlight', '');

  // Whatever was called before goes back to its own business.
  if (speaking && speaking !== el.id) {
    stage.querySelector(`#${CSS.escape(speaking)}`)?.components?.wander?.release();
  }
  speaking = el.id;

  const camera = el.sceneEl.camera;
  const viewer = camera ? camera.getWorldPosition(new THREE.Vector3()) : null;
  const walking = viewer ? el.components.wander?.approach(viewer) === true : false;

  el.emit(
    'explore-chose',
    { id: el.id, walking, script: JSON.parse(el.dataset.script || '{}') },
    true
  );
}

function clearHighlights(stage) {
  for (const child of stage.children) child.removeAttribute('highlight');
}
