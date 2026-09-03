/**
 * The school gate.
 *
 * A wall with a hole in it is a wall with a hole in it. A gate is what tells a
 * child this is a place you are let into — and for a lesson called "our
 * school", arriving at the gate is the moment the lesson starts.
 *
 * Two leaves of vertical bars, hung on the wall's pillars, shut. Shut rather
 * than propped open: `auto-open` swings it back as the child walks up, and
 * being let in is only a moment if it was closed first.
 */

import { builtMaterial, mergeBoxes } from './merge-boxes.js';

AFRAME.registerComponent('gate', {
  schema: {
    /** Total opening the two leaves cover when closed. */
    width: { type: 'number', default: 6 },
    height: { type: 'number', default: 2.2 },

    /**
     * How far each leaf swings when fully open, in degrees.
     *
     * 90 lays it flat along the wall, clear of the approach. Anything less
     * leaves the leaves sticking out into the path, which is what made the
     * first version read as scaffolding.
     */
    open: { type: 'number', default: 90 },

    /** Opens by itself as somebody comes to it. Off makes it a fixed prop. */
    auto: { type: 'boolean', default: true },

    /** Vertical bars per leaf. */
    bars: { type: 'number', default: 9 },

    frame: { type: 'color', default: '#3d4a52' },
    bar: { type: 'color', default: '#55636b' },
  },

  init() {
    /** 0 shut, 1 fully open. Read and written by `auto-open`. */
    this.openness = 0;
    this.hinges = [];

    this.build();
  },

  update() {
    this.build();
  },

  /** How far open the gate stands, 0 to 1. The contract `auto-open` drives. */
  setOpen(fraction) {
    this.openness = fraction;

    for (const { el, sign } of this.hinges) {
      el.object3D.rotation.y = THREE.MathUtils.degToRad(sign * this.data.open * fraction);
    }
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
    this.pending = requestAnimationFrame(() => {
      // One mesh per leaf, not one for the gate. A baked box cannot move
      // again, and these have to swing.
      for (const { el } of this.hinges) mergeBoxes(el.firstElementChild, builtMaterial());
      this.setOpen(0);
    });
  },

  remove() {
    cancelAnimationFrame(this.pending);
  },

  build() {
    this.el.innerHTML = '';
    this.hinges = [];

    const half = this.data.width / 2;
    this.leaf(-half, 1);
    this.leaf(half, -1);

    this.bake();

    // The gate applies its own opening, because a stage prop carries one
    // component and one set of numbers. Nothing in the content files has to
    // know that swinging is a second component.
    if (this.data.auto) this.el.setAttribute('auto-open', { range: 6.5, release: 9 });
  },

  /**
   * One leaf, hinged at `x`.
   *
   * Two entities deep on purpose: the outer one is the hinge and only ever
   * rotates, the inner one holds the bars and is what gets baked. Baking the
   * hinge would fold its rotation into the vertices, and then turning it would
   * turn an already-turned gate.
   *
   * `data-keep` is what stops the bake reaching in from outside.
   */
  leaf(x, sign) {
    const { width, height, bars, frame, bar } = this.data;
    const leafWidth = width / 2;

    const hinge = document.createElement('a-entity');
    hinge.dataset.keep = '';
    hinge.setAttribute('position', `${x} 0 0`);
    this.el.appendChild(hinge);

    const body = document.createElement('a-entity');
    hinge.appendChild(body);

    this.hinges.push({ el: hinge, sign });

    // The leaf hangs off the hinge at the edge of the opening, so its own
    // middle is half a leaf back towards the centre.
    const mid = sign * leafWidth / 2;

    // Frame: top rail, bottom rail, and the two stiles.
    this.block(body, leafWidth, 0.12, 0.12, mid, height - 0.06, 0, frame);
    this.block(body, leafWidth, 0.12, 0.12, mid, 0.35, 0, frame);
    this.block(body, 0.12, height, 0.12, mid - leafWidth / 2, height / 2, 0, frame);
    this.block(body, 0.12, height, 0.12, mid + leafWidth / 2, height / 2, 0, frame);

    // A middle rail. Two rails and a row of bars is a gate; one rail top and
    // bottom with nothing between is a hurdle.
    this.block(body, leafWidth, 0.09, 0.09, mid, height * 0.55, 0, frame);

    // Bars, inset from the stiles so they do not overlap them.
    const span = leafWidth - 0.3;
    for (let i = 0; i < bars; i += 1) {
      const t = bars === 1 ? 0.5 : i / (bars - 1);
      this.block(body, 0.055, height - 0.5, 0.055, mid - span / 2 + t * span, height / 2 + 0.05, 0, bar);
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
