/**
 * A peacock, tail up.
 *
 * India's national bird, and the one bird in the curriculum no free model
 * library has. It is also the easiest to build: the thing a child recognises
 * is the fan, and a fan is one feather repeated on an arc.
 */

import { direct, place, rod } from './terrain.js';

AFRAME.registerComponent('peacock', {
  schema: {
    height: { type: 'number', default: 1.1 },
    body: { type: 'color', default: '#1f5fae' },
    fan: { type: 'color', default: '#2f8f5b' },
  },

  ...direct,

  parts() {
    const { height: h, body, fan } = this.data;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: h * 0.34 });

    const blob = (rx, ry, rz, x, y, z, color, opts = {}, shade = [0.72, 1.06]) => parts.push({
      geometry: new THREE.IcosahedronGeometry(1, 2), matrix: place(x, y, z, { sx: rx, sy: ry, sz: rz, ...opts }), color, shade,
    });

    // The fan first, so everything else is drawn in front of it. Feathers are
    // long flat leaves on an arc, each ending in an eye: gold, then blue.
    const FEATHERS = 15, reach = h * 0.78, root = h * 0.42;
    for (let i = 0; i < FEATHERS; i += 1) {
      const t = (i / (FEATHERS - 1) - 0.5) * Math.PI * 1.12;
      const len = reach * (1 - 0.1 * Math.abs(t));
      const x = Math.sin(t), y = Math.cos(t);
      blob(h * 0.05, len * 0.5, h * 0.012, x * len * 0.5, root + y * len * 0.5, -h * 0.1, fan, { rz: -t }, [0.8, 1.05]);
      blob(h * 0.062, h * 0.075, h * 0.016, x * len * 0.9, root + y * len * 0.9, -h * 0.088, '#d9b23a', { rz: -t }, [1, 1]);
      blob(h * 0.034, h * 0.042, h * 0.018, x * len * 0.9, root + y * len * 0.9, -h * 0.08, '#1a3f9a', { rz: -t }, [1, 1]);
    }

    // Body, breast forward; neck rising out of it; small head.
    blob(h * 0.15, h * 0.17, h * 0.23, 0, h * 0.4, h * 0.02, body, { rx: -0.35 });
    parts.push(rod([0, h * 0.5, h * 0.12], [0, h * 0.8, h * 0.17], h * 0.042, body, 7));
    blob(h * 0.062, h * 0.058, h * 0.075, 0, h * 0.83, h * 0.19, body);

    // Beak, eyes, and the crest — a little fan of its own.
    parts.push({ geometry: new THREE.ConeGeometry(h * 0.02, h * 0.07, 5), matrix: place(0, h * 0.82, h * 0.285, { rx: Math.PI / 2 }), color: '#d8c9a0' });
    for (const sx of [-1, 1]) blob(h * 0.012, h * 0.012, h * 0.012, sx * h * 0.045, h * 0.85, h * 0.235, '#f4f1e6', {}, [1, 1]);
    for (const dx of [-0.035, 0, 0.035]) {
      parts.push(rod([0, h * 0.88, h * 0.18], [dx * h, h * 0.97, h * 0.17], h * 0.004, '#23406f', 3));
      blob(h * 0.014, h * 0.014, h * 0.014, dx * h, h * 0.975, h * 0.17, '#2aa08a', {}, [1, 1]);
    }

    // Legs.
    for (const sx of [-1, 1]) {
      parts.push(rod([sx * h * 0.06, h * 0.27, h * 0.02], [sx * h * 0.065, 0.01, h * 0.03], h * 0.012, '#8d7f6a', 4));
      parts.push(rod([sx * h * 0.065, 0.012, h * 0.0], [sx * h * 0.07, 0.012, h * 0.1], h * 0.01, '#8d7f6a', 4));
    }

    return parts;
  },
});
