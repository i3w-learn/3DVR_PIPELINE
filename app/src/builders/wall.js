/**
 * A compound wall, with a gate.
 *
 * Every school and every house in an Indian town has one, and it is the thing
 * that tells a child where the school *starts*. Without it a building sits in
 * an open field, which is not what any of them have ever seen.
 *
 * Boxes again — a long low run, a pillar every few metres, and a gap where the
 * gate is. The gate opening is left empty rather than filled with a gate mesh:
 * a hole a child can look through reads as a way in, and costs nothing.
 */

import { builtMaterial, mergeBoxes } from './merge-boxes.js';

AFRAME.registerComponent('wall', {
  schema: {
    length: { type: 'number', default: 40 },
    height: { type: 'number', default: 1.8 },
    thickness: { type: 'number', default: 0.3 },

    /** Metres between pillars. */
    pillarEvery: { type: 'number', default: 5 },

    /** Width of the gap left for the gate. 0 for an unbroken wall. */
    gate: { type: 'number', default: 5 },

    wall: { type: 'color', default: '#ded5c4' },
    trim: { type: 'color', default: '#6b2340' },
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

    const { length, height, thickness, gate, pillarEvery } = this.data;
    const half = length / 2;
    const gap = gate / 2;

    // Two runs, left and right of the gate. With no gate it is one run, which
    // this still produces — the right-hand segment simply spans everything.
    if (gate > 0) {
      this.run(-half, -gap);
      this.run(gap, half);
    } else {
      this.run(-half, half);
    }

    // Pillars, including one either side of the opening so the gate has jambs.
    const count = Math.floor(length / pillarEvery);
    for (let i = 0; i <= count; i += 1) {
      const x = -half + i * pillarEvery;
      if (gate > 0 && Math.abs(x) < gap) continue;
      this.pillar(x);
    }

    if (gate > 0) {
      this.pillar(-gap);
      this.pillar(gap);
    }

    this.bake();
  },

  /** One stretch of wall between two x positions. */
  run(from, to) {
    const { height, thickness, wall, trim } = this.data;
    const width = to - from;
    if (width <= 0) return;

    const centre = (from + to) / 2;

    this.block(width, height, thickness, centre, height / 2, 0, wall);

    // The coping course along the top — the detail that makes a wall read as
    // built rather than as a slab standing on edge.
    this.block(width, 0.12, thickness + 0.12, centre, height + 0.06, 0, trim);
  },

  pillar(x) {
    const { height, thickness, wall, trim } = this.data;
    const side = thickness + 0.25;

    this.block(side, height + 0.25, side, x, (height + 0.25) / 2, 0, wall);
    this.block(side + 0.12, 0.14, side + 0.12, x, height + 0.32, 0, trim);
  },

  block(w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', { color, roughness: 0.9, metalness: 0 });

    this.el.appendChild(box);
    return box;
  },
});
