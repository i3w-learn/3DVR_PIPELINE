/**
 * Instruments a child here has actually heard: tabla, dholak, harmonium —
 * and a xylophone, because X has to be for something.
 *
 * The free libraries stop at guitar, drum kit and piano. These four are
 * cylinders and boxes; what makes each one itself is one detail — the black
 * spot on a tabla's skin, the ropes along a dholak, the bellows on a harmonium.
 */

import { direct, place, rod } from './terrain.js';

const SKIN = '#efe6d2';
const WOOD = '#8a5a34';

AFRAME.registerComponent('tabla', {
  schema: { size: { type: 'number', default: 0.3 } },

  ...direct,

  parts() {
    const s = this.data.size;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: s * 0.8 });

    // Dayan (right, wooden, narrow) and bayan (left, metal, round).
    const drum = (x, rTop, rMid, h, body) => {
      parts.push({ geometry: new THREE.CylinderGeometry(rTop, rMid, h * 0.55, 16), matrix: place(x, h * 0.72, 0), color: body, shade: [0.75, 1.05] });
      parts.push({ geometry: new THREE.CylinderGeometry(rMid, rTop * 0.72, h * 0.45, 16), matrix: place(x, h * 0.225, 0), color: body, shade: [0.65, 0.95] });
      parts.push({ geometry: new THREE.CylinderGeometry(rTop * 1.04, rTop * 1.04, h * 0.05, 18), matrix: place(x, h * 1.0, 0), color: SKIN });
      parts.push({ geometry: new THREE.CylinderGeometry(rTop * 0.42, rTop * 0.42, h * 0.012, 16), matrix: place(x, h * 1.03, 0), color: '#1d1a18' });
      parts.push({ geometry: new THREE.TorusGeometry(rTop * 0.9, h * 0.06, 6, 16), matrix: place(x, h * 0.06, 0, { rx: Math.PI / 2 }), color: '#c8402f' });
    };
    drum(s * 0.36, s * 0.22, s * 0.27, s * 0.78, WOOD);
    drum(-s * 0.34, s * 0.3, s * 0.37, s * 0.66, '#b9bec4');

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.78, thickness: 0.05 }; },
});

AFRAME.registerComponent('dholak', {
  schema: { size: { type: 'number', default: 0.34 } },

  ...direct,

  parts() {
    const s = this.data.size, r = s * 0.27;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: s * 0.6 });

    // A barrel on its side: two tapered halves, a skin on each end, ropes along it.
    for (const side of [-1, 1]) {
      parts.push({
        geometry: new THREE.CylinderGeometry(r * 0.78, r, s * 0.5, 16),
        matrix: place(side * s * 0.25, r, 0, { rz: -side * Math.PI / 2 }), color: WOOD, shade: [0.72, 1.06],
      });
      parts.push({ geometry: new THREE.CylinderGeometry(r * 0.82, r * 0.82, s * 0.03, 16), matrix: place(side * s * 0.51, r, 0, { rz: Math.PI / 2 }), color: SKIN });
    }
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2, b = a + 0.31;
      parts.push(rod([-s * 0.5, r + Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.8], [s * 0.5, r + Math.sin(b) * r * 0.8, Math.cos(b) * r * 0.8], s * 0.008, '#f1e9d6', 3));
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.75, thickness: 0.05 }; },
});

AFRAME.registerComponent('harmonium', {
  schema: { size: { type: 'number', default: 0.36 } },

  ...direct,

  parts() {
    const s = this.data.size;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: s * 0.62 });

    const box = (w, h, d, x, y, z, color, shade = [0.78, 1.05]) =>
      parts.push({ geometry: new THREE.BoxGeometry(w, h, d), matrix: place(x, y, z), color, shade });

    box(s, s * 0.34, s * 0.5, 0, s * 0.17, 0, '#6d4326');
    box(s * 0.92, s * 0.03, s * 0.2, 0, s * 0.355, s * 0.13, '#f6f2e8');                       // white keys, as one strip…
    for (let i = 0; i < 14; i += 1) box(s * 0.004, s * 0.032, s * 0.2, -s * 0.43 + i * s * 0.066, s * 0.357, s * 0.13, '#8d8577'); // …with the gaps drawn on
    for (let i = 0; i < 13; i += 1) if (![2, 6, 9].includes(i)) box(s * 0.035, s * 0.03, s * 0.11, -s * 0.397 + i * s * 0.066, s * 0.38, s * 0.085, '#1d1a18');
    // Bellows at the back: folds.
    for (let i = 0; i < 4; i += 1) box(s * 0.96, s * 0.3, s * 0.03, 0, s * 0.2, -s * 0.27 - i * s * 0.035, i % 2 ? '#2b2522' : '#8e2f2a');
    for (const x of [-0.3, -0.1, 0.1, 0.3]) parts.push({ geometry: new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.04, 8), matrix: place(x * s, s * 0.36, -s * 0.1), color: '#d9b23a' });

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.75, thickness: 0.05 }; },
});

AFRAME.registerComponent('xylophone', {
  schema: { size: { type: 'number', default: 0.36 } },

  ...direct,

  parts() {
    const s = this.data.size;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: s * 0.6 });
    const COLOURS = ['#d9362b', '#e8812c', '#f0c52e', '#3f9a4a', '#2f9fb8', '#2f6fb8', '#7a3fa0', '#d9487a'];

    for (const z of [-1, 1]) parts.push(rod([-s * 0.5, s * 0.06, z * s * 0.12], [s * 0.5, s * 0.06, z * s * 0.07], s * 0.025, WOOD, 6));
    COLOURS.forEach((color, i) => {
      const len = s * (0.46 - i * 0.03);
      parts.push({ geometry: new THREE.BoxGeometry(s * 0.095, s * 0.035, len), matrix: place(-s * 0.42 + i * s * 0.12, s * 0.105, 0), color, shade: [0.85, 1.08] });
    });
    // Two beaters resting across it.
    for (const side of [-1, 1]) {
      parts.push(rod([side * s * 0.1, s * 0.14, s * 0.3], [side * s * 0.32, s * 0.15, -s * 0.12], s * 0.012, '#d9c9a5', 5));
      parts.push({ geometry: new THREE.IcosahedronGeometry(s * 0.035, 1), matrix: place(side * s * 0.32, s * 0.155, -s * 0.12), color: '#c8402f' });
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.75, thickness: 0.05 }; },
});
