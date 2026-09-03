/**
 * A school laboratory, built from boxes.
 *
 * A lab is not a classroom with different posters. What makes a room read as a
 * lab is three things, and all three are geometry: a **long fixed bench** you
 * work standing at, **glass on it**, and **apparatus** — a stand, a scale, a
 * rack. Take any one away and it is a room with tables in it.
 *
 * The same bench serves chemistry and physics. What changes is what stands on
 * it, which is why the things that stand on it are separate components rather
 * than options on the bench: a stage file says where the bench is and what is
 * on it, and neither knows about the other.
 *
 * Note on the curriculum: an Anganwadi is pre-primary, three to six, and has
 * no laboratory. These lands are for the older grades this system is being
 * pointed at — a four-year-old should never be walked into one.
 */

import { builder } from './built.js';

/**
 * A fixed laboratory bench: cupboards below, a worktop, and a raised reagent
 * shelf down the middle.
 *
 * The shelf is what separates a lab bench from a table. It is where the
 * bottles live, and at a child's eye level it is the first thing seen.
 */
AFRAME.registerComponent('bench', {
  schema: {
    width: { type: 'number', default: 3.2 },
    depth: { type: 'number', default: 0.75 },
    height: { type: 'number', default: 0.9 },

    /** A raised shelf of reagent bottles down the back. */
    shelf: { type: 'boolean', default: true },

    /** A sink sunk into one end. */
    sink: { type: 'boolean', default: true },

    top: { type: 'color', default: '#3f4a4f' },
    body: { type: 'color', default: '#c3b49a' },
    trim: { type: 'color', default: '#8a6a45' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, depth, height, top, trim, body } = this.data;

    // Cupboard base, set back from the worktop so the top overhangs — the
    // shadow line under the lip is what stops it reading as one solid block.
    this.block(width - 0.1, height - 0.14, depth - 0.12, 0, (height - 0.14) / 2 + 0.14, 0, body);
    this.block(width, 0.08, depth, 0, height - 0.04, 0, top);

    // A plinth, so it meets the floor in shadow rather than in a hard line.
    this.block(width - 0.16, 0.14, depth - 0.2, 0, 0.07, 0, '#7c6f5c');

    // Cupboard doors, a centimetre proud, with handles.
    const doors = Math.max(2, Math.round(width / 0.85));
    const leaf = (width - 0.2) / doors;
    for (let i = 0; i < doors; i += 1) {
      const x = -width / 2 + 0.1 + leaf * (i + 0.5);
      this.block(leaf - 0.04, height - 0.34, 0.03, x, (height - 0.34) / 2 + 0.22, depth / 2 - 0.05, trim);
      this.block(0.03, 0.14, 0.05, x + leaf / 2 - 0.1, height * 0.55, depth / 2 - 0.02, '#d8d2c4');
    }

    if (this.data.sink) this.basin(width, depth, height);
    if (this.data.shelf) this.reagentShelf(width, height);

    this.bake();
  },

  /** A steel basin sunk into one end, with a tap over it. */
  basin(width, depth, height) {
    const x = width / 2 - 0.5;

    // The rim first, then the well set down inside it. A flat dark rectangle
    // on the worktop is a stain; the rim is what makes it a hole.
    this.block(0.66, 0.03, 0.46, x, height + 0.005, 0, '#cdd2d6');
    this.block(0.56, 0.16, 0.36, x, height - 0.08, 0, '#6d7479');

    this.block(0.05, 0.34, 0.05, x, height + 0.17, -0.2, '#b9bec4');
    this.block(0.05, 0.05, 0.22, x, height + 0.32, -0.11, '#b9bec4');
  },

  /** The reagent shelf, and the bottles on it. */
  reagentShelf(width, height) {
    const y = height + 0.34;

    for (const sx of [-1, 1]) {
      this.block(0.06, 0.34, 0.06, sx * (width / 2 - 0.2), height + 0.17, 0, '#8a6a45');
    }
    this.block(width - 0.3, 0.05, 0.26, 0, y, 0, '#8a6a45');

    // Bottles. Brown glass, blue glass and clear — the three a school has.
    const glass = ['#5c3a1e', '#2f5f6e', '#c8d6d2', '#5c3a1e', '#8a9a4a'];
    const count = Math.max(4, Math.round(width * 2.2));

    for (let i = 0; i < count; i += 1) {
      const x = -width / 2 + 0.3 + i * ((width - 0.6) / (count - 1));
      const h = 0.16 + (i % 3) * 0.04;

      this.block(0.09, h, 0.09, x, y + 0.025 + h / 2, 0, glass[i % glass.length]);
      this.block(0.04, 0.03, 0.04, x, y + 0.025 + h + 0.015, 0, '#e6e2d8');
    }
  },
});

