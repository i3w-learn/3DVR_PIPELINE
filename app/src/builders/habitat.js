/**
 * Where animals live: a kennel, a beehive, a den.
 *
 * Built rather than downloaded for the same reason every time — the free
 * libraries have a "dog house" that is a two-storey cottage — and because a
 * home in this lesson is three shapes and a dark doorway. The doorway is the
 * part that says "something lives in here".
 */

import { direct, place } from './terrain.js';

const DARK = '#1d1a18';

AFRAME.registerComponent('kennel', {
  schema: {
    width: { type: 'number', default: 1.0 },
    wall: { type: 'color', default: '#c98a4b' },
    roof: { type: 'color', default: '#b5402f' },
  },

  ...direct,

  parts() {
    const { width: w, wall, roof } = this.data;
    const d = w * 1.2, h = w * 0.72;
    this.spots.push({ x: 0, z: 0, r: w * 0.8 });

    const parts = [
      { geometry: new THREE.BoxGeometry(w, h, d), matrix: place(0, h / 2, 0), color: wall, shade: [0.78, 1.04] },
      // The doorway: an arch, as a box with a half-cylinder on top, proud of the wall by a centimetre.
      { geometry: new THREE.BoxGeometry(w * 0.44, h * 0.5, 0.02), matrix: place(0, h * 0.25, d / 2 + 0.006), color: DARK },
      { geometry: new THREE.CylinderGeometry(w * 0.22, w * 0.22, 0.02, 14, 1, false, 0, Math.PI),
        matrix: place(0, h * 0.5, d / 2 + 0.006, { rx: Math.PI / 2, rz: Math.PI / 2 }), color: DARK },
    ];

    // Gable roof: a three-sided prism lying along the kennel, overhanging all round.
    const prism = new THREE.CylinderGeometry(w * 0.72, w * 0.72, d * 1.12, 3, 1);
    parts.push({ geometry: prism, matrix: place(0, h + w * 0.2, 0, { rx: -Math.PI / 2, sz: 0.62 }), color: roof, shade: [0.8, 1.06], flat: true });

    return parts;
  },
});

AFRAME.registerComponent('hive', {
  schema: {
    height: { type: 'number', default: 0.9 },
    straw: { type: 'color', default: '#e0a93b' },
  },

  ...direct,

  parts() {
    const { height: h, straw } = this.data;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: h * 0.5 });

    // A stump to stand on, then coils of straw, each smaller than the last.
    parts.push({ geometry: new THREE.CylinderGeometry(h * 0.3, h * 0.34, h * 0.3, 9), matrix: place(0, h * 0.15, 0), color: '#7a5a3c', shade: [0.75, 1.05] });
    const COILS = 6;
    for (let i = 0; i < COILS; i += 1) {
      const t = i / (COILS - 1);
      const r = h * (0.36 - 0.2 * t * t);
      parts.push({
        geometry: new THREE.TorusGeometry(r, h * 0.07, 7, 18),
        matrix: place(0, h * (0.37 + t * 0.55), 0, { rx: Math.PI / 2 }), color: straw, shade: [0.74, 1.08],
      });
    }
    parts.push({ geometry: new THREE.IcosahedronGeometry(h * 0.3, 2), matrix: place(0, h * 0.6, 0, { sy: 1.25 }), color: '#c9912c', shade: [0.8, 1] });
    parts.push({ geometry: new THREE.CylinderGeometry(h * 0.07, h * 0.07, 0.03, 12), matrix: place(0, h * 0.45, h * 0.36, { rx: Math.PI / 2 }), color: DARK });

    return parts;
  },
});

AFRAME.registerComponent('den', {
  schema: {
    width: { type: 'number', default: 3.2 },
    rock: { type: 'color', default: '#84807a' },
  },

  ...direct,

  parts() {
    const { width: w, rock } = this.data;
    this.spots.push({ x: 0, z: 0, r: w * 0.62 });

    const lump = (r, x, y, z, sy = 0.8) => ({
      geometry: new THREE.IcosahedronGeometry(r, 1), lumpy: 0.3,
      matrix: place(x, y, z, { sy, ry: x * 3 + z }), color: rock, shade: [0.6, 1.06],
    });

    return [
      lump(w * 0.5, 0, w * 0.2, -w * 0.1, 0.85),
      lump(w * 0.3, -w * 0.42, w * 0.12, w * 0.05),
      lump(w * 0.28, w * 0.44, w * 0.1, w * 0.08),
      lump(w * 0.2, w * 0.12, w * 0.5, -w * 0.12),
      // The mouth of the cave.
      { geometry: new THREE.SphereGeometry(w * 0.24, 14, 10), matrix: place(0, w * 0.13, w * 0.3, { sy: 1.05, sz: 0.5 }), color: DARK },
    ];
  },
});
