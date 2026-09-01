/**
 * Driving the scene from the message stream.
 *
 * Listens on the transport, keeps the session honest about sequence numbers,
 * and asks the template to build or to step. It is the only thing that touches
 * both the wire and the scene graph.
 *
 * Deliberately NOT an A-Frame component. It has no attributes and nothing to
 * do per frame, so registering it as one would buy a `tick` we never use and a
 * schema we never read. It takes its collaborators through the constructor
 * instead, which is what makes it testable with `LocalTransport`.
 */

import { TOPIC } from '../core/transport.js';

/**
 * How long the animal gets before the narrator starts.
 *
 * Sound effects are trimmed to four seconds at intake, but most are shorter.
 * Two and a half is long enough for the animal to land and short enough that a
 * child does not lose interest before the sentence arrives.
 */
const SOUND_LEAD_MS = 2500;

/**
 * How long to wait for a called animal before speaking anyway.
 *
 * Walking the length of a yard at a grazing pace takes a while, and the child
 * is watching it happen — that is the point. But an animal that cannot get
 * there, because something is in the way or it was already close, must not
 * leave the lesson silent.
 */
const ARRIVAL_TIMEOUT_MS = 15000;
import { loadLesson } from '../core/lesson-loader.js';
import { getTemplate } from '../templates/index.js';

export class LessonSync {
  #transport;
  #session;
  #elements;

  #template = null;
  #onChoice = null;
  #narrationTimer = null;
  #awaiting = null;
  #loaded = null; // { lesson, stage } currently built
  #skyColour = null; // remembered so blackout can be undone

  /**
   * @param {object} deps
   * @param {import('../core/transport.js').Transport} deps.transport
   * @param {import('../core/session.js').Session} deps.session
   * @param {{scene, stage, ground, voice}} deps.elements
   */
  constructor({ transport, session, elements }) {
    this.#transport = transport;
    this.#session = session;
    this.#elements = elements;
  }

  start() {
    // `#onState` is async, and a rejection inside a transport callback has
    // nowhere to go — the scene silently stays empty while the control bar
    // says everything is fine. Anything that fails while building a lesson has
    // to be visible, so it is caught here and raised on the scene.
    this.#transport.subscribe(TOPIC.state, (message) =>
      this.#onState(message).catch((error) => this.#fail(error))
    );
    this.#transport.subscribe(TOPIC.command, (message) => this.#onCommand(message));

