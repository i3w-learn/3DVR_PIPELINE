/**
 * Footprints on the ground.
 *
 * "Animals and their Footprints" is a matching lesson — whose prints are
 * these? — and a print is the rare asset that is *better* drawn than found: it
 * is a flat dark shape, and the four that matter are a split hoof, a horseshoe,
 * a bird's three toes, and an elephant's round pad.
 *
 * A trail, not a single print. One print is a smudge; a line of them, left and
 * right, walking away toward something, is unmistakably where an animal went.
 */

import { direct, place } from './terrain.js';

const flatDisc = (rx, rz, n = 14) => new THREE.CircleGeometry(1, n).rotateX(-Math.PI / 2).scale(rx, 1, rz);

/** One print of each kind, as parts centred on the origin, toes toward −Z. */
const PRINT = {
  // Two long halves with a gap between: a cloven hoof.
  cow: (s) => [-1, 1].map((side) => ({ geometry: flatDisc(s * 0.2, s * 0.46), matrix: place(side * s * 0.24, 0, 0) })),
  goat: (s) => [-1, 1].map((side) => ({ geometry: flatDisc(s * 0.15, s * 0.4), matrix: place(side * s * 0.19, 0, 0, { ry: side * -0.12 }) })),
  // An open U.
  horse: (s) => [{ geometry: new THREE.RingGeometry(s * 0.3, s * 0.5, 16, 1, Math.PI * 0.12, Math.PI * 1.76).rotateX(-Math.PI / 2).rotateY(Math.PI / 2) }],
  // Three toes forward, one back.
  hen: (s) => [[-0.5, -0.5], [0, -0.62], [0.5, -0.5], [0, 0.42]].map(([dx, dz]) => ({
    geometry: new THREE.PlaneGeometry(s * 0.09, s * 0.6).rotateX(-Math.PI / 2),
    matrix: place(dx * s * 0.42, 0, dz * s * 0.5, { ry: -dx * 0.75 }),
  })),
  // A big round pad and a row of toenails.
  elephant: (s) => [
    { geometry: flatDisc(s * 0.5, s * 0.5, 20) },
    ...[-0.5, -0.17, 0.17, 0.5].map((t) => ({ geometry: flatDisc(s * 0.09, s * 0.07), matrix: place(t * s * 0.72, 0, -s * (0.6 - Math.abs(t) * 0.2)) })),
  ],
};

AFRAME.registerComponent('footprints', {
  schema: {
    kind: { type: 'string', default: 'cow', oneOf: Object.keys(PRINT) },
    /** Length of one print in metres. Drawn larger than life, to be seen. */
    size: { type: 'number', default: 0.34 },
    count: { type: 'number', default: 6 },
    stride: { type: 'number', default: 0.62 },
    gait: { type: 'number', default: 0.22 },
    color: { type: 'color', default: '#3f3226' },
  },

  ...direct,

  parts() {
    const { kind, size, count, stride, gait, color } = this.data;
    const parts = [];

    for (let i = 0; i < count; i += 1) {
      const side = i % 2 ? 1 : -1;
      for (const part of (PRINT[kind] ?? PRINT.cow)(size)) {
        const local = part.matrix ?? new THREE.Matrix4();
        parts.push({
          geometry: part.geometry,
          matrix: place(side * gait, 0.028, -i * stride).multiply(local),
          color,
        });
      }
    }

    return parts;
  },

  highlightAnchor() {
    return { object3D: this.el.object3D, radius: 0.75, thickness: 0.05 };
  },
});
