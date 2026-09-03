/**
 * A room, seen from inside.
 *
 * "Going into the school" is not a door that opens — it is a different place.
 * The PRD's two base stages are outdoor and indoor for exactly this reason: an
 * interior needs its own floor, its own walls, its own light and no sky, and
 * putting one inside an exterior building would mean modelling every wall
 * twice and lighting a scene that is half daylight and half not.
 *
 * So a classroom is its own land. The teacher moves the class into it the same
 * way she moves them to the next step, and the child is simply inside.
 *
 * The shell is five boxes turned inward: floor, ceiling, three walls, and the
 * fourth wall left open behind the viewer. Leaving it open is what stops the
 * room feeling like a box — a child standing in a sealed cube feels shut in,
 * and there is nothing behind them to see anyway.
 */

import { builtMaterial, mergeBoxes } from './merge-boxes.js';

/** One doorway size for every room, so frames and portals line up. */
const DOOR_WIDTH = 1.3;
const DOOR_HEIGHT = 2.15;

/**
 * Read `left@-2.6, left@2.2, back` into door positions per wall.
 *
 * A bare name means the middle of that wall, which is what a room with one
 * way out wants — and that is every room except the corridor.
 */
function parseDoors(spec) {
  const doors = { left: [], right: [], back: [] };

  for (const entry of spec.split(',')) {
    const [name, offset] = entry.trim().split('@');
    if (!doors[name]) continue;
    doors[name].push(Number(offset ?? 0) || 0);
  }

  return doors;
}

/**
 * The solid runs of a wall, given where its holes are.
 *
 * Walks from one end to the other, stopping at each opening. A run shorter
 * than a centimetre is dropped: two doors close enough to touch would
 * otherwise leave a sliver of wall standing between them.
 */
function segments(from, to, openings) {
  const runs = [];
  let cursor = from;

  for (const centre of [...openings].sort((a, b) => a - b)) {
    const start = centre - DOOR_WIDTH / 2;
    if (start - cursor > 0.01) runs.push([cursor, start]);
    cursor = centre + DOOR_WIDTH / 2;
  }

  if (to - cursor > 0.01) runs.push([cursor, to]);
  return runs;
}

