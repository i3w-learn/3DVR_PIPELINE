/**
 * Under the sea.
 *
 * A fish on a table is a toy. A fish at eye level, with blue all round and the
 * far ones fading into it, is where fish live — and that fading is the whole
 * effect. Water is fog: the land's fog colour does the work, and everything
 * here exists to give the fog something to swallow.
 */

import { seeded } from './random.js';
import { flake } from './snow.js';
import { direct, mergeParts, place, rod } from './terrain.js';

/**
 * The water itself, and the sand under it.
 *
 * The dome is drawn without fog and without depth — it is the background. It
 * is a gradient rather than one colour because light comes from above: bright
 * turquoise overhead, deep blue at the horizon line where the seabed meets it.
 */
AFRAME.registerComponent('seawater', {
  schema: {
    radius: { type: 'number', default: 140 },
    deep: { type: 'color', default: '#0c4a70' },
    shallow: { type: 'color', default: '#7fd6dc' },
    sand: { type: 'color', default: '#d9c79a' },
    seed: { type: 'number', default: 5 },
  },

  init() {
    const { radius, deep, shallow, sand, seed } = this.data;

    const dome = new THREE.SphereGeometry(radius, 24, 16);
    const p = dome.getAttribute('position');
    const colour = new Float32Array(p.count * 3);
    const low = new THREE.Color(deep), high = new THREE.Color(shallow), c = new THREE.Color();
    for (let i = 0; i < p.count; i += 1) {
      const t = THREE.MathUtils.smoothstep(p.getY(i) / radius, -0.05, 0.85);
      c.copy(low).lerp(high, t);
      colour.set([c.r, c.g, c.b], i * 3);
    }
    dome.setAttribute('color', new THREE.BufferAttribute(colour, 3));

    const water = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
    }));
    water.renderOrder = -10;
    water.frustumCulled = false;
    this.el.setObject3D('water', water);

    // Sand, rippled. Rings of vertices pushed up and down a few centimetres so
    // the floor catches the light unevenly — a flat disc reads as a stage.
    const random = seeded(seed);
    const bed = new THREE.CircleGeometry(radius * 0.7, 64).toNonIndexed();
    bed.rotateX(-Math.PI / 2);
    const b = bed.getAttribute('position');
    for (let i = 0; i < b.count; i += 1) {
      const x = b.getX(i), z = b.getZ(i);
      const near = Math.min(1, Math.hypot(x, z) / 6);
      b.setY(i, (Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.12 + Math.sin(x * 0.23 + z * 0.31) * 0.35) * near);
    }
    void random;
    this.el.setObject3D('bed', new THREE.Mesh(
      mergeParts([{ geometry: bed, color: sand, flat: true }]),
      new THREE.MeshLambertMaterial({ vertexColors: true })
    ));
  },

  remove() {
    for (const name of ['water', 'bed']) {
      this.el.getObject3D(name)?.geometry.dispose();
      this.el.removeObject3D(name);
    }
  },
});

/**
 * A reef: rocks, branching coral and weed, scattered on a ring.
 *
 * One component, one draw call. `inner` keeps the space round the child
 * clear — the fish are the lesson, and they swim in that space.
 */
