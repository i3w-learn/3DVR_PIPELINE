/**
 * Classroom furniture, built from boxes.
 *
 * Same trade as `building`, one scale down. A cow has to be downloaded because
 * nobody here can model a cow; a steel almirah is a box with two doors on it,
 * and modelling it in arithmetic costs a few dozen triangles instead of a few
 * thousand, ships nothing, and recolours from a content file.
 *
 * ## What an Anganwadi classroom actually has
 *
 * This matters more than the geometry. The room is for three- to six-year-olds
 * under the ICDS scheme, and it is **not** a room with desks in it. Children
 * sit on mats on the floor in a group. There is one table, and it is the
 * teacher's. There is a steel almirah because the teaching material and the
 * register have to be locked up. There is an open shelf of blocks and toys at
 * a child's own height. There are charts on the walls, a ceiling fan, and a
 * water pot in the corner.
 *
 * Putting desks in would have been faster and would have been a picture of a
 * school none of these children attend.
 *
 * ## One file, several components
 *
 * Each piece is ten to twenty lines and they all do the same thing: place
 * boxes, then bake them into one mesh. They share `builder` rather than
 * repeating that, and they stay separate components because a stage file
 * places them separately.
 */

import { builder } from './built.js';
import { builtMaterial, mergeBoxes } from './merge-boxes.js';

/**
 * The mats the children sit on — a whole block of them, in one mesh.
 *
 * Laid out as a grid rather than placed one at a time. Six mats placed
 * individually are six entities and six draw calls; six mats as one component
 * are one of each, and the stage file says `rows` and `columns` instead of
 * repeating a prop six times with the arithmetic done by hand.
 */
AFRAME.registerComponent('mats', {
  schema: {
    rows: { type: 'number', default: 2 },
    columns: { type: 'number', default: 3 },
    width: { type: 'number', default: 1.5 },
    depth: { type: 'number', default: 1.0 },
    gap: { type: 'number', default: 0.35 },

    mat: { type: 'color', default: '#2f5f96' },
    border: { type: 'color', default: '#c4452f' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { rows, columns, width, depth, gap, mat, border } = this.data;
    const stepX = width + gap;
    const stepZ = depth + gap;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        const x = (c - (columns - 1) / 2) * stepX;
        const z = (r - (rows - 1) / 2) * stepZ;

        // Barely off the floor. A mat with real thickness reads as a step.
        this.block(width, 0.025, depth, x, 0.012, z, mat);

        // A border stripe, because a plain rectangle on a floor is a patch of
        // paint. The stripe is what makes it a woven dari.
        const t = 0.1;
        this.block(width, 0.03, t, x, 0.016, z - depth / 2 + t / 2, border);
        this.block(width, 0.03, t, x, 0.016, z + depth / 2 - t / 2, border);
        this.block(t, 0.03, depth - t * 2, x - width / 2 + t / 2, 0.016, z, border);
        this.block(t, 0.03, depth - t * 2, x + width / 2 - t / 2, 0.016, z, border);
      }
    }

    this.bake();
  },
});

/** The teacher's table. The only table in the room. */
AFRAME.registerComponent('table', {
  schema: {
    width: { type: 'number', default: 1.4 },
    depth: { type: 'number', default: 0.7 },
    height: { type: 'number', default: 0.75 },

    top: { type: 'color', default: '#a97b45' },
    leg: { type: 'color', default: '#7a5530' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, depth, height, top, leg } = this.data;

    this.block(width, 0.06, depth, 0, height - 0.03, 0, top);

    // An apron under the top. Four legs and a slab is a trestle; the apron is
    // what makes it a table.
    this.block(width - 0.12, 0.1, 0.05, 0, height - 0.11, depth / 2 - 0.06, leg);
    this.block(width - 0.12, 0.1, 0.05, 0, height - 0.11, -depth / 2 + 0.06, leg);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.block(
          0.07, height - 0.06, 0.07,
          sx * (width / 2 - 0.09), (height - 0.06) / 2, sz * (depth / 2 - 0.09),
          leg
        );
      }
    }

    this.bake();
  },
});