/**
 * Glassware standing on a surface.
 *
 * Placed as its own prop with a `y` matching the bench it sits on, rather than
 * as part of the bench, because chemistry has flasks where physics has a
 * balance — and because a bench with nothing on it is exactly what a lab
 * bench looks like the day before term starts.
 */
AFRAME.registerComponent('glassware', {
  schema: {
    /** Height of the surface it stands on. */
    y: { type: 'number', default: 0.9 },
    /** How wide a spread to lay it out over. */
    width: { type: 'number', default: 2.4 },

    glass: { type: 'color', default: '#cfe0dc' },
    liquid: { type: 'color', default: '#3f8f9e' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { y, width, glass, liquid } = this.data;

    // A conical flask: three stacked boxes narrowing upward. Round it is not,
    // but the silhouette is the part anybody reads.
    const flask = (x, colour) => {
      this.block(0.16, 0.06, 0.16, x, y + 0.03, 0, glass);
      this.block(0.13, 0.05, 0.13, x, y + 0.045, 0, colour);
      this.block(0.11, 0.09, 0.11, x, y + 0.105, 0, glass);
      this.block(0.05, 0.09, 0.05, x, y + 0.195, 0, glass);
    };

    flask(-width / 2 + 0.15, liquid);
    flask(-width / 2 + 0.45, '#a8482f');

    // A beaker: straight sides, a lip, and something in it.
    const beaker = (x) => {
      this.block(0.14, 0.16, 0.14, x, y + 0.08, 0, glass);
      this.block(0.12, 0.05, 0.12, x, y + 0.025, 0, liquid);
      this.block(0.16, 0.02, 0.16, x, y + 0.17, 0, glass);
    };

    beaker(width / 2 - 0.2);

    // A test-tube rack. Six tubes in a stand is the most lab-like object in
    // any school and costs almost nothing.
    const rackX = 0;
    this.block(0.5, 0.04, 0.14, rackX, y + 0.02, 0, '#8a6a45');
    this.block(0.5, 0.1, 0.03, rackX, y + 0.16, -0.055, '#8a6a45');

    for (let i = 0; i < 6; i += 1) {
      const x = rackX - 0.2 + i * 0.08;
      this.block(0.045, 0.17, 0.045, x, y + 0.13, 0, glass);
      this.block(0.04, 0.05, 0.04, x, y + 0.07, 0, i % 2 ? '#a8482f' : liquid);
    }

    this.bake();
  },
});

/**
 * Physics apparatus: a retort stand with a pendulum, a set of weights and an
 * inclined plane.
 *
 * These three are the whole of a school physics practical, and each is
 * recognisable in outline alone, which is the only thing box geometry can
 * offer.
 */
AFRAME.registerComponent('apparatus', {
  schema: {
    y: { type: 'number', default: 0.9 },
    width: { type: 'number', default: 2.6 },

    metal: { type: 'color', default: '#9aa1a8' },
    wood: { type: 'color', default: '#a97b45' },
    weight: { type: 'color', default: '#4a4f54' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { y, width, metal, wood, weight } = this.data;

    // Retort stand: heavy base, upright rod, boss and a bob on a thread.
    const sx = -width / 2 + 0.3;
    this.block(0.3, 0.04, 0.22, sx, y + 0.02, 0, weight);
    this.block(0.035, 0.7, 0.035, sx, y + 0.39, 0, metal);
    this.block(0.24, 0.03, 0.03, sx + 0.1, y + 0.72, 0, metal);

    // The thread is a very thin box. A pendulum with no thread is a ball on a
    // shelf, and the thread is the whole point of the apparatus.
    this.block(0.008, 0.34, 0.008, sx + 0.21, y + 0.55, 0, '#2f2a24');
    this.block(0.07, 0.07, 0.07, sx + 0.21, y + 0.36, 0, weight);

    // Slotted weights, stacked on their hanger.
    const wx = 0;
    for (let i = 0; i < 4; i += 1) {
      this.block(0.16 - i * 0.015, 0.035, 0.16 - i * 0.015, wx, y + 0.02 + i * 0.038, 0, weight);
    }

    // Inclined plane: a board on a wedge, with a roller at the top.
    const ix = width / 2 - 0.45;
    this.block(0.1, 0.26, 0.1, ix + 0.3, y + 0.13, 0, wood);
    this.block(0.8, 0.03, 0.22, ix, y + 0.15, 0, wood);
    this.el.lastElementChild.setAttribute('rotation', '0 0 -18');
    this.block(0.08, 0.08, 0.08, ix + 0.24, y + 0.26, 0, metal);

    this.bake();
  },
});
