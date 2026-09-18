/**
 * Water: a pond with a bank, lily pads and lotus — and a tub to drop things in.
 *
 * One builder file per land.
 *
 * ## What the first version got wrong
 *
 * It had no water. The surface was placed twelve centimetres *below* the
 * ground, on the reasoning that water sits lower than land — and the ground is
 * an opaque plane, so the pond was a lawn with reeds in it while the narration
 * said "watch the water moving".
 *
 * A hole cannot be cut in the ground plane, so the pond is built the other way
 * up: a rim of wet earth lying on the grass, and the water a few centimetres
 * above that. From a seated child's eye height the lip is invisible and the
 * bank reads as a bank.
 *
 * It is also round now. A rectangular sheet of blue is a swimming pool.
 */

import { seeded } from './random.js';
import { flatMaterial, mergeParts, place } from './terrain.js';

AFRAME.registerComponent('pond', {
  schema: {
    radius: { type: 'number', default: 9 },
    /** Wider than it is deep, so it lies across the view. */
    stretch: { type: 'number', default: 1.6 },
    water: { type: 'color', default: '#3d89a8' },
    deep: { type: 'color', default: '#2a6a8a' },
    bank: { type: 'color', default: '#8a7352' },
    pads: { type: 'number', default: 16 },
    lotus: { type: 'number', default: 5 },
    seed: { type: 'number', default: 31 },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const { radius, stretch, water, deep, bank, pads, lotus, seed } = this.data;
    const random = seeded(seed);
    const flatDisc = (r, n = 40) => new THREE.CircleGeometry(r, n).rotateX(-Math.PI / 2);

    // ---- everything opaque, as one mesh: bank, pebbles, pads, flowers ----
    const solid = [];

    solid.push({ geometry: flatDisc(radius * 1.13), matrix: place(0, 0.025, 0, { sx: stretch }), color: bank });
    solid.push({ geometry: flatDisc(radius * 1.05), matrix: place(0, 0.035, 0, { sx: stretch }), color: '#6e5c42' });

    // Pebbles on the bank: the irregular edge that a perfect ellipse lacks.
    for (let i = 0; i < 46; i += 1) {
      const a = random() * Math.PI * 2;
      const r = radius * (1.04 + random() * 0.12);
      solid.push({
        geometry: new THREE.IcosahedronGeometry(0.12 + random() * 0.22, 0),
        matrix: place(Math.cos(a) * r * stretch, 0.05, Math.sin(a) * r, { sy: 0.55, ry: random() * 3 }),
        color: random() > 0.5 ? '#9a9387' : '#7d766b',
      });
    }

    const inPond = () => {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * radius * 0.82;
      return [Math.cos(a) * r * stretch, Math.sin(a) * r];
    };

    // Lily pads — a disc with a wedge missing, lying on the surface.
    for (let i = 0; i < pads; i += 1) {
      const [x, z] = inPond();
      const size = 0.32 + random() * 0.3;
      solid.push({
        geometry: new THREE.CircleGeometry(size, 10, 0, Math.PI * 1.8).rotateX(-Math.PI / 2),
        matrix: place(x, 0.085, z, { ry: random() * Math.PI * 2 }),
        color: random() > 0.5 ? '#4f8f45' : '#63a352',
      });
    }

    // Lotus: a ring of petals opening upward, on its own pad. India's national
    // flower, and conveniently made of cones.
    for (let i = 0; i < lotus; i += 1) {
      const [x, z] = inPond();
      solid.push({
        geometry: new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2),
        matrix: place(x, 0.085, z), color: '#4f8f45',
      });

      for (const [count, tilt, size, colour] of [[8, 1.05, 0.3, '#f4a6c0'], [6, 0.55, 0.24, '#f9c4d6']]) {
        for (let k = 0; k < count; k += 1) {
          const a = (k / count) * Math.PI * 2;
          solid.push({
            geometry: new THREE.ConeGeometry(size * 0.34, size, 4),
            matrix: new THREE.Matrix4().compose(
              new THREE.Vector3(x + Math.cos(a) * size * 0.42 * tilt, 0.11 + size * 0.36, z + Math.sin(a) * size * 0.42 * tilt),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt)),
              new THREE.Vector3(1, 1, 0.45)
            ),
            color: colour,
          });
        }
      }

      solid.push({ geometry: new THREE.IcosahedronGeometry(0.07, 0), matrix: place(x, 0.2, z), color: '#f2c14e' });
    }

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(solid), flatMaterial()));

    // ---- the water itself: translucent, so it is its own mesh ----
    const surface = new THREE.Mesh(
      mergeParts([
        { geometry: flatDisc(radius), matrix: place(0, 0.06, 0, { sx: stretch }), color: water },
        { geometry: flatDisc(radius * 0.62), matrix: place(0, 0.065, 0, { sx: stretch }), color: deep },
      ]),
      new THREE.MeshStandardMaterial({
        vertexColors: true, transparent: true, opacity: 0.9,
        roughness: 0.12, metalness: 0.25, side: THREE.DoubleSide,
      })
    );
    this.el.getObject3D('surface')?.geometry.dispose();
    this.el.setObject3D('surface', surface);

    // ---- ripples: rings that swell and fade. The only thing that moves. ----
    this.el.innerHTML = '';
    for (let i = 0; i < 4; i += 1) {
      const [x, z] = inPond();
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', 0.42);
      ring.setAttribute('radius-outer', 0.5);
      ring.setAttribute('segments-theta', 24);
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('position', `${x} 0.075 ${z}`);
      ring.setAttribute('material', { color: '#d7eef5', shader: 'flat', transparent: true, opacity: 0.5 });
      // Slow. A ripple you can count is water; a ripple that flickers is a bug.
      ring.setAttribute('animation__grow', {
        property: 'scale', from: '0.3 0.3 0.3', to: '3.2 3.2 3.2',
        loop: true, dur: 5200, delay: i * 1300, easing: 'easeOutSine',
      });
      ring.setAttribute('animation__fade', {
        property: 'material.opacity', from: 0.5, to: 0,
        loop: true, dur: 5200, delay: i * 1300, easing: 'easeInSine',
      });
      this.el.appendChild(ring);
    }
  },

  remove() {
    for (const name of ['mesh', 'surface']) {
      this.el.getObject3D(name)?.geometry.dispose();
      this.el.removeObject3D(name);
    }
  },
});