AFRAME.registerComponent('room', {
  schema: {
    width: { type: 'number', default: 9 },
    depth: { type: 'number', default: 7 },
    height: { type: 'number', default: 3.2 },

    /** Windows along each side wall. */
    windows: { type: 'number', default: 2 },

    /**
     * Where the doorways are.
     *
     * A comma-separated list of `left`, `right` or `back`, each optionally
     * followed by `@` and a position along that wall — so
     * `left@-2.6, left@2.2, back` is two doors down the left side and one at
     * the end. Without an offset a door sits in the middle of its wall.
     *
     * A room you can only be put into is a picture. A doorway is where a
     * `portal` prop stands, and walking into one moves the class to the land
     * on the other side. The corridor needs more than one door per side
     * because the school has more than three rooms.
     */
    doors: { type: 'string', default: '' },

    wall: { type: 'color', default: '#f0e9dc' },
    /** The painted dado every Indian classroom has, waist high. */
    dado: { type: 'color', default: '#7a9aa8' },
    floor: { type: 'color', default: '#b8a68f' },
    trimColor: { type: 'color', default: '#8a6a45' },
    ceiling: { type: 'color', default: '#f5f2ec' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  /**
   * Bake the boxes into one mesh.
   *
   * A frame late, because the boxes are entities and their meshes do not exist
   * until A-Frame has attached them. Without this every box is its own draw
   * call, and five buildings put the scene four times over its budget.
   */
  bake() {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => mergeBoxes(this.el, builtMaterial()));
  },

  remove() {
    cancelAnimationFrame(this.pending);
  },

  build() {
    this.el.innerHTML = '';

    const { width, depth, height, wall, floor, ceiling } = this.data;
    const t = 0.15; // wall thickness

    // A centimetre above the outdoor ground plane, which is still there at
    // y = 0 underneath. Flush, the two fought and the room came out paved.
    this.block(width, t, depth, 0, -t / 2 + 0.01, 0, floor);
    this.block(width, t, depth, 0, height + t / 2, 0, ceiling);

    // Back wall, and the two sides. The front is left open.
    const doors = parseDoors(this.data.doors);

    if (doors.back.length) this.backWall(doors.back);
    else this.block(width, height, t, 0, height / 2, -depth / 2, wall);

    for (const [name, side] of [['left', -1], ['right', 1]]) {
      if (doors[name].length) this.sideWall(side, doors[name]);
      else this.block(t, height, depth, side * width / 2, height / 2, 0, wall);
    }

    this.dado();
    this.windows();

    this.bake();
  },

  /**
   * A side wall with doorways in it.
   *
   * Boxes cannot be subtracted from each other, so the wall is built as the
   * pieces around the openings: `segments` works out where the solid runs go,
   * and each opening gets a lintel over it, an alcove behind it and a door
   * hung in it.
   */
  sideWall(side, openings) {
    const { width, height, depth, wall } = this.data;
    const t = 0.15;
    const x = side * width / 2;

    for (const [from, to] of segments(-depth / 2, depth / 2, openings)) {
      this.block(t, height, to - from, x, height / 2, (from + to) / 2, wall);
    }

    for (const z of openings) {
      this.block(t, height - DOOR_HEIGHT, DOOR_WIDTH, x, DOOR_HEIGHT + (height - DOOR_HEIGHT) / 2, z, wall);
      this.alcove(x + side * 0.45, z, side * 90);
      this.doorFrame(x + side * 0.02, z, side * 90);
      this.hangDoor(x - side * 0.06, z, side * 90);
    }
  },

  /** The far wall. Same idea, running across x instead of along z. */
  backWall(openings) {
    const { width, height, depth, wall } = this.data;
    const t = 0.15;
    const z = -depth / 2;

    for (const [from, to] of segments(-width / 2, width / 2, openings)) {
      this.block(to - from, height, t, (from + to) / 2, height / 2, z, wall);
    }

    for (const x of openings) {
      this.block(DOOR_WIDTH, height - DOOR_HEIGHT, t, x, DOOR_HEIGHT + (height - DOOR_HEIGHT) / 2, z, wall);
      this.alcove(x, z - 0.45, 0);
      this.doorFrame(x, z - 0.02, 0);
      this.hangDoor(x, z + 0.06, 0);
    }
  },

  /**
   * The shallow space behind a doorway.
   *
   * A single dark box was the obvious version and it was wrong: it read as a
   * black rectangle painted on the wall, not as somewhere. What makes it a
   * passage is that it has a lit floor and lit sides, and only the far end is
   * dark — the eye takes the receding floor as depth, and stops asking.
   */
  alcove(x, z, yaw) {
    const { wall, floor } = this.data;
    const flat = yaw === 0;
    const deep = 0.9;

    // Sized in the opening's own axes: a doorway in the back wall runs across
    // x, one in a side wall runs across z.
    const w = flat ? DOOR_WIDTH : deep;
    const d = flat ? deep : DOOR_WIDTH;

    // Every surface in here is darker than the same surface in the room. No
    // light reaches a recess, and matching the room's own colours made the
    // alcove read as a white panel stuck on the wall rather than as a way
    // through.
    this.block(w, 0.04, d, x, 0.03, z, '#6b5c4c');
    this.block(w, 0.04, d, x, DOOR_HEIGHT - 0.02, z, '#8b8579');

    const offset = DOOR_WIDTH / 2;
    for (const s of [-1, 1]) {
      this.block(
        flat ? 0.04 : deep, DOOR_HEIGHT, flat ? deep : 0.04,
        x + (flat ? s * offset : 0), DOOR_HEIGHT / 2, z + (flat ? 0 : s * offset),
        '#9a9184'
      );
    }

    this.block(
      flat ? DOOR_WIDTH : 0.04, DOOR_HEIGHT, flat ? 0.04 : DOOR_WIDTH,
      x + (flat ? 0 : Math.sign(x) * deep / 2), DOOR_HEIGHT / 2, z + (flat ? -deep / 2 : 0),
      '#2a231d'
    );
  },

  /**
   * A real door in the opening, which opens as somebody comes to it.
   *
   * `data-keep`, because its leaf swings and a baked box cannot move. One leaf
   * rather than two: this is a room off a corridor, not an entrance.
   */
  hangDoor(x, z, yaw) {
    const el = document.createElement('a-entity');
    el.dataset.keep = '';
    el.classList.add('clickable');
    el.setAttribute('position', `${x} 0 ${z}`);
    el.setAttribute('rotation', `0 ${yaw} 0`);
    el.setAttribute('door', {
      width: DOOR_WIDTH,
      height: DOOR_HEIGHT,
      leaves: 1,
      // No frame of its own — the doorway already has one.
      frameDepth: 0,
    });
    el.setAttribute('auto-open', { range: 3.2, release: 4.6 });
    this.el.appendChild(el);
  },

  /** The frame around a doorway, so the hole has an edge. */
  doorFrame(x, z, yaw) {
    const { trimColor } = this.data;
    const t = 0.1;
    const flat = yaw === 0;

    const w = flat ? DOOR_WIDTH + t * 2 : t;
    const d = flat ? t : DOOR_WIDTH + t * 2;

    this.block(w, t, d, x, DOOR_HEIGHT + t / 2, z, trimColor);

    // The jambs are the same square post either way; only which axis they
    // step along changes.
    const offset = DOOR_WIDTH / 2 + t / 2;
    for (const s of [-1, 1]) {
      this.block(
        t, DOOR_HEIGHT + t, t,
        x + (flat ? s * offset : 0),
        (DOOR_HEIGHT + t) / 2,
        z + (flat ? 0 : s * offset),
        trimColor
      );
    }
  },

  /** The painted band around the lower wall, on all three sides. */
  dado() {
    const { width, depth, dado } = this.data;
    const t = 0.16;
    const h = 1.0;

    this.block(width, h, t, 0, h / 2, -depth / 2 + 0.005, dado);
    this.block(t, h, depth, -width / 2 + 0.005, h / 2, 0, dado);
    this.block(t, h, depth, width / 2 - 0.005, h / 2, 0, dado);
  },

  /** Openings along both side walls, so the room has daylight in it. */
  windows() {
    const { width, depth, height, windows } = this.data;
    const span = depth - 2;

    for (let i = 0; i < windows; i += 1) {
      const t = windows === 1 ? 0.5 : i / (windows - 1);
      const z = -span / 2 + t * span;

      for (const side of [-1, 1]) {
        // Just inside the wall's inner face, not level with its centre — the
        // wall has thickness, and a panel placed at the centre line is buried
        // in it and never seen.
        const x = side * (width / 2 - 0.09);

        // A bright panel rather than a hole: a hole would show the void
        // outside the room, and there is nothing out there.
        this.block(0.04, 1.3, 1.4, x, height * 0.55, z, '#dceaf2');
        this.block(0.06, 0.09, 1.55, x, height * 0.55 + 0.7, z, '#8a7a63');
        this.block(0.06, 0.09, 1.55, x, height * 0.55 - 0.7, z, '#8a7a63');
        this.block(0.06, 1.48, 0.09, x, height * 0.55, z, '#8a7a63');
      }
    }
  },

  block(w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    // Inward-facing: the viewer is inside, so the back faces are the ones seen.
    box.setAttribute('material', { color, roughness: 0.95, metalness: 0, side: 'double' });

    this.el.appendChild(box);
    return box;
  },
});