    // In `explore` the child picks what happens next, so the audio cue comes
    // from a choice rather than from a step. The template announces the
    // choice; playing it stays here, with the rest of the narration.
    this.#elements.stage.addEventListener('explore-chose', (event) => {
      this.#speak(event.detail.id, event.detail.walking);
      this.#onChoice?.(event.detail);
    });

    // An animal that was called speaks on arrival, not on being picked.
    this.#elements.stage.addEventListener('wander-arrived', (event) => {
      if (event.detail.id === this.#awaiting) this.#narrate(event.detail.id);
    });
  }

  /** Loud, not silent: a content error must reach the person who can fix it. */
  #fail(error) {
    console.error('[lesson-sync]', error);
    this.#elements.scene.emit('lesson-error', { message: error.message }, true);
  }

  /** The teacher's control bar subscribes to this, to show what the child chose. */
  onChoice(handler) {
    this.#onChoice = handler;
  }

  /**
   * A full state message: "you are on step 3 of this lesson".
   *
   * Never "advance". A headset that missed five messages still lands in the
   * right place, and one that arrives late is handed the retained message and
   * catches up without a line of reconnect logic of our own.
   */
  async #onState(message) {
    // Session decides whether this is news. A lower sequence number is a
    // straggler that overtook a newer message; dropping it is the whole
    // protection against a scene jumping backwards.
    if (!this.#session.apply(message)) return;

    if (message.lesson && message.lesson !== this.#loaded?.lesson.id) {
      await this.#buildLesson(message.lesson);
    }

    this.#applyStep();
  }

  async #buildLesson(lessonId) {
    const { stage: stageEl } = this.#elements;

    if (this.#template) this.#template.teardown(stageEl);

    const loaded = await loadLesson(lessonId);
    this.#template = getTemplate(loaded.lesson.template);

    this.#dressStage(loaded.stage);
    this.#template.build(stageEl, loaded);

    // Lesson objects sit on the ground the same way the kit's props do. The
    // template places them; how they meet the ground is the stage's business.
    for (const el of stageEl.children) {
      if (!el.classList.contains('prop')) this.#groundIt(el, loaded.stage);
    }

    this.#loaded = loaded;
  }

  /**
   * The land: ground plane, sky, and the kit's reused props.
   *
   * Props are built here rather than by the template because they belong to
   * the stage kit, not to the lesson. Two kits dress eleven lessons; a template
   * that placed its own trees would undo that.
   */
  #dressStage(stage) {
    const { ground, stage: stageEl, scene } = this.#elements;

    // `sky` may be a colour or a { top, horizon, sun } description. Both are
    // data; the shader does not care which the kit chose.
    this.#skyColour = stage.sky;
    this.#paintSky(stage.sky);

    // Ground is a full material, not one image — see pbr-ground.
    ground.setAttribute('pbr-ground', {
      color: stage.ground.color ?? stage.ground,
      normal: stage.ground.normal ?? '',
      rough: stage.ground.rough ?? '',
      ao: stage.ground.ao ?? '',
      repeat: stage.ground.repeat ?? 45,
    });

    // Fog tinted to the horizon is the cheapest distance cue there is: distant
    // trees fade into the sky instead of standing out as cut-outs. It also
    // hides the edge of the ground plane for free.
    if (stage.fog) {
      scene.setAttribute('fog', {
        type: 'linear',
        color: stage.fog.color,
        near: stage.fog.near ?? 14,
        far: stage.fog.far ?? 62,
      });
    } else {
      scene.removeAttribute('fog');
    }

    // Light belongs to the land, not to the shell: an indoor kit is a
    // different hour of a different day from a field at noon.
    this.#aimSun(stage);

    for (const prop of stage.props ?? []) {
      const el = document.createElement('a-entity');
      el.setAttribute('gltf-model', `assets/models/${prop.model}.glb`);
      el.setAttribute('position', prop.position);
      el.setAttribute('rotation', prop.rotation ?? '0 0 0');
      el.setAttribute('scale', prop.scale ?? '1 1 1');
      el.classList.add('prop'); // never a highlight target
      this.#groundIt(el, stage, prop.castShadow);
      stageEl.appendChild(el);
    }
  }

  /**
   * Make an object sit on the ground. Two effects, and both are needed.
   *
   * **The cast shadow** is the sun's, and it lands beside the animal rather
   * than under it — a sun 48° up throws a shadow roughly a body-length away.
   * Geometrically correct, and on its own it reads as floating, because
   * nothing darkens the grass at the point of contact.
   *
   * **The contact patch** is that darkening: the skylight an animal's own body
   * blocks from reaching the ground directly beneath it. Real ambient occlusion
   * would compute it; one soft quad approximates it for nothing.
   *
   * Together they sit. Separately, neither does — which is what made removing
   * the patch when real shadows arrived look like a regression rather than an
   * upgrade.
   *
   * `shadows: false` in a kit drops the cast shadow and leans on the patch
   * alone. That is the route back inside the frame budget if a headset cannot
   * hold 72 fps with a shadow map.
   */
  #groundIt(el, stage, castShadow = true) {
    const castShadows = stage.shadows !== false;

    // A prop beyond the shadow camera's box is submitted to the shadow pass
    // and then clipped out of it — all of the cost, none of the shadow. Trees
    // at the far fence are the obvious case, and they are also the heaviest
    // geometry in the scene.
    if (castShadows) el.setAttribute('shadowed', { cast: castShadow, receive: true });

    // Lighter when the sun is also casting, or the two darkenings stack into a
    // hole under every animal.
    el.setAttribute('contact-shadow', { opacity: castShadows ? 0.22 : 0.32 });
  }

  #aimSun(stage) {
    const sun = document.querySelector('#sun');
    const fill = document.querySelector('#sun-sky');

    if (stage.sun && sun) {
      if (stage.sun.position) sun.setAttribute('position', stage.sun.position);
      if (stage.sun.color) sun.setAttribute('light', 'color', stage.sun.color);
      if (stage.sun.intensity) sun.setAttribute('light', 'intensity', stage.sun.intensity);
    }

    if (stage.light && fill) {
      if (stage.light.sky) fill.setAttribute('light', 'color', stage.light.sky);
      if (stage.light.ground) fill.setAttribute('light', 'groundColor', stage.light.ground);
      if (stage.light.intensity) fill.setAttribute('light', 'intensity', stage.light.intensity);
    }
  }

  /**
   * A chosen object introduces itself: its own sound, then its own sentence.
   *
   * Order matters for a three-year-old. The moo is what makes them look; the
   * sentence is what teaches. Playing them together loses both.
   */
  /**
   * @param {string} objectId
   * @param {boolean} walking  true if the animal is coming over
   */
  #speak(objectId, walking = false) {
    const object = this.#loaded?.lesson.objects.find((o) => o.id === objectId);
    if (!object) return;

    const { voice, sfx } = this.#elements;

    // Cancel whatever the last choice started, or a child tapping quickly ends
    // up with two animals talking over each other.
    clearTimeout(this.#narrationTimer);
    sfx.components?.sound?.stopSound();
    voice.components?.sound?.stopSound();

    // The sound is the answer to being called — it plays straight away, while
    // the animal is still walking.
    if (object.sound) {
      sfx.setAttribute('src', `assets/sfx/${object.sound}`);
      sfx.components?.sound?.playSound();
    }

    this.#awaiting = objectId;

    // A walking animal speaks when it gets here. A standing one — a cow whose
    // pack has no walk cycle — speaks after the sound, as before.
    //
    // The timer is a backstop either way: an animal that cannot reach the
    // child (blocked, or already close enough to not move) must not leave the
    // lesson silent.
    const wait = walking ? ARRIVAL_TIMEOUT_MS : SOUND_LEAD_MS;
    this.#narrationTimer = setTimeout(() => this.#narrate(objectId), wait);
  }

  /** Say the line, once. Whichever cue got here first wins. */
  #narrate(objectId) {
    if (this.#awaiting !== objectId) return;
    this.#awaiting = null;
    clearTimeout(this.#narrationTimer);

    const object = this.#loaded?.lesson.objects.find((o) => o.id === objectId);
    if (!object?.audio) return;

    const { voice } = this.#elements;
    voice.setAttribute('src', `assets/audio/${this.#session.lang}/${object.audio}`);
    voice.components?.sound?.playSound();
  }

  #applyStep() {
    if (!this.#template || !this.#loaded) return;

    const { stage, voice } = this.#elements;
    const stepIndex = this.#session.step;

    this.#template.applyStep(stage, this.#loaded, stepIndex);

    const step = this.#loaded.lesson.steps[stepIndex];
    if (!step?.audio) return; // teacher is reading `script` aloud instead

    // Language is a folder, never part of the filename, and it comes from the
    // session rather than the lesson — which is why adding a language never
    // reopens a lesson file.
    voice.setAttribute('src', `assets/audio/${this.#session.lang}/${step.audio}`);
    voice.components?.sound?.playSound();
  }

  /** Transient actions that are not state, so they are never retained. */
  #onCommand({ cmd }) {
    const { scene } = this.#elements;

    // Blackout is the "eyes on me" control, so it has to be absolute: both
    // sky colours to black, not a dark gradient the child can still read.
    if (cmd === 'blackout') scene.setAttribute('sky-environment', 'blackout', true);
    if (cmd === 'resume' && this.#skyColour) this.#paintSky(this.#skyColour);
    if (cmd === 'recentre') scene.emit('recentre');
  }

  /**
   * @param {{hdri: string, intensity?: number}} sky
   *
   * A kit names a captured sky. Because that same image is the scene's light,
   * changing the sky changes the lighting — there is no second setting to keep
   * in step, and no way for the two to disagree.
   */
  #paintSky(sky) {
    this.#elements.scene.setAttribute('sky-environment', {
      src: `assets/hdri/${sky.hdri}`,
      intensity: sky.intensity ?? 1,
      blackout: false,
    });
  }
}
