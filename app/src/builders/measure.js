/**
 * Things for measuring with: a bar to compare lengths, a balance to compare
 * weights.
 *
 * Nursery maths is almost entirely comparison — long and short, thick and
 * thin, light and heavy — and every one of those needs two things that differ
 * in exactly one way. A downloaded pencil and a downloaded rope differ in
 * twelve ways. Two bars from the same builder differ in the one number the
 * lesson changed, which is the whole point of the lesson.
 */

import { direct, place, rod } from './terrain.js';

/** A bar lying on the table, along X. Square or round in section. */
AFRAME.registerComponent('bar', {
  schema: {
    length: { type: 'number', default: 0.5 },
    thickness: { type: 'number', default: 0.05 },
    round: { type: 'boolean', default: false },
    color: { type: 'color', default: '#e4572e' },
  },

  ...direct,

  parts() {
    const { length, thickness: t, round, color } = this.data;
    this.spots.push({ x: 0, z: 0, r: length * 0.52 });

    return [{
      geometry: round
        ? new THREE.CylinderGeometry(t / 2, t / 2, length, 14)
        : new THREE.BoxGeometry(length, t, t),
      matrix: round ? place(0, t / 2, 0, { rz: Math.PI / 2 }) : place(0, t / 2, 0),
      color,
      shade: [0.78, 1.06],
    }];
  },

  highlightAnchor() {
    return { object3D: this.el.object3D, radius: this.data.length * 0.62, thickness: 0.05 };
  },
});

/**
 * A two-pan balance, fixed at a tilt.
 *
 * It draws the scale and nothing on it. What sits in the pans is placed by the
 * lesson as ordinary objects, so a lesson can ring the heavy thing and a check
 * can ask the child to tap it — neither of which works if the loads are fused
 * into the scale's own mesh.
 *
 * `tilt` is in degrees, positive when the LEFT pan is down. It does not move:
 * a step cannot swing a beam without animating geometry, so "heavy" and
 * "equal" are two balances on the same spot and the lesson shows one.
 */
AFRAME.registerComponent('balance', {
  schema: {
    tilt: { type: 'number', default: 0 },
    arm: { type: 'number', default: 0.28 },
    height: { type: 'number', default: 0.36 },
    wood: { type: 'color', default: '#8a6238' },
    metal: { type: 'color', default: '#c9a227' },
  },

  ...direct,

  parts() {
    const { tilt, arm: L, height: H, wood, metal } = this.data;
    const a = (tilt * Math.PI) / 180;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: 0.2 });

    parts.push({ geometry: new THREE.CylinderGeometry(0.11, 0.13, 0.05, 16), matrix: place(0, 0.025, 0), color: wood, shade: [0.8, 1.05] });
    parts.push(rod([0, 0.05, 0], [0, H, 0], 0.014, wood, 8));
    parts.push({ geometry: new THREE.IcosahedronGeometry(0.022, 1), matrix: place(0, H + 0.01, 0), color: metal });

    // Left end drops with positive tilt; the right rises by the same amount.
    const ends = [
      [-L * Math.cos(a), H - L * Math.sin(a), 0],
      [L * Math.cos(a), H + L * Math.sin(a), 0],
    ];
    parts.push(rod(ends[0], ends[1], 0.011, wood, 6));

    for (const [x, y] of ends) {
      const pan = y - 0.12;
      for (const [dx, dz] of [[0.07, 0], [-0.035, 0.06], [-0.035, -0.06]]) {
        parts.push(rod([x, y, 0], [x + dx, pan, dz], 0.003, metal, 4));
      }
      parts.push({ geometry: new THREE.CylinderGeometry(0.085, 0.07, 0.012, 16), matrix: place(x, pan, 0), color: metal, shade: [0.85, 1.05] });
    }

    return parts;
  },

  highlightAnchor() {
    return { object3D: this.el.object3D, radius: this.data.arm * 1.35, thickness: 0.05 };
  },
});
