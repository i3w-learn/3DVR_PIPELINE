/**
 * The headset role.
 *
 * Subscribes and obeys. It owns no clock, decides nothing, and publishes
 * nothing but its own heartbeat. Every decision about where the class is
 * belongs to the one tablet in the room.
 */

import { LessonSync } from '../lesson-sync.js';
import { FpsMeter } from '../core/fps-meter.js';
import { TOPIC } from '../core/transport.js';
import { waitingSign } from '../ui/waiting-sign.js';

/** How often a headset says it is alive, in milliseconds. */
const HEARTBEAT_MS = 1000;

/**
 * @param {object} deps
 * @param {string} [deps.id] the headset's number, from the app that opened
 *   this page (`?id=7`). The app keeps it, so clearing the browser's data
 *   does not rename the headset. Without one — on a laptop — see headsetId.
 */
export function startHeadset({ transport, session, elements, id = headsetId() }) {
  const sync = new LessonSync({ transport, session, elements });
  sync.start();

  // Until the teacher has said where the class is, say so — in the scene,
  // where a child in VR can read it. Gone on the first state message.
  const sign = waitingSign(elements, transport);
  console.log(`headset ${id} · waiting for the teacher`);
  transport.subscribe(TOPIC.state, () => sign.remove());

  elements.scene.addEventListener('enter-vr', () => console.log(`headset ${id} ✓ in VR`));
  elements.scene.addEventListener('exit-vr', () => console.log(`headset ${id} · out of VR`));

  // The battery, for the teacher's strip. Chrome on a headset reports it;
  // where a browser does not, the heartbeat simply says nothing about it.
  let battery = null;
  navigator.getBattery?.().then((manager) => {
    const read = () => { battery = Math.round(manager.level * 100); };
    manager.addEventListener('levelchange', read);
    read();
  });

  // A-Frame emits `render-target-loaded` once and then renders continuously;
  // counting ticks on the scene's own render loop is cheaper and more honest
  // than a separate requestAnimationFrame.
  const fps = new FpsMeter();
  elements.scene.addEventListener('render-target-loaded', () => {
    const scene = elements.scene;
    const original = scene.render?.bind(scene);
    if (!original) return;
    scene.render = (...args) => {
      fps.tick();
      return original(...args);
    };
  });

  setInterval(() => {
    transport.publish(
      TOPIC.status(id),
      {
        id,
        seq: session.seq,
        // `worn` is really "is this headset in VR" — a child who has taken it
        // off drops out of immersive mode, which is exactly what the teacher
        // needs to see on the status strip.
        worn: elements.scene.is('vr-mode'),
        battery,
        fps: fps.value,
      },
      { qos: 0 }
    );
  }, HEARTBEAT_MS);

  return sync;
}

/**
 * A number for a page no app opened — a headset page on a laptop, in a check.
 *
 * A real headset is given its number by the app (see above). This one lives
 * in localStorage, which is cleared along with the browser's data, so it is
 * only for development.
 */
function headsetId() {
  let id = localStorage.getItem('headsetId');

  if (!id) {
    id = String(Math.floor(Math.random() * 1000));
    localStorage.setItem('headsetId', id);
  }

  return id;
}
