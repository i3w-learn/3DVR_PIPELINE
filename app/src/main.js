/**
 * Entry point. One shell, two roles.
 *
 * The role is read before anything else, because it decides what gets wired
 * and what never loads at all. `?role=teacher` on the tablet, `?role=headset`
 * on the headset — one build, one set of lessons, one set of assets.
 *
 * See docs/ARCHITECTURE.md §8.
 */

import './components/highlight.js';
import './components/natural-idle.js';
import './components/preview-move.js';
import './components/seat-on-ground.js';
import './components/tap-target.js';
import './components/wander.js';
import './components/auto-open.js';
import './components/building.js';
import './components/blackboard.js';
import './components/door.js';
import './components/contact-shadow.js';
import './components/room.js';
import './components/flagpole.js';
import './components/furniture.js';
import './components/gate.js';
import './components/wall.js';
import './components/lab.js';
import './components/path.js';
import './components/playground.js';
import './components/portal.js';
import './components/pbr-ground.js';
import './components/sky-environment.js';
import './components/view-fade.js';
import './components/scene-look.js';

import { LocalTransport } from './core/local-transport.js';
import { Session } from './core/session.js';
import { startHeadset } from './roles/headset.js';
import { startTeacher } from './roles/teacher.js';

/** Swapped for MqttTransport when a broker is in the room. Nothing else changes. */
const transport = new LocalTransport();

const params = new URLSearchParams(location.search);
const role = params.get('role') ?? 'headset';
const lessonId = params.get('lesson') ?? 'evs-lkg-farm-animals';
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
    document.querySelector('a-camera').setAttribute('preview-move', '');

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
