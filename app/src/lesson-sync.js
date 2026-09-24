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

import { TOPIC } from './core/transport.js';

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
import { loadLesson } from './core/lesson-loader.js';
import { getTemplate } from './templates/index.js';

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

    // A new lesson is a new land, and swapping one for the other in a single
    // frame is a hard cut with the child's head halfway through a turn. Go
    // dark first, rebuild behind the black, then come back.
    if (message.lesson && message.lesson !== this.#loaded?.lesson.id) {
      const fade = this.#fade();

      // Started, never awaited.
      //
      // Waiting on the fade made the lesson's arrival depend on the fade
      // finishing, and a fade only advances while the scene is ticking. Any
      // frame the renderer misses — a hidden tab, a stalled load — and the
      // build never began: a black screen with nothing behind it and no way
      // out of it. The fade is a courtesy, and a courtesy must never be able
      // to stop the thing it was decorating.
      fade?.to(1);

      await this.#buildLesson(message.lesson);
      this.#applyStep();

      // A beat in the dark. `#buildLesson` returns when the lesson is placed,
      // not when its models have arrived — without this the first frames of a
      // new land are a room with no furniture in it.
      await new Promise((resolve) => setTimeout(resolve, 220));
      fade?.to(0);
      return;
    }

    this.#applyStep();
  }

  /** The fade, if this build has one. Absent is not an error — just no fade. */
  #fade() {
    return document.querySelector('[view-fade]')?.components?.['view-fade'] ?? null;
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
    //
    // An object may opt out of the sun's shadow pass (`castShadow: false`), as
    // a prop can. The checker has always counted it that way; until now the
    // scene ignored it and drew the second pass regardless.
    const objects = new Map(loaded.lesson.objects.map((object) => [object.id, object]));
    for (const el of stageEl.children) {
      if (el.classList.contains('prop')) continue;
      this.#groundIt(el, loaded.stage, objects.get(el.id)?.castShadow !== false);
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
    //
    // The kit's ground block IS the component's data, so it is passed straight
    // through. Listing the fields here instead meant every new one — `stripes`
    // was the first — silently never arrived, and the kit looked wrong for a
    // reason nothing reported.
    // A land may have no ground. Space is the case that forced this: there is
    // nothing to stand on out there, and a 140-metre grass plane under the
    // solar system is not a small mistake.
    ground.setAttribute('visible', Boolean(stage.ground));

    if (stage.ground) {
      ground.setAttribute(
        'pbr-ground',
        typeof stage.ground === 'string' ? { color: stage.ground } : stage.ground
      );
    }

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

    this.#standWhereTheLandSays(stage);

    for (const prop of stage.props ?? []) {
      const el = document.createElement('a-entity');

      // A prop is either downloaded or built. Buildings are boxes, so they are
      // cheaper and more controllable made from numbers than fetched — and a
      // curriculum that needs a school, a home, a shop and a health centre
      // needs the same shape four times with different numbers.
      if (prop.build) el.setAttribute(prop.build, prop.params ?? {});
      else el.setAttribute('gltf-model', `assets/models/${prop.model}.glb`);

      // A figure with a clip and nothing playing it stands in its rest pose,
      // which for anything rigged in Mixamo is a T-pose — arms straight out,
      // in the middle of a classroom. Naming the clip is how a stage file
      // says "and let it move".
      if (prop.clip) el.setAttribute('animation-mixer', { clip: prop.clip, loop: 'repeat' });

      // A land can have life of its own — ducks on the pond, whatever the lesson
      // is about. A kit that names nothing here behaves exactly as before.
      if (prop.clip && prop.wander) {
        el.setAttribute('animation-mixer', { clip: prop.clip, loop: 'repeat', timeScale: prop.clipSpeed ?? 1 });
        el.setAttribute('wander', prop.wander);
      }

      el.setAttribute('position', prop.position);
      el.setAttribute('rotation', prop.rotation ?? '0 0 0');
      el.setAttribute('scale', prop.scale ?? '1 1 1');
      el.classList.add('prop'); // never a highlight target
      this.#groundIt(el, stage, prop.castShadow, prop.contact);
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
  #groundIt(el, stage, castShadow = true, contact = true) {
    const castShadows = stage.shadows !== false;

    // A prop beyond the shadow camera's box is submitted to the shadow pass
    // and then clipped out of it — all of the cost, none of the shadow. Trees
    // at the far fence are the obvious case, and they are also the heaviest
    // geometry in the scene.
    if (castShadows) el.setAttribute('shadowed', { cast: castShadow, receive: true });

    // Not everything is on the ground. A chart hangs on a wall and a fan hangs
    // from the ceiling; giving either a contact patch puts a dark ellipse in
    // mid-air at its own height, because the patch sits at the prop's origin.
    // `contact: false` in a stage file is how a prop says it is not standing
    // on anything.
    if (!contact) return;

    // Lighter when the sun is also casting, or the two darkenings stack into a
    // hole under every animal.
    el.setAttribute('contact-shadow', { opacity: castShadows ? 0.22 : 0.32 });
  }

  /**
   * Put the viewer where the land says to start, facing where it says to look.
   *
   * Only when they did not walk in. A portal already decided where somebody
   * arriving through a door comes out, and it says so by leaving a mark on the
   * scene — moving them again would undo the door.
   *
   * Only for the teacher, too. The child in the headset is seated at the
   * origin and is never moved, because motion their body did not ask for is
   * what makes three-year-olds ill.
   *
   * The reason it exists: loading the playground put you at the origin facing
   * away from the building, so a land called "behind the school" had no school
   * in it. Where a land begins is a property of the land.
   */
  #standWhereTheLandSays(stage) {
    const { scene } = this.#elements;

    const walkedIn = scene.dataset.arrived === '1';
    delete scene.dataset.arrived;

    if (walkedIn || !stage.start || document.body.dataset.role !== 'teacher') return;

    const camera = scene.camera?.el;
    if (!camera) return;

    const [x, y, z] = String(stage.start.position ?? '0 1.2 0').split(' ').map(Number);
    camera.closest('[viewer-rig]')?.components['viewer-rig']?.moveTo(x, y, z);

    const yaw = THREE.MathUtils.degToRad(stage.start.facing ?? 0);
    camera.object3D.rotation.set(0, yaw, 0);

    // `look-controls` keeps its own yaw and writes it back over ours next
    // tick, so its objects have to be set as well.
    const look = camera.components['look-controls'];
    if (look) {
      look.yawObject.rotation.y = yaw;
      look.pitchObject.rotation.x = 0;
    }
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
    // A land with no sky at all — see `sky-environment`'s `space`.
    if (!sky || sky.space) {
      this.#elements.scene.setAttribute('sky-environment', { space: true, blackout: false });
      return;
    }

    this.#elements.scene.setAttribute('sky-environment', {
      src: `assets/hdri/${sky.hdri}`,
      intensity: sky.intensity ?? 1,
      space: false,
      blackout: false,
    });
  }
}