/** A chair, for the teacher. */
AFRAME.registerComponent('chair', {
  schema: {
    width: { type: 'number', default: 0.45 },
    depth: { type: 'number', default: 0.45 },
    seatHeight: { type: 'number', default: 0.45 },
    backHeight: { type: 'number', default: 0.5 },

    seat: { type: 'color', default: '#8a6a45' },
    frame: { type: 'color', default: '#5f4530' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, depth, seatHeight, backHeight, seat, frame } = this.data;

    this.block(width, 0.05, depth, 0, seatHeight, 0, seat);

    // Back: two uprights and two slats. Solid panels read as a bench end.
    for (const sx of [-1, 1]) {
      this.block(0.05, backHeight, 0.05, sx * (width / 2 - 0.03), seatHeight + backHeight / 2, -depth / 2 + 0.03, frame);
    }
    this.block(width, 0.08, 0.04, 0, seatHeight + backHeight - 0.06, -depth / 2 + 0.03, seat);
    this.block(width, 0.08, 0.04, 0, seatHeight + backHeight * 0.5, -depth / 2 + 0.03, seat);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.block(0.05, seatHeight, 0.05, sx * (width / 2 - 0.03), seatHeight / 2, sz * (depth / 2 - 0.03), frame);
      }
    }

    this.bake();
  },
});

/**
 * The steel almirah.
 *
 * Every Anganwadi has one, and everything that matters is inside it — the
 * register, the teaching material, the packets. It is the tallest thing in the
 * room after the blackboard, which is why leaving it out made the room look
 * unused.
 */
AFRAME.registerComponent('almirah', {
  schema: {
    width: { type: 'number', default: 1.1 },
    height: { type: 'number', default: 1.9 },
    depth: { type: 'number', default: 0.48 },

    body: { type: 'color', default: '#7c8b96' },
    door: { type: 'color', default: '#8d9ba6' },
    handle: { type: 'color', default: '#d8d2c4' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, height, depth, body, door, handle } = this.data;

    this.block(width, height, depth, 0, height / 2, 0, body);

    // Two door panels, a centimetre proud, with a seam between them. The seam
    // is the whole reason this reads as a cupboard and not as a fridge.
    const leaf = width / 2 - 0.03;
    for (const sx of [-1, 1]) {
      this.block(leaf, height - 0.1, 0.03, sx * (leaf / 2 + 0.015), height / 2, depth / 2 + 0.01, door);
      this.block(0.03, 0.28, 0.05, sx * 0.11, height * 0.52, depth / 2 + 0.04, handle);
    }

    // A lip along the top, and feet. Furniture that meets the floor in a flat
    // line looks glued to it.
    this.block(width + 0.05, 0.05, depth + 0.05, 0, height + 0.02, 0, body);
    for (const sx of [-1, 1]) {
      this.block(0.08, 0.06, depth - 0.08, sx * (width / 2 - 0.07), 0.03, 0, '#4a545c');
    }

    this.bake();
  },
});

/**
 * An open shelf of blocks and toys, at a child's height.
 *
 * The toys are coloured cubes and nothing more. At the distance a child sees
 * them from, a red cube on a shelf and a modelled toy read identically, and
 * one of them costs twelve triangles.
 */
