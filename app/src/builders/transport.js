/**
 * Transport: the auto-rickshaw, and the three mats vehicles are sorted onto.
 *
 * The auto is here because it is the vehicle a child in this programme has
 * actually ridden in, and no free library has one. It is a box with a hood,
 * three wheels and a windscreen — the black-and-yellow does the rest.
 */

import { direct, place, rod } from './terrain.js';

AFRAME.registerComponent('autorickshaw', {
  schema: {
    length: { type: 'number', default: 2.7 },
    body: { type: 'color', default: '#f2c230' },
    hood: { type: 'color', default: '#23262b' },
  },

  ...direct,

  parts() {
    const { length: L, body, hood } = this.data;
    const w = L * 0.5, h = L * 0.62;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: L * 0.55 });

    const box = (bw, bh, bd, x, y, z, color, o = {}, shade = [0.8, 1.05]) =>
      parts.push({ geometry: new THREE.BoxGeometry(bw, bh, bd), matrix: place(x, y, z, o), color, shade });
    const wheel = (x, z) => parts.push({
      geometry: new THREE.CylinderGeometry(L * 0.085, L * 0.085, L * 0.05, 14), matrix: place(x, L * 0.085, z, { rz: Math.PI / 2 }), color: '#1b1c1f',
    });

    // Passenger tub at the back, nose at the front. It faces +Z, like every model.
    box(w, h * 0.42, L * 0.56, 0, h * 0.34, -L * 0.18, body);
    box(w * 0.78, h * 0.36, L * 0.3, 0, h * 0.31, L * 0.24, body);
    box(w * 0.5, h * 0.2, L * 0.16, 0, h * 0.23, L * 0.44, body, {}, [0.85, 1.05]);
    // A black band, the way every city paints them.
    box(w * 1.01, h * 0.07, L * 0.565, 0, h * 0.2, -L * 0.18, hood);

    // The hood: a roof on four thin posts, with the windscreen leaning back under it.
    box(w * 1.02, h * 0.08, L * 0.72, 0, h * 0.97, -L * 0.08, hood, {}, [0.9, 1.2]);
    box(w * 1.0, h * 0.34, L * 0.04, 0, h * 0.78, -L * 0.45, hood);
    for (const s of [-1, 1]) {
      parts.push(rod([s * w * 0.46, h * 0.5, L * 0.27], [s * w * 0.47, h * 0.95, L * 0.22], L * 0.012, hood, 4));
      parts.push(rod([s * w * 0.48, h * 0.55, -L * 0.1], [s * w * 0.48, h * 0.95, -L * 0.1], L * 0.012, hood, 4));
    }
    box(w * 0.86, h * 0.4, 0.02, 0, h * 0.73, L * 0.3, '#a9d3e6', { rx: -0.22 }, [1, 1]);

    // One headlight, handlebar-high, and three wheels.
    parts.push({ geometry: new THREE.CylinderGeometry(L * 0.04, L * 0.04, 0.04, 12), matrix: place(0, h * 0.43, L * 0.4, { rx: Math.PI / 2 }), color: '#fdf6d8' });
    wheel(0, L * 0.4); wheel(-w * 0.5, -L * 0.3); wheel(w * 0.5, -L * 0.3);

    return parts;
  },

  highlightAnchor() {
    return { radius: this.data.length * 0.66, thickness: 0.045 };
  },
});

/**
 * A mat that says where a vehicle belongs: road, water or sky.
 *
 * Sorting needs somewhere to sort TO. Three words on three cards would do it
 * for a reader; for a four-year-old the place itself has to be the label.
 */
AFRAME.registerComponent('mat', {
  schema: {
    kind: { type: 'string', default: 'road', oneOf: ['road', 'water', 'sky'] },
    width: { type: 'number', default: 0.42 },
    depth: { type: 'number', default: 0.5 },
  },

  ...direct,

  parts() {
    const { kind, width: w, depth: d } = this.data;
    const t = 0.012;
    const slab = (color) => ({ geometry: new THREE.BoxGeometry(w, t, d), matrix: place(0, t / 2, 0), color });
    const parts = [];

    if (kind === 'road') {
      parts.push(slab('#4a4d52'));
      for (let i = -2; i <= 2; i += 1) {
        parts.push({ geometry: new THREE.BoxGeometry(w * 0.13, 0.002, d * 0.035), matrix: place(i * w * 0.2, t + 0.001, 0), color: '#f4f1e4' });
      }
      for (const s of [-1, 1]) parts.push({ geometry: new THREE.BoxGeometry(w, 0.002, d * 0.03), matrix: place(0, t + 0.001, s * d * 0.44), color: '#f0c52e' });
    } else if (kind === 'water') {
      parts.push(slab('#2f86c4'));
      for (let row = -1; row <= 1; row += 1) {
        for (let i = -2; i <= 2; i += 1) {
          parts.push({
            geometry: new THREE.TorusGeometry(w * 0.07, w * 0.009, 4, 10, Math.PI),
            matrix: place(i * w * 0.2 + (row % 2) * w * 0.1, t + 0.002, row * d * 0.3, { rx: -Math.PI / 2 }), color: '#bfe4f5',
          });
        }
      }
    } else {
      parts.push(slab('#9fd3f2'));
      for (const [x, z, s] of [[-0.2, -0.25, 1], [0.22, 0.12, 0.8], [-0.12, 0.32, 0.6]]) {
        for (const [dx, r] of [[-0.07, 0.05], [0, 0.07], [0.075, 0.055]]) {
          parts.push({
            geometry: new THREE.IcosahedronGeometry(w * r * s, 1),
            matrix: place(x * w + dx * w * s, t, z * d, { sy: 0.22 }), color: '#ffffff', shade: [0.92, 1.04],
          });
        }
      }
    }

    return parts;
  },

  highlightAnchor() {
    return { radius: Math.max(this.data.width, this.data.depth) * 0.62, thickness: 0.035 };
  },
});
