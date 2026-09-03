/**
 * The school gate.
 *
 * A wall with a hole in it is a wall with a hole in it. A gate is what tells a
 * child this is a place you are let into — and for a lesson called "our
 * school", arriving at the gate is the moment the lesson starts.
 *
 * Two leaves of vertical bars, hung on the wall's pillars and standing open.
 * Open rather than shut, deliberately: a shut gate says stay out, and the
 * child is about to walk in.
 */

AFRAME.registerComponent('gate', {
  schema: {
    /** Total opening the two leaves cover when closed. */
    width: { type: 'number', default: 6 },
    height: { type: 'number', default: 2.2 },

    /** How far each leaf has swung inward, in degrees. */
    open: { type: 'number', default: 72 },

    /** Vertical bars per leaf. */
    bars: { type: 'number', default: 7 },

    frame: { type: 'color', default: '#3d4a52' },
    bar: { type: 'color', default: '#55636b' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const half = this.data.width / 2;
    this.leaf(-half, this.data.open);
    this.leaf(half, -this.data.open);
  },

  /**
   * One leaf, hinged at `x`.
   *
   * Built inside a wrapper that is rotated, so the bars stay square to their
   * own frame rather than shearing — which is what happens if each bar is
   * placed at an angle individually.
   */
  leaf(x, angle) {
    const { width, height, bars, frame, bar } = this.data;
    const leafWidth = width / 2;

    const hinge = document.createElement('a-entity');
    hinge.setAttribute('position', `${x} 0 0`);
    hinge.setAttribute('rotation', `0 ${angle} 0`);
    this.el.appendChild(hinge);

    // The leaf hangs off the hinge, so its own middle is half a leaf away.
    const mid = x < 0 ? leafWidth / 2 : -leafWidth / 2;

    // Frame: top rail, bottom rail, and the two stiles.
    this.block(hinge, leafWidth, 0.12, 0.12, mid, height - 0.06, 0, frame);
    this.block(hinge, leafWidth, 0.12, 0.12, mid, 0.35, 0, frame);
    this.block(hinge, 0.12, height, 0.12, mid - leafWidth / 2, height / 2, 0, frame);
    this.block(hinge, 0.12, height, 0.12, mid + leafWidth / 2, height / 2, 0, frame);

    // Bars, inset from the stiles so they do not overlap them.
    const span = leafWidth - 0.3;
    for (let i = 0; i < bars; i += 1) {
      const t = bars === 1 ? 0.5 : i / (bars - 1);
      this.block(hinge, 0.07, height - 0.5, 0.07, mid - span / 2 + t * span, height / 2 + 0.05, 0, bar);
    }
  },

  block(parent, w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', { color, roughness: 0.6, metalness: 0.2 });

    parent.appendChild(box);
    return box;
  },
});
