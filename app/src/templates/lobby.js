/**
 * The lobby: every land as a picture card, in a ring around the child.
 *
 * A menu for someone who cannot read. Each card is a photograph of the land
 * itself with its name underneath in the class's language. Look at one for a
 * moment, or point at it, and you go there. Nothing on the cards is text a
 * three-year-old has to decode: the picture is the word.
 *
 * ## Why a ring and not a wall
 *
 * A wall of twenty-five cards in front of a seated child is a poster: small,
 * flat, and the far corners are out of reach of a gaze cursor. A ring puts
 * every card at the same distance and the same size, and turning the head to
 * find one is the same motion as looking around a room, which the child is
 * already doing.
 *
 * ## Who acts on a pick
 *
 * The card only announces. It emits `land-pick` on the scene with the lesson
 * id, and the role decides what that means: the teacher walks the class there
 * through the same door a portal uses. A headset that is not in charge
 * ignores it, exactly as it ignores its own portals.
 */
import { clearHighlights } from './scene.js';

/** The one file both the web list and this ring are built from. */
const LANDS = 'lands.json';

/** Where the cards stand: three rows, an arc in front of the child. */
const RING = {
  radius: 4.3,
  /** Height of the middle row. The rig puts a seated child's eyes at 1.2 m. */
  eye: 1.45,
  rowGap: 0.9,
  /** Card face, in metres. Same shape as the photographs. */
  width: 1.16,
  height: 0.72,
  gap: 0.14,
};

let landsRequest = null;

function loadLands() {
  landsRequest ??= fetch(LANDS, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`${LANDS} → ${r.status}`);
      return r.json();
    })
    .then((data) => data.lands);
  return landsRequest;
}

export default {
  name: 'lobby',

  async build(stage, { lesson }, lang = document.body.dataset.lang ?? 'en') {
    const lands = await loadLands();
    // Best-looking lands in the middle row, straight ahead; the rest above
    // and below. The file's order is the order of merit.
    const rows = [lands.slice(0, 9), lands.slice(9, 17), lands.slice(17)];
    const rowY = [RING.eye, RING.eye - RING.rowGap, RING.eye + RING.rowGap];

    rows.forEach((row, r) => {
      const step = (RING.width + RING.gap) / RING.radius; // radians per card
      const start = -((row.length - 1) * step) / 2;
      row.forEach((land, i) => {
        const angle = start + i * step;
        const x = Math.sin(angle) * RING.radius;
        const z = -Math.cos(angle) * RING.radius;
        stage.appendChild(card(land, lang, x, rowY[r], z, angle, r));
      });
    });
    stage.dataset.lobby = lesson.id;
  },

  applyStep(stage) {
    clearHighlights(stage);
  },

  teardown(stage) {
    stage.innerHTML = '';
  },
};

/**
 * One card: a frame, the photograph, the name, and the hit box the cursor
 * fuses on. Facing the child, tilted a little on the upper and lower rows so
 * the picture is seen square rather than from below or above.
 */
function card(land, lang, x, y, z, angle, row) {
  const el = document.createElement('a-entity');
  el.classList.add('prop', 'land-card');
  el.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
  const yaw = THREE.MathUtils.radToDeg(-angle);
  const pitch = row === 1 ? 10 : row === 2 ? -10 : 0;
  el.setAttribute('rotation', `${pitch} ${yaw} 0`);

  const frame = document.createElement('a-plane');
  frame.setAttribute('width', RING.width + 0.06);
  frame.setAttribute('height', RING.height + 0.06);
  frame.setAttribute('position', '0 0 -0.01');
  frame.setAttribute('material', { color: '#fbf7ee', shader: 'flat' });
  el.appendChild(frame);

  const photo = document.createElement('a-plane');
  photo.classList.add('clickable');
  photo.setAttribute('width', RING.width);
  photo.setAttribute('height', RING.height);
  // Unlit, so the photograph shows the land's own light, not the lobby's.
  photo.setAttribute('material', { src: `assets/lands/${land.id}.jpg`, shader: 'flat' });
  photo.dataset.lesson = land.lesson;
  el.appendChild(photo);

  // The name, on the same yellow card a ring puts over an animal, so "this is
  // what it is called" looks the same here as it does inside a lesson.
  const label = document.createElement('a-entity');
  label.setAttribute('glyph', {
    char: land.name[lang] ?? land.name.en,
    height: 0.15,
    card: '#ffe14d',
  });
  label.setAttribute('position', `0 ${-(RING.height / 2) - 0.11} 0.01`);
  el.appendChild(label);

  // Looking at a card lifts it a little: the cue that it is a thing you can
  // choose, before the fuse timer runs out.
  photo.addEventListener('mouseenter', () => el.setAttribute('scale', '1.08 1.08 1.08'));
  photo.addEventListener('mouseleave', () => el.setAttribute('scale', '1 1 1'));
  photo.addEventListener('click', () => {
    el.sceneEl.emit('land-pick', { lesson: land.lesson, review: land.review === true }, false);
  });

  return el;
}