/**
 * A tub of water on a table or the ground — the sink-and-float lesson.
 *
 * Separate from `pond` because the scale is different in kind: this is a thing
 * a child leans over, so it needs a rim they can see the thickness of.
 */
AFRAME.registerComponent('tub', {
  schema: {
    radius: { type: 'number', default: 0.34 },
    height: { type: 'number', default: 0.26 },
    wall: { type: 'color', default: '#4a6f88' },
    water: { type: 'color', default: '#5fa3bd' },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const { radius, height, wall, water } = this.data;

    const shell = mergeParts([
      { geometry: new THREE.CylinderGeometry(radius, radius * 0.9, height, 18, 1, true), matrix: place(0, height / 2, 0), color: wall },
      { geometry: new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.02, 18), matrix: place(0, 0.01, 0), color: wall },
      { geometry: new THREE.TorusGeometry(radius, 0.018, 5, 18), matrix: place(0, height, 0, { rx: Math.PI / 2 }), color: '#35556c' },
    ]);
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(shell, flatMaterial()));

    const top = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.97, 18).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: water, transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.2 })
    );
    top.position.y = height * 0.8;
    this.el.getObject3D('water')?.geometry.dispose();
    this.el.setObject3D('water', top);
  },

  remove() {
    for (const name of ['mesh', 'water']) {
      this.el.getObject3D(name)?.geometry.dispose();
      this.el.removeObject3D(name);
    }
  },
});

/** Reeds at the water's edge — thin blades, leaning, in a clump. One mesh. */
AFRAME.registerComponent('reeds', {
  schema: {
    count: { type: 'number', default: 18 },
    height: { type: 'number', default: 1.2 },
    spread: { type: 'number', default: 1.3 },
    color: { type: 'color', default: '#6f8f46' },
    seed: { type: 'number', default: 41 },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const { count, height, spread, color, seed } = this.data;
    const random = seeded(seed);
    const parts = [];

    for (let i = 0; i < count; i += 1) {
      const h = height * (0.55 + random() * 0.75);
      const x = (random() - 0.5) * spread;
      const z = (random() - 0.5) * spread;

      parts.push({
        geometry: new THREE.CylinderGeometry(0.008, 0.024, h, 4),
        matrix: place(x, h / 2, z, { rx: (random() - 0.5) * 0.3, rz: (random() - 0.5) * 0.4 }),
        color: random() > 0.4 ? color : '#86a552',
      });

      // Every third one carries a seed head — a bulrush, not just a stick.
      if (i % 3) continue;
      parts.push({
        geometry: new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5),
        matrix: place(x, h * 0.92, z),
        color: '#6b4a2c',
      });
    }

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});