AFRAME.registerComponent('shelf', {
  schema: {
    width: { type: 'number', default: 1.6 },
    height: { type: 'number', default: 0.9 },
    depth: { type: 'number', default: 0.34 },
    shelves: { type: 'number', default: 3 },

    /**
     * What is standing on it: `toys`, `vessels` or `files`.
     *
     * The same rack is in the classroom, the kitchen and the office, and
     * coloured building blocks on a kitchen shelf were the single thing that
     * stopped that room reading as a kitchen.
     */
    contents: { type: 'string', default: 'toys' },

    frame: { type: 'color', default: '#9a7448' },
    back: { type: 'color', default: '#c9b593' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, height, depth, shelves, frame, back } = this.data;
    const t = 0.04;

    for (const sx of [-1, 1]) {
      this.block(t, height, depth, sx * (width / 2 - t / 2), height / 2, 0, frame);
    }
    this.block(width, height, t, 0, height / 2, -depth / 2 + t / 2, back);

    // The colours a nursery actually owns, the steel a kitchen does, or the
    // cloth-bound registers an office does.
    const palette = {
      vessels: ['#b9bec4', '#a8aeb5', '#c6cbd1', '#9aa1a8'],
      files: ['#7d3b32', '#3f5d3a', '#6a5638', '#4a4f6b'],
      toys: ['#d4402f', '#f0a92b', '#2f7fbf', '#3f9e5c', '#8e4fa8'],
    };
    const toys = palette[this.data.contents] ?? palette.toys;

    for (let i = 0; i < shelves; i += 1) {
      const y = (height / (shelves - 1)) * i;
      this.block(width, t, depth, 0, Math.min(y, height - t / 2), 0, frame);

      if (i === shelves - 1) continue;

      const perShelf = 4;

      // A register lies flat and wide; a toy or a pot is roughly a cube. Same
      // arithmetic, different proportions.
      const flat = this.data.contents === 'files';

      for (let j = 0; j < perShelf; j += 1) {
        const size = 0.1 + (j % 3) * 0.03;
        const x = -width / 2 + 0.25 + j * ((width - 0.5) / (perShelf - 1));
        const h = flat ? size * 0.45 : size;
        const d = flat ? depth * 0.62 : size;
        this.block(size * 1.6, h, d, x, y + t / 2 + h / 2, 0, toys[(i * perShelf + j) % toys.length]);
      }
    }

    this.bake();
  },
});

/**
 * A wall chart.
 *
 * A grid of coloured cells inside a frame — the alphabet chart, the number
 * chart, the fruits chart, without ever spelling out which. At three years old
 * the chart is read as "the wall has learning on it" long before any letter on
 * it is; and a real letter grid would need a font, a texture and a draw call
 * of its own for something nobody in the room can read yet.
 */
AFRAME.registerComponent('chart', {
  schema: {
    width: { type: 'number', default: 1.1 },
    height: { type: 'number', default: 0.8 },
    rows: { type: 'number', default: 4 },
    columns: { type: 'number', default: 5 },

    paper: { type: 'color', default: '#f6f1e4' },
    frame: { type: 'color', default: '#6a4a2c' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, height, rows, columns, paper, frame } = this.data;
    const ink = ['#c8402f', '#2f6fb0', '#3f8f52', '#e0a327', '#8a4a9e'];

    this.block(width, height, 0.02, 0, 0, 0, paper);

    const t = 0.04;
    this.block(width + t, t, 0.03, 0, height / 2 + t / 2, 0, frame);
    this.block(width + t, t, 0.03, 0, -height / 2 - t / 2, 0, frame);
    this.block(t, height, 0.03, -width / 2 - t / 2, 0, 0, frame);
    this.block(t, height, 0.03, width / 2 + t / 2, 0, 0, frame);

    const cellW = (width - 0.1) / columns;
    const cellH = (height - 0.1) / rows;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        const x = -width / 2 + 0.05 + cellW * (c + 0.5);
        const y = height / 2 - 0.05 - cellH * (r + 0.5);
        this.block(cellW * 0.62, cellH * 0.62, 0.01, x, y, 0.015, ink[(r * columns + c) % ink.length]);
      }
    }

    this.bake();
  },
});

/**
 * The ceiling fan.
 *
 * Turning, because a still ceiling fan in an Indian classroom looks like the
 * power is out — and because it is the only thing in an empty room that says
 * the scene is running rather than paused.
 *
 * The blades are `data-keep` and bake as their own mesh, for the same reason
 * the door leaves do: once a box is merged into a bigger mesh it cannot move
 * again.
 */
