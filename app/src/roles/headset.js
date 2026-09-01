/**
 * The headset role.
 *
 * Subscribes and obeys. It owns no clock, decides nothing, and publishes
 * nothing but its own heartbeat. Every decision about where the class is
 * belongs to the one tablet in the room.
 */

import { LessonSync } from '../components/lesson-sync.js';
import { FpsMeter } from '../core/fps-meter.js';
import { TOPIC } from '../core/transport.js';

/** How often a headset says it is alive, in milliseconds. */
const HEARTBEAT_MS = 1000;

export function startHeadset({ transport, session, elements }) {
  const sync = new LessonSync({ transport, session, elements });
  sync.start();

  const id = headsetId();

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
        fps: fps.value,
      },
      { qos: 0 }
    );
  }, HEARTBEAT_MS);

  return sync;
}

/**
 * A stable number per device, assigned once.
 *
 * localStorage survives a reinstall on some devices and not others, so this is
 * a placeholder for a real setup screen — noted as an open question in
 * docs/ARCHITECTURE.md §11.
 */
function headsetId() {
  let id = localStorage.getItem('headsetId');

  if (!id) {
    id = String(Math.floor(Math.random() * 1000));
    localStorage.setItem('headsetId', id);
  }

  return id;
}
