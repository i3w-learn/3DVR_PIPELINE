/**
 * A cloth on a line — wet, or dry.
 *
 * "Wet" is not something a child can see on a model of a towel. It is
 * something they see happening: the cloth hangs heavy and dark, drops fall
 * off its hem, and there is a puddle under it. The dry one is the same cloth
 * with none of that, which is the comparison.
 */

import { direct, place, rod } from './terrain.js';

AFRAME.registerComponent('cloth', {
  schema: {
    width: { type: 'number', default: 0.3 },
    color: { type: 'color', default: '#e8b23a' },
    wet: { type: 'boolean', default: false },
  },

  ...direct,

  parts() {
    const { width: w, wet } = this.data;
    const h = w * 1.1, top = w * 1.45;
    const color = wet ? `#${new THREE.Color(this.data.color).multiplyScalar(0.62).getHexString()}` : this.data.color;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: w * 0.6 });

    // Two posts and a line.
    for (const s of [-1, 1]) {
      parts.push(rod([s * w * 0.75, 0, 0], [s * w * 0.75, top + w * 0.08, 0], w * 0.025, '#7a5a3c', 6));
      parts.push({ geometry: new THREE.CylinderGeometry(w * 0.09, w * 0.1, w * 0.04, 10), matrix: place(s * w * 0.75, w * 0.02, 0), color: '#7a5a3c' });
    }
    parts.push(rod([-w * 0.75, top, 0], [w * 0.75, top, 0], w * 0.008, '#e9e4d6', 4));

    // The cloth, in vertical strips so the hem can hang unevenly: a wet cloth
    // sags in the middle, a dry one hangs straight.
    const STRIPS = 8;
    for (let i = 0; i < STRIPS; i += 1) {
      const t = (i + 0.5) / STRIPS - 0.5;
      const len = h * (wet ? 1.06 - Math.abs(t) * 0.22 : 1);
      parts.push({
        geometry: new THREE.BoxGeometry(w / STRIPS, len, w * 0.02),
        matrix: place(t * w, top - len / 2, Math.sin(i * 1.9) * w * (wet ? 0.006 : 0.02)), color, shade: [0.8, 1.05],
      });
    }
    for (const s of [-1, 1]) parts.push({ geometry: new THREE.BoxGeometry(w * 0.05, w * 0.1, w * 0.05), matrix: place(s * w * 0.36, top + w * 0.01, 0), color: '#c8402f' });

    if (wet) {
      const hem = top - h;
      for (const [x, drop] of [[-0.3, 0.12], [-0.08, 0.34], [0.12, 0.2], [0.33, 0.42]]) {
        parts.push({ geometry: new THREE.SphereGeometry(w * 0.028, 8, 8), matrix: place(x * w, hem - drop * w, 0, { sy: 1.5 }), color: '#5fb4e0' });
      }
      parts.push({ geometry: new THREE.CylinderGeometry(w * 0.4, w * 0.4, 0.004, 22), matrix: place(0, 0.003, 0, { sz: 0.55 }), color: '#6fb8dc' });
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.width * 0.95, thickness: 0.05 }; },
});