AFRAME.registerComponent('fan', {
  schema: {
    /** Distance from this entity down to the blades. Hang it at the ceiling. */
    drop: { type: 'number', default: 0.5 },
    radius: { type: 'number', default: 0.75 },
    blades: { type: 'number', default: 3 },

    /** Turns per minute. Real fans do 300; that strobes badly at 60 fps. */
    rpm: { type: 'number', default: 45 },

    body: { type: 'color', default: '#e6e2d8' },
    blade: { type: 'color', default: '#d8d2c4' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { drop, radius, blades, body, blade } = this.data;

    // Rod and motor housing, baked into the entity itself.
    this.block(0.05, drop, 0.05, 0, -drop / 2, 0, body);
    this.block(0.26, 0.16, 0.26, 0, -drop - 0.08, 0, body);

    const hub = document.createElement('a-entity');
    hub.dataset.keep = '';
    hub.setAttribute('position', `0 ${-drop - 0.14} 0`);
    this.el.appendChild(hub);

    const spinner = document.createElement('a-entity');
    hub.appendChild(spinner);

    for (let i = 0; i < blades; i += 1) {
      const arm = document.createElement('a-entity');
      arm.setAttribute('rotation', `0 ${(360 / blades) * i} 0`);
      spinner.appendChild(arm);

      this.block(radius, 0.02, 0.18, radius / 2, 0, 0, blade, arm);
    }

    this.hub = hub;

    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      mergeBoxes(this.el, builtMaterial());
      mergeBoxes(spinner, builtMaterial());
    });
  },

  tick(time, delta) {
    if (!this.hub) return;
    this.hub.object3D.rotation.y += (this.data.rpm / 60) * Math.PI * 2 * (delta / 1000);
  },
});

/**
 * The water pot in the corner, on its stand, with a mug on top.
 *
 * Small, and the room is wrong without it.
 */
AFRAME.registerComponent('waterpot', {
  schema: {
    standHeight: { type: 'number', default: 0.55 },
    pot: { type: 'color', default: '#a35a35' },
    stand: { type: 'color', default: '#7a5530' },
    mug: { type: 'color', default: '#3f8f9e' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { standHeight, pot, stand, mug } = this.data;

    this.block(0.5, 0.05, 0.5, 0, standHeight, 0, stand);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.block(0.06, standHeight, 0.06, sx * 0.2, standHeight / 2, sz * 0.2, stand);
      }
    }

    // The pot itself, stepped rather than round — three boxes read as a belly
    // from any distance a child will see it from.
    this.block(0.3, 0.1, 0.3, 0, standHeight + 0.08, 0, pot);
    this.block(0.42, 0.24, 0.42, 0, standHeight + 0.25, 0, pot);
    this.block(0.26, 0.08, 0.26, 0, standHeight + 0.41, 0, pot);
    this.block(0.3, 0.03, 0.3, 0, standHeight + 0.46, 0, '#cfc6b4');

    this.block(0.1, 0.11, 0.1, 0.28, standHeight + 0.08, 0.1, mug);

    this.bake();
  },
});

/**
 * The chulha, and what stands on it.
 *
 * Without this the kitchen was a room with a table in it. A hot meal is the
 * reason half these children are enrolled at all — the lesson asks "where is
 * our food cooked?", and the answer has to be somewhere a child recognises:
 * a raised masonry block, two big steel pots, and the cylinder beside it.
 */
AFRAME.registerComponent('stove', {
  schema: {
    width: { type: 'number', default: 1.8 },
    depth: { type: 'number', default: 0.75 },
    height: { type: 'number', default: 0.7 },

    body: { type: 'color', default: '#9a8e7c' },
    top: { type: 'color', default: '#5d5346' },
    pot: { type: 'color', default: '#b4babf' },
    cylinder: { type: 'color', default: '#b8342c' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, depth, height, body, top, pot, cylinder } = this.data;

    this.block(width, height, depth, 0, height / 2, 0, body);
    this.block(width + 0.06, 0.06, depth + 0.06, 0, height + 0.03, 0, top);

    // Two fire openings, dark and set into the front — this is the part a
    // child points at.
    for (const sx of [-1, 1]) {
      this.block(0.34, 0.24, 0.05, sx * width * 0.22, height * 0.42, depth / 2 + 0.02, '#2a211a');
    }

    // The pots. Stepped boxes, because a wide belly and a narrow rim is what
    // says degchi rather than bucket.
    for (const sx of [-1, 1]) {
      const x = sx * width * 0.22;
      this.block(0.5, 0.34, 0.5, x, height + 0.23, 0, pot);
      this.block(0.56, 0.05, 0.56, x, height + 0.42, 0, '#cdd2d6');
      this.block(0.12, 0.06, 0.12, x, height + 0.47, 0, '#8d9399');
    }

    // The cylinder, standing at one end.
    const cx = -width / 2 - 0.28;
    this.block(0.36, 0.62, 0.36, cx, 0.31, 0, cylinder);
    this.block(0.16, 0.12, 0.16, cx, 0.68, 0, '#8d9399');

    this.bake();
  },
});
