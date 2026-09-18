/**
 * A river across the land, and a glass tank for the snake house.
 *
 * The river runs left to right in front of the child and is wide enough that
 * crossing it is a real question. It is drawn above the ground, like the pond,
 * because the ground plane is opaque and a river cut into it would be buried.
 */

import { seeded } from './random.js';
import { direct, flatMaterial, mergeParts, place } from './terrain.js';

AFRAME.registerComponent('river', {
  schema: {
    width: { type: 'number', default: 9 },
    length: { type: 'number', default: 140 },
    seed: { type: 'number', default: 12 },
  },

  init() {
    const { width: w, length: L, seed } = this.data;
    const random = seeded(seed);
    const parts = [];

    // Banks: a sandy shelf either side, a little proud of the grass.
    for (const s of [-1, 1]) {
      parts.push({ geometry: new THREE.BoxGeometry(L, 0.1, w * 0.22), matrix: place(0, 0.05, s * w * 0.6), color: '#cdbb8e', shade: [0.9, 1.04] });
      for (let i = 0; i < 46; i += 1) {
        const r = 0.12 + random() * 0.3;
        parts.push({
          geometry: new THREE.IcosahedronGeometry(r, 0), lumpy: 0.3,
          matrix: place((random() - 0.5) * L * 0.6, 0.1 + r * 0.3, s * w * (0.52 + random() * 0.16), { sy: 0.6 }), color: '#8f8a80', shade: [0.7, 1.05],
        });
      }
    }
    this.el.setObject3D('banks', new THREE.Mesh(mergeParts(parts), flatMaterial()));

    // The water, and ripples that drift downstream so it reads as flowing.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(L, w),
      new THREE.MeshStandardMaterial({ color: '#3f8fb5', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.08;
    this.el.setObject3D('water', water);

    const streaks = [];
    for (let i = 0; i < 70; i += 1) {
      streaks.push({
        geometry: new THREE.BoxGeometry(0.7 + random() * 1.6, 0.005, 0.05),
        matrix: place((random() - 0.5) * 60, 0.095, (random() - 0.5) * w * 0.86), color: '#cfeaf5',
      });
    }
    this.ripples = new THREE.Mesh(mergeParts(streaks), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }));
    this.el.setObject3D('ripples', this.ripples);
  },

  tick(time) {
    // Slow, and wrapped: the streaks slide thirty metres and start again. The
    // water moves; the child never does.
    if (this.ripples) this.ripples.position.x = ((time / 1000) * 0.6) % 30 - 15;
  },

  remove() {
    for (const name of ['banks', 'water', 'ripples']) { this.el.getObject3D(name)?.geometry.dispose(); this.el.removeObject3D(name); }
  },
});

/**
 * A vivarium tank: a plinth, a sand floor, a branch, and glass.
 *
 * The glass is the lesson. A snake in the open is a threat; a snake behind
 * glass is something to look at — and the front pane is drawn clearly enough,
 * with a frame and a highlight, that a five-year-old can see it is there.
 */
AFRAME.registerComponent('tank', {
  schema: {
    width: { type: 'number', default: 1.8 },
    height: { type: 'number', default: 1.1 },
    depth: { type: 'number', default: 1.0 },
    stand: { type: 'number', default: 0.7 },
  },

  init() {
    const { width: w, height: h, depth: d, stand } = this.data;
    const frame = '#3a3f48';
    const parts = [
      { geometry: new THREE.BoxGeometry(w * 1.04, stand, d * 1.04), matrix: place(0, stand / 2, 0), color: '#6d5a44', shade: [0.75, 1.04] },
      { geometry: new THREE.BoxGeometry(w, 0.06, d), matrix: place(0, stand + 0.03, 0), color: '#d8c79a' },
      { geometry: new THREE.BoxGeometry(w, h, 0.04), matrix: place(0, stand + h / 2, -d / 2), color: '#7d9a6a', shade: [0.8, 1.05] },
      { geometry: new THREE.BoxGeometry(w * 1.04, 0.08, d * 1.04), matrix: place(0, stand + h + 0.04, 0), color: frame },
    ];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      parts.push({ geometry: new THREE.BoxGeometry(0.05, h, 0.05), matrix: place(sx * w / 2, stand + h / 2, sz * d / 2), color: frame });
    }
    // A rock and a branch for the animal to lie against.
    parts.push({ geometry: new THREE.IcosahedronGeometry(h * 0.2, 1), lumpy: 0.3, matrix: place(w * 0.28, stand + 0.06 + h * 0.08, -d * 0.2, { sy: 0.6 }), color: '#8a857c', shade: [0.7, 1.05] });
    parts.push({ geometry: new THREE.CylinderGeometry(0.035, 0.05, w * 0.7, 6), matrix: place(-w * 0.12, stand + h * 0.3, -d * 0.25, { rz: 1.2 }), color: '#6b4a30', shade: [0.8, 1.05] });
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: '#cfe8f0', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false })
    );
    glass.position.y = stand + h / 2;
    glass.renderOrder = 3;
    this.el.setObject3D('glass', glass);
  },

  highlightAnchor() { return { radius: this.data.width * 0.72, thickness: 0.04 }; },

  remove() {
    for (const name of ['mesh', 'glass']) { this.el.getObject3D(name)?.geometry.dispose(); this.el.removeObject3D(name); }
  },
});