AFRAME.registerComponent('reef', {
  schema: {
    count: { type: 'number', default: 26 },
    inner: { type: 'number', default: 5 },
    outer: { type: 'number', default: 22 },
    seed: { type: 'number', default: 8 },
  },

  ...direct,

  parts() {
    const { count, inner, outer, seed } = this.data;
    const random = seeded(seed);
    const parts = [];
    const CORAL = ['#e8697a', '#f0954a', '#c86bb0', '#f2c14e', '#e8546b'];
    const WEED = ['#2f8a54', '#3fa066', '#257a4e'];

    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const r = inner + random() * (outer - inner);
      const x = Math.sin(angle) * r, z = -Math.cos(angle) * r;
      const kind = i % 3;

      if (kind === 0) {
        const s = 0.5 + random() * 1.1;
        parts.push({
          geometry: new THREE.IcosahedronGeometry(s, 1), lumpy: 0.35,
          matrix: place(x, s * 0.3, z, { sy: 0.62, ry: random() * 6 }), color: '#6d7b86', shade: [0.62, 1.05],
        });
      } else if (kind === 1) {
        // Coral: a stubby trunk and a fan of arms, each ending in a knob.
        const color = CORAL[Math.floor(random() * CORAL.length)];
        const h = 0.5 + random() * 0.9;
        parts.push({ ...rod([x, 0, z], [x, h * 0.45, z], h * 0.09, color, 6), shade: [0.7, 1] });
        const arms = 4 + Math.floor(random() * 3);
        for (let a = 0; a < arms; a += 1) {
          const t = (a / arms) * Math.PI * 2 + random();
          const tip = [x + Math.sin(t) * h * 0.45, h * (0.8 + random() * 0.35), z + Math.cos(t) * h * 0.45];
          parts.push({ ...rod([x, h * 0.4, z], tip, h * 0.055, color, 5), shade: [0.75, 1.05] });
          parts.push({ geometry: new THREE.IcosahedronGeometry(h * 0.085, 1), matrix: place(...tip), color, shade: [0.85, 1.1] });
        }
      } else {
        // Weed: a few tall blades, each bent a little in three segments.
        const color = WEED[Math.floor(random() * WEED.length)];
        const blades = 4 + Math.floor(random() * 4);
        for (let k = 0; k < blades; k += 1) {
          const bx = x + (random() - 0.5) * 0.7, bz = z + (random() - 0.5) * 0.7;
          const h = 1.2 + random() * 1.8, lean = (random() - 0.5) * 0.5;
          let from = [bx, 0, bz];
          for (let sgm = 1; sgm <= 3; sgm += 1) {
            const to = [bx + Math.sin(sgm * 1.7 + k) * 0.12 + lean * sgm * 0.2, (h * sgm) / 3, bz + Math.cos(sgm * 1.3 + k) * 0.1];
            parts.push({ ...rod(from, to, 0.05 - sgm * 0.011, color, 4), shade: [0.7, 1.1] });
            from = to;
          }
        }
      }
    }

    return parts;
  },
});

/** Bubbles, rising. Snowfall turned upside down, in columns rather than a sheet. */
AFRAME.registerComponent('bubbles', {
  schema: {
    count: { type: 'number', default: 90 },
    radius: { type: 'number', default: 12 },
    ceiling: { type: 'number', default: 9 },
    speed: { type: 'number', default: 0.5 },
    size: { type: 'number', default: 0.09 },
  },

  init() {
    const { count, radius, ceiling, size } = this.data;
    const random = seeded(31);

    this.positions = new Float32Array(count * 3);
    this.phase = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      // Keep them out of the child's face: nothing rises inside two metres.
      const angle = random() * Math.PI * 2, r = 2.2 + random() * (radius - 2.2);
      this.positions[i * 3] = Math.sin(angle) * r;
      this.positions[i * 3 + 1] = random() * ceiling;
      this.positions[i * 3 + 2] = -Math.cos(angle) * r;
      this.phase[i] = random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: '#e8fbff', size, sizeAttenuation: true, map: flake(),
      transparent: true, opacity: 0.55, depthWrite: false, alphaTest: 0.04,
    }));
    this.points.frustumCulled = false;
    this.el.setObject3D('bubbles', this.points);
  },

  tick(time, delta) {
    if (!this.points) return;

    const dt = Math.min(delta, 50) / 1000;
    const { count, ceiling, speed } = this.data;
    const p = this.positions;

    for (let i = 0; i < count; i += 1) {
      p[i * 3 + 1] += speed * dt * (0.7 + (i % 4) * 0.15);
      p[i * 3] += Math.sin(time / 900 + this.phase[i]) * dt * 0.08;
      if (p[i * 3 + 1] > ceiling) p[i * 3 + 1] = 0;
    }

    this.points.geometry.getAttribute('position').needsUpdate = true;
  },

  remove() {
    this.points?.geometry.dispose();
    this.points?.material.dispose();
    this.el.removeObject3D('bubbles');
  },
});
