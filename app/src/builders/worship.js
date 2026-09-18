/**
 * Places of worship: temple, mosque, church, gurdwara.
 *
 * One component draws all four, and that is the point. They share a footprint,
 * a height, a stone and a level of detail, so no faith in the lesson is
 * grander, nearer or better made than another. What differs is only the
 * silhouette each is known by: a shikhara, a dome between minarets, a steeple,
 * a dome with a saffron flag.
 *
 * Deliberately no sacred symbols beyond a plain cross and a plain crescent
 * finial, which are architecture. Anything more belongs to the reviewers this
 * lesson is gated on — see the lesson's `gate`.
 */

import { direct, place, rod } from './terrain.js';

const STONE = '#efe6d2';
const TRIM = '#c9b891';
const DOOR = '#5a3d28';

AFRAME.registerComponent('worship', {
  schema: {
    kind: { type: 'string', default: 'temple', oneOf: ['temple', 'mosque', 'church', 'gurdwara'] },
    width: { type: 'number', default: 7 },
  },

  ...direct,

  parts() {
    const { kind, width: w } = this.data;
    const parts = [];
    const d = w * 0.8, h = w * 0.5;                     // the hall every one of them has
    this.spots.push({ x: 0, z: 0, r: w * 0.75 });

    const box = (bw, bh, bd, x, y, z, color, shade = [0.84, 1.05]) =>
      parts.push({ geometry: new THREE.BoxGeometry(bw, bh, bd), matrix: place(x, y, z), color, shade });
    const dome = (r, x, y, z, color, sy = 1) =>
      parts.push({ geometry: new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), matrix: place(x, y, z, { sy }), color, shade: [0.82, 1.08] });
    const arch = (x, y, z, aw, ah) => {
      box(aw, ah, 0.06, x, y + ah / 2, z, DOOR, [1, 1]);
      parts.push({ geometry: new THREE.CylinderGeometry(aw / 2, aw / 2, 0.06, 16, 1, false, 0, Math.PI), matrix: place(x, y + ah, z, { rx: Math.PI / 2, rz: Math.PI / 2 }), color: DOOR });
    };

    // Plinth, hall, cornice, door: identical for all four.
    box(w * 1.12, w * 0.05, d * 1.14, 0, w * 0.025, 0, TRIM);
    box(w, h, d, 0, w * 0.05 + h / 2, 0, STONE);
    box(w * 1.04, w * 0.035, d * 1.05, 0, w * 0.05 + h, 0, TRIM);
    arch(0, w * 0.05, d / 2 + 0.02, w * 0.2, h * 0.5);
    for (const s of [-1, 1]) arch(s * w * 0.32, w * 0.05 + h * 0.3, d / 2 + 0.02, w * 0.09, h * 0.22);

    const roof = w * 0.05 + h + w * 0.035;

    if (kind === 'temple') {
      // A shikhara: tiers stepping in and up, a pot-shaped finial, a flag.
      let y = roof, tier = w * 0.46;
      for (let i = 0; i < 6; i += 1) {
        const th = w * 0.12;
        box(tier, th, tier, 0, y + th / 2, -d * 0.12, i % 2 ? TRIM : STONE);
        y += th; tier *= 0.8;
      }
      parts.push({ geometry: new THREE.SphereGeometry(w * 0.05, 12, 10), matrix: place(0, y + w * 0.04, -d * 0.12, { sy: 0.8 }), color: '#d9a62e', shade: [0.85, 1.1] });
      parts.push(rod([0, y + w * 0.06, -d * 0.12], [0, y + w * 0.3, -d * 0.12], w * 0.008, '#8a7a5a', 5));
      parts.push({ geometry: new THREE.ConeGeometry(w * 0.06, w * 0.14, 3), matrix: place(w * 0.07, y + w * 0.25, -d * 0.12, { rz: -Math.PI / 2, sz: 0.1 }), color: '#e8812c' });
    } else if (kind === 'mosque') {
      // A dome on a drum, between two slender minarets.
      parts.push({ geometry: new THREE.CylinderGeometry(w * 0.24, w * 0.24, w * 0.1, 20), matrix: place(0, roof + w * 0.05, 0), color: STONE, shade: [0.84, 1.05] });
      dome(w * 0.25, 0, roof + w * 0.1, 0, '#7fb8a8', 1.15);
      parts.push(rod([0, roof + w * 0.38, 0], [0, roof + w * 0.5, 0], w * 0.008, '#d9a62e', 5));
      parts.push({ geometry: new THREE.TorusGeometry(w * 0.03, w * 0.008, 5, 12, Math.PI * 1.4), matrix: place(0, roof + w * 0.53, 0, { rz: Math.PI * 0.8 }), color: '#d9a62e' });
      for (const s of [-1, 1]) {
        parts.push({ geometry: new THREE.CylinderGeometry(w * 0.045, w * 0.055, h + w * 0.55, 10), matrix: place(s * w * 0.56, (h + w * 0.55) / 2, d * 0.4), color: STONE, shade: [0.8, 1.05] });
        parts.push({ geometry: new THREE.CylinderGeometry(w * 0.07, w * 0.07, w * 0.03, 10), matrix: place(s * w * 0.56, h + w * 0.42, d * 0.4), color: TRIM });
        dome(w * 0.055, s * w * 0.56, h + w * 0.55, d * 0.4, '#7fb8a8', 1.4);
      }
    } else if (kind === 'church') {
      // A pitched roof and a steeple with a plain cross.
      const prism = new THREE.CylinderGeometry(w * 0.58, w * 0.58, d * 1.04, 3, 1);
      parts.push({ geometry: prism, matrix: place(0, roof + w * 0.14, 0, { rx: -Math.PI / 2, sz: 0.5 }), color: '#a9543f', shade: [0.82, 1.06], flat: true });
      box(w * 0.22, w * 0.5, w * 0.22, 0, roof + w * 0.25, d * 0.36, STONE);
      parts.push({ geometry: new THREE.ConeGeometry(w * 0.18, w * 0.36, 4), matrix: place(0, roof + w * 0.68, d * 0.36, { ry: Math.PI / 4 }), color: '#a9543f', shade: [0.8, 1.06], flat: true });
      box(w * 0.018, w * 0.14, w * 0.018, 0, roof + w * 0.93, d * 0.36, '#d9a62e');
      box(w * 0.08, w * 0.018, w * 0.018, 0, roof + w * 0.95, d * 0.36, '#d9a62e');
    } else {
      // Gurdwara: a ribbed white dome, small domed kiosks at the corners, and
      // the tall saffron flag that stands beside every one.
      parts.push({ geometry: new THREE.CylinderGeometry(w * 0.2, w * 0.22, w * 0.08, 20), matrix: place(0, roof + w * 0.04, 0), color: STONE, shade: [0.84, 1.05] });
      dome(w * 0.22, 0, roof + w * 0.08, 0, '#f6f2e6', 1.25);
      parts.push({ geometry: new THREE.SphereGeometry(w * 0.03, 10, 8), matrix: place(0, roof + w * 0.38, 0), color: '#d9a62e' });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(w * 0.1, w * 0.1, w * 0.1, sx * w * 0.42, roof + w * 0.05, sz * d * 0.4, STONE);
        dome(w * 0.06, sx * w * 0.42, roof + w * 0.1, sz * d * 0.4, '#f6f2e6', 1.2);
      }
      parts.push(rod([w * 0.72, 0, d * 0.45], [w * 0.72, h + w * 0.7, d * 0.45], w * 0.014, '#e8812c', 6));
      parts.push({ geometry: new THREE.ConeGeometry(w * 0.07, w * 0.2, 3), matrix: place(w * 0.82, h + w * 0.62, d * 0.45, { rz: -Math.PI / 2, sz: 0.1 }), color: '#e8812c' });
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.width * 0.85, thickness: 0.03 }; },
});
