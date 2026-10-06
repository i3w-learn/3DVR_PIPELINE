/**
 * Entry point. One shell, two roles.
 *
 * The role is read before anything else, because it decides what gets wired
 * and what never loads at all. `?role=teacher` on the tablet, `?role=headset`
 * on the headset — one build, one set of lessons, one set of assets.
 *
 * See docs/ARCHITECTURE.md §8.
 */

import './behaviours/index.js';
import './builders/index.js';
import './scene/index.js';

import { ClassroomTransport } from './core/classroom-transport.js';
import { LocalTransport } from './core/local-transport.js';
import { Session } from './core/session.js';
import { startHeadset } from './roles/headset.js';
import { startTeacher } from './roles/teacher.js';
import { lookCloser } from './ui/look-closer.js';

const params = new URLSearchParams(location.search);

// `?classroom=ws://…` is the meeting point on the teacher's tablet. The apps
// put it in the address they open; a laptop never has it, and the whole thing
// runs inside one page instead. Nothing else changes between the two.
const transport = params.has('classroom')
  ? new ClassroomTransport(params.get('classroom'))
  : new LocalTransport();

// A bare address is a person, not a headset. Send them to the list of lands
// and let them pick one. A headset that must wait for a teacher's tablet says
// so explicitly with ?role=headset, so nothing is lost by making the front
// door a menu.
if (!params.has('lesson') && !params.has('role')) {
  location.replace('lands.html');
}

const role = params.get('role') ?? 'headset';
const lessonId = params.get('lesson') ?? 'evs-lkg-farm-yard';
const lang = params.get('lang') ?? 'en';

document.body.dataset.role = role;
document.body.dataset.lang = lang;

const scene = document.querySelector('a-scene');

/**
 * One cursor per role, and only one.
 *
 * The headset child chooses by looking, so the gaze cursor fuses on whatever
 * is centre-screen. The teacher chooses by tapping. Leaving both alive on the
 * tablet means the gaze cursor re-selects whatever the camera happens to face
 * about a second after every tap — the teacher taps the cow and the elephant
 * answers.
 */
// Removing the element, not the attribute: `<a-cursor>` is a primitive that
// re-applies its own `cursor` component, so stripping the attribute leaves it
// raycasting.
const unusedCursor = role === 'teacher' ? 'a-cursor' : '#pointer';
document.querySelector(unusedCursor)?.remove();

// A lesson that fails to build says so on screen, not only in a console the
// content author will never open.
scene.addEventListener('lesson-error', (event) => {
  document.querySelector('#error').textContent = event.detail.message;
});

scene.addEventListener('loaded', async () => {
  // Sharper in the headset. By default WebXR renders at the device's
  // "recommended" size, which on a Quest is below the panel's pixels, and the
  // upscale reads as a blurry, pixelated picture. 1.2x was not enough — Manas
  // could still see the pixels, and it put him off. 1.5x is roughly the
  // panel's own resolution on a Quest 2 and costs about twice the GPU time
  // of the default; the scenes are small enough to afford it. It has to be
  // set before a session starts, so here, once.
  scene.renderer?.xr?.setFramebufferScaleFactor?.(1.5);

  // Walking is a review tool, not a feature of the lesson. The headset never
  // gets it — see preview-move for why that line matters.
  //
  // Attached here rather than at module top: a component added before the
  // scene has loaded never joins its tick list, so it initialises, holds
  // state, and is simply never called.
  if (role === 'teacher') {
    // On the rig, not the camera. Walking moves the person; the camera is
    // only their eyes, and in a headset it is not ours to move at all.
    document.querySelector('#rig').setAttribute('preview-move', '');

    // Focus the canvas so walking works on load, without a click first.
    // Keyboard controls that need an undocumented click to wake up read as
    // broken, and there is nothing on screen to suggest otherwise.
    const canvas = scene.canvas;
    if (canvas) {
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
    }
  }

  const elements = {
    scene,
    stage: document.querySelector('#stage'),
    ground: document.querySelector('#ground'),
    voice: document.querySelector('#voice'),
    sfx: document.querySelector('#sfx'),
  };

  await transport.connect();

  // A headset ignores any state whose number is not higher than the last it
  // acted on. So a teacher's page that restarts must not count from one again,
  // or every headset in the room would ignore her until she caught up with
  // where she had been. Counting on from the clock guarantees a fresh start
  // is always higher than any earlier one. Headsets start at zero: their
  // number is whatever they are told.
  const session = new Session({ lang, seq: role === 'teacher' ? Date.now() : 0 });

  try {
    if (role === 'teacher') {
      await startTeacher({
        transport,
        session,
        elements,
        controlsRoot: document.querySelector('#controls'),
        lessonId,
      });

      // `&look=apple,pear` draws close-ups of those objects over the page:
      // the reviewer's check that a new model is the right size and way up.
      if (params.has('look')) await lookCloser(scene, params.get('look'));
    } else {
      startHeadset({ transport, session, elements });
    }
  } catch (error) {
    // A content error must be loud. Silently showing an empty field is how a
    // broken lesson reaches a classroom.
    document.querySelector('#error').textContent = error.message;
    console.error(error);
  }
});
