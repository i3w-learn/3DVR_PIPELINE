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

import { LocalTransport } from './core/local-transport.js';
import { Session } from './core/session.js';
import { startHeadset } from './roles/headset.js';
import { startTeacher } from './roles/teacher.js';

/** Swapped for MqttTransport when a broker is in the room. Nothing else changes. */
const transport = new LocalTransport();

const params = new URLSearchParams(location.search);

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
  const session = new Session({ lang });

  try {
    if (role === 'teacher') {
      await startTeacher({
        transport,
        session,
        elements,
        controlsRoot: document.querySelector('#controls'),
        lessonId,
      });
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
