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

AFRAME.registerComponent('room', {
  schema: {
    width: { type: 'number', default: 9 },
    depth: { type: 'number', default: 7 },
    height: { type: 'number', default: 3.2 },

    /** Windows along each side wall. */
    windows: { type: 'number', default: 2 },

    wall: { type: 'color', default: '#f0e9dc' },
    /** The painted dado every Indian classroom has, waist high. */
    dado: { type: 'color', default: '#7a9aa8' },
    floor: { type: 'color', default: '#b8a68f' },
    ceiling: { type: 'color', default: '#f5f2ec' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { width, depth, height, wall, floor, ceiling } = this.data;
    const t = 0.15; // wall thickness

    this.block(width, t, depth, 0, -t / 2, 0, floor);
    this.block(width, t, depth, 0, height + t / 2, 0, ceiling);

    // Back wall, and the two sides. The front is left open.
    this.block(width, height, t, 0, height / 2, -depth / 2, wall);
    this.block(t, height, depth, -width / 2, height / 2, 0, wall);
    this.block(t, height, depth, width / 2, height / 2, 0, wall);

    this.dado();
    this.windows();
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
