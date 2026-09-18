/**
 * What a game is played INTO: a goal, a hoop — and a shuttlecock.
 *
 * The balls, bats and rackets are downloaded. These are frames and a cone.
 */

import { direct, place, rod } from './terrain.js';

AFRAME.registerComponent('goal', {
  schema: { width: { type: 'number', default: 0.34 } },

  ...direct,

  parts() {
    const w = this.data.width, h = w * 0.6, d = w * 0.4, t = w * 0.022;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: w * 0.55 });
    const post = (a, b, r = t, c = '#f4f4f0') => parts.push(rod(a, b, r, c, 6));

    post([-w / 2, 0, 0], [-w / 2, h, 0]); post([w / 2, 0, 0], [w / 2, h, 0]); post([-w / 2, h, 0], [w / 2, h, 0]);
    post([-w / 2, h, 0], [-w / 2, 0, -d], t * 0.6); post([w / 2, h, 0], [w / 2, 0, -d], t * 0.6); post([-w / 2, 0, -d], [w / 2, 0, -d], t * 0.6);
    // The net: a few lines are enough to say "net".
    for (let i = 1; i < 8; i += 1) {
      const x = -w / 2 + (w * i) / 8;
      post([x, h, 0], [x, 0, -d], t * 0.22, '#d8dde2');
    }
    for (let i = 1; i < 4; i += 1) post([-w / 2, h * (1 - i / 4), -d * (i / 4)], [w / 2, h * (1 - i / 4), -d * (i / 4)], t * 0.22, '#d8dde2');

    return parts;
  },

  highlightAnchor() { return { radius: this.data.width * 0.7, thickness: 0.05 }; },
});

AFRAME.registerComponent('hoop', {
  schema: { height: { type: 'number', default: 0.42 } },

  ...direct,

  parts() {
    const h = this.data.height;
    this.spots.push({ x: 0, z: 0, r: h * 0.3 });

    const parts = [
      { geometry: new THREE.CylinderGeometry(h * 0.16, h * 0.18, h * 0.04, 14), matrix: place(0, h * 0.02, -h * 0.1), color: '#3a3f48' },
      rod([0, 0, -h * 0.1], [0, h * 0.8, -h * 0.1], h * 0.022, '#3a3f48', 6),
      { geometry: new THREE.BoxGeometry(h * 0.42, h * 0.3, h * 0.02), matrix: place(0, h * 0.85, -h * 0.08), color: '#f6f6f2', shade: [0.92, 1.04] },
      { geometry: new THREE.BoxGeometry(h * 0.16, h * 0.11, h * 0.024), matrix: place(0, h * 0.8, -h * 0.078), color: '#d9362b' },
      { geometry: new THREE.BoxGeometry(h * 0.12, h * 0.075, h * 0.028), matrix: place(0, h * 0.8, -h * 0.076), color: '#f6f6f2' },
      { geometry: new THREE.TorusGeometry(h * 0.09, h * 0.01, 6, 18), matrix: place(0, h * 0.74, h * 0.03, { rx: Math.PI / 2 }), color: '#e8562e' },
    ];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(rod([Math.sin(a) * h * 0.09, h * 0.74, h * 0.03 + Math.cos(a) * h * 0.09], [Math.sin(a) * h * 0.05, h * 0.6, h * 0.03 + Math.cos(a) * h * 0.05], h * 0.004, '#f0f0ec', 3));
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.height * 0.42, thickness: 0.05 }; },
});

AFRAME.registerComponent('shuttle', {
  schema: { size: { type: 'number', default: 0.2 } },

  ...direct,

  parts() {
    const s = this.data.size;
    this.spots.push({ x: 0, z: 0, r: s * 0.45 });

    // Standing on its cork, feathers up — the way it is put down on a table.
    const parts = [
      { geometry: new THREE.SphereGeometry(s * 0.17, 12, 8), matrix: place(0, s * 0.15, 0), color: '#f3ead6', shade: [0.8, 1.05] },
      { geometry: new THREE.TorusGeometry(s * 0.165, s * 0.02, 5, 14), matrix: place(0, s * 0.22, 0, { rx: Math.PI / 2 }), color: '#3f9a4a' },
      { geometry: new THREE.CylinderGeometry(s * 0.4, s * 0.15, s * 0.7, 16, 1, true), matrix: place(0, s * 0.62, 0), color: '#ffffff', shade: [0.82, 1.05] },
    ];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(rod([Math.sin(a) * s * 0.15, s * 0.27, Math.cos(a) * s * 0.15], [Math.sin(a) * s * 0.41, s * 0.98, Math.cos(a) * s * 0.41], s * 0.008, '#c9ccd0', 3));
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.6, thickness: 0.05 }; },
});
