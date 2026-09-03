/**
 * The blackboard, and the low platform the teacher stands on.
 *
 * It is the one object in the room a child will point at when asked what a
 * classroom is. Worth its own component for that reason alone, and it is
 * five boxes.
 */

AFRAME.registerComponent('blackboard', {
  schema: {
    width: { type: 'number', default: 3.6 },
    height: { type: 'number', default: 1.4 },
    /** Height of its bottom edge above the floor — a small child's eye line. */
    sill: { type: 'number', default: 0.75 },

    board: { type: 'color', default: '#2b3a33' },
    frame: { type: 'color', default: '#6b5136' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { width, height, sill, board, frame } = this.data;
    const mid = sill + height / 2;

    this.block(width + 0.16, height + 0.16, 0.06, 0, mid, 0, frame);
    this.block(width, height, 0.04, 0, mid, 0.03, board);

    // The chalk ledge along the bottom.
    this.block(width + 0.16, 0.07, 0.14, 0, sill - 0.08, 0.08, frame);
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
