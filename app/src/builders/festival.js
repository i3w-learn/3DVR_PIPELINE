/**
 * Festival things: a diya, a rangoli, plates of gulal, a crescent and star.
 *
 * Each festival in the lesson gets one object a child would recognise from
 * their own house, and each is made the same way and at the same size —
 * nothing here is grander than anything else, on purpose.
 */

import { direct, flatMaterial, mergeParts, place } from './terrain.js';

AFRAME.registerComponent('diya', {
  schema: { size: { type: 'number', default: 0.2 } },

  init() {
    const s = this.data.size;
    const parts = [
      // The lamp: a shallow clay bowl, pinched to a spout at the front.
      { geometry: new THREE.SphereGeometry(s * 0.5, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), matrix: place(0, s * 0.3, 0, { sy: 0.6 }), color: '#b5623a', shade: [0.7, 1.05] },
      { geometry: new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.03, 16), matrix: place(0, s * 0.3, 0), color: '#e0b64a' },
      { geometry: new THREE.ConeGeometry(s * 0.16, s * 0.3, 8), matrix: place(0, s * 0.27, s * 0.5, { rx: Math.PI / 2 }), color: '#b5623a', shade: [0.8, 1] },
      { geometry: new THREE.CylinderGeometry(s * 0.2, s * 0.26, s * 0.06, 12), matrix: place(0, s * 0.03, 0), color: '#9c5230' },
    ];
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));

    // The flame is unlit — it is the light — and it flickers, slowly.
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffb52e', fog: false })
    );
    flame.scale.set(0.8, 1.9, 0.8);
    flame.position.set(0, s * 0.52, s * 0.5);
    this.flame = flame;
    this.el.setObject3D('flame', flame);
  },

  tick(time) {
    if (this.flame) this.flame.scale.y = 1.9 + Math.sin(time / 170) * 0.16 + Math.sin(time / 61) * 0.06;
  },

  highlightAnchor() { return { radius: this.data.size * 0.95, thickness: 0.05 }; },

  remove() {
    for (const name of ['mesh', 'flame']) { this.el.getObject3D(name)?.geometry.dispose(); this.el.removeObject3D(name); }
  },
});

AFRAME.registerComponent('rangoli', {
  schema: { size: { type: 'number', default: 1.0 } },

  ...direct,

  parts() {
    const s = this.data.size / 2;
    const parts = [];
    const disc = (r, y, color) => parts.push({ geometry: new THREE.CylinderGeometry(r, r, 0.004, 40), matrix: place(0, y, 0), color });
    disc(s, 0.004, '#f7f1e3'); disc(s * 0.93, 0.006, '#d9362b'); disc(s * 0.64, 0.010, '#f0c52e'); disc(s * 0.2, 0.016, '#7a3fa0');

    // Two rings of petals: flattened balls, pointing outward.
    const ring = (count, at, len, wide, y, color, turn = 0) => {
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + turn;
        parts.push({
          geometry: new THREE.IcosahedronGeometry(1, 1),
          matrix: place(Math.sin(a) * at, y, Math.cos(a) * at, { ry: a, sx: wide, sy: 0.004, sz: len }), color,
        });
      }
    };
    ring(12, s * 0.78, s * 0.14, s * 0.075, 0.012, '#f7f1e3');
    ring(8, s * 0.42, s * 0.2, s * 0.1, 0.014, '#2f9f6b');
    ring(8, s * 0.42, s * 0.13, s * 0.055, 0.017, '#f7f1e3');
    ring(8, s * 0.26, s * 0.08, s * 0.05, 0.019, '#e8812c', Math.PI / 8);

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.6, thickness: 0.04 }; },
});

AFRAME.registerComponent('gulal', {
  schema: { size: { type: 'number', default: 0.6 } },

  ...direct,

  parts() {
    const s = this.data.size;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: s * 0.6 });
    const COLOURS = ['#e0327a', '#f0c52e', '#2f9f6b', '#2f6fb8', '#e8812c'];

    // A steel thali, and a heap of colour in each of five bowls on it.
    parts.push({ geometry: new THREE.CylinderGeometry(s * 0.5, s * 0.46, s * 0.04, 28), matrix: place(0, s * 0.02, 0), color: '#c4cad0', shade: [0.8, 1.1] });
    COLOURS.forEach((color, i) => {
      const a = (i / COLOURS.length) * Math.PI * 2, x = Math.sin(a) * s * 0.29, z = Math.cos(a) * s * 0.29;
      parts.push({ geometry: new THREE.CylinderGeometry(s * 0.13, s * 0.1, s * 0.06, 14), matrix: place(x, s * 0.07, z), color: '#aeb5bc', shade: [0.8, 1.1] });
      parts.push({ geometry: new THREE.ConeGeometry(s * 0.12, s * 0.15, 12), matrix: place(x, s * 0.17, z), color, shade: [0.85, 1.1], lumpy: 0.12 });
    });

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.68, thickness: 0.05 }; },
});

AFRAME.registerComponent('crescent', {
  schema: { size: { type: 'number', default: 0.6 }, color: { type: 'color', default: '#f4d35e' } },

  ...direct,

  parts() {
    const { size: s, color } = this.data;

    // A crescent is a disc with a bite out of it: draw the outline and extrude.
    const R = s * 0.5, r = s * 0.42, off = s * 0.2;
    const shape = new THREE.Shape();
    const cross = Math.acos((off * off + R * R - r * r) / (2 * off * R));
    shape.absarc(0, 0, R, cross, Math.PI * 2 - cross, false);
    const inner = Math.atan2(R * Math.sin(cross), R * Math.cos(cross) - off);
    shape.absarc(off, 0, r, Math.PI * 2 - inner, inner, true);
    const moon = new THREE.ExtrudeGeometry(shape, { depth: s * 0.08, bevelEnabled: false, curveSegments: 28 });

    const star = new THREE.Shape();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? s * 0.06 : s * 0.15;
      star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    const starGeometry = new THREE.ExtrudeGeometry(star, { depth: s * 0.06, bevelEnabled: false });

    return [
      { geometry: moon, matrix: place(0, s * 0.62, -s * 0.04), color, shade: [0.86, 1.08], flat: true },
      { geometry: starGeometry, matrix: place(s * 0.27, s * 0.7, -s * 0.03), color, shade: [0.9, 1.08] },
      // A stand, so it is an object in the room and not a sticker in the air.
      { geometry: new THREE.CylinderGeometry(s * 0.015, s * 0.015, s * 0.16, 6), matrix: place(-s * 0.1, s * 0.08, 0), color: '#6d4a2c' },
      { geometry: new THREE.CylinderGeometry(s * 0.16, s * 0.18, s * 0.03, 16), matrix: place(-s * 0.1, s * 0.015, 0), color: '#6d4a2c' },
    ];
  },

  highlightAnchor() { return { radius: this.data.size * 0.6, thickness: 0.05 }; },
});
