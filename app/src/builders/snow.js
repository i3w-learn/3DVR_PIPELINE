/**
 * The snow field: pines under snow, a ridge tent, a campfire, drifts, and the
 * snow itself coming down.
 *
 * One builder file per land, so a change to the snow field cannot disturb the
 * sky and nobody has to read four unrelated components to find one.
 *
 * Nothing here is downloaded. A stylised pine is a stack of cones and a child
 * recognises it by its silhouette; a tent is a prism with a door cut in it.
 * Only the shapes that carry recognition have to be modelled, and none of
 * these do.
 *
 * ## What the first version got wrong
 *
 * The tent was two planes whose rotations were each off by a sign, so they
 * opened upward like a bird in flight instead of meeting at a ridge. It passed
 * every check the validator has, because the validator reads JSON and the bug
 * was in trigonometry. It is now a prism built from its own corner points —
 * there is no rotation left to get backwards.
 */

import { seeded } from './random.js';
import { direct, flatMaterial, groundShadows, mergeParts, pineParts, place, rod } from './terrain.js';

/** A single conifer close to the viewer. The forest behind it is `grove`. */
AFRAME.registerComponent('pine', {
  schema: {
    height: { type: 'number', default: 4.2 },
    needle: { type: 'color', default: '#2f5d43' },
    trunk: { type: 'color', default: '#5a4230' },
    capped: { type: 'boolean', default: false },
    snow: { type: 'color', default: '#eef4f8' },
    seed: { type: 'number', default: 3 },
  },

  ...direct,

  parts() {
    const { height, needle, trunk, capped, snow, seed } = this.data;
    this.spots.push({ x: 0, z: 0, r: height * 0.3 });
    return pineParts(0, 0, height, needle, trunk, capped, snow, seeded(seed));
  },
});

/**
 * A ridge tent, as a prism built from its corners.
 *
 * Open at the front with the two door flaps tied back, because a closed tent
 * is a wedge of cheese — the dark opening is what says "you sleep in here".
 */
AFRAME.registerComponent('tent', {
  schema: {
    width: { type: 'number', default: 2.8 },
    depth: { type: 'number', default: 3.4 },
    height: { type: 'number', default: 1.9 },
    canvas: { type: 'color', default: '#c8622f' },
    inside: { type: 'color', default: '#5a2c16' },
    pole: { type: 'color', default: '#6a5238' },
  },

  ...direct,

  parts() {
    const { width: w, depth: d, height: h, canvas, inside, pole } = this.data;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: Math.max(w, d) * 0.62 });

    // Corners. Front is +Z, facing the child.
    const L = -w / 2, R = w / 2, F = d / 2, B = -d / 2;

    const face = (points, color) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points.flat()), 3));
      parts.push({ geometry, color });
    };

    // The two sloping walls, each two triangles from eave to ridge.
    face([[L, 0, F], [L, 0, B], [0, h, B], [L, 0, F], [0, h, B], [0, h, F]], canvas);
    face([[R, 0, B], [R, 0, F], [0, h, F], [R, 0, B], [0, h, F], [0, h, B]], canvas);

    // The back, closed.
    face([[L, 0, B], [R, 0, B], [0, h, B]], canvas);

    // The front: two flaps pulled aside, and the dark of the inside between.
    const gap = w * 0.22;
    face([[L, 0, F], [-gap, 0, F], [0, h, F]], canvas);
    face([[gap, 0, F], [R, 0, F], [0, h, F]], canvas);
    face([[-gap, 0, F - 0.02], [gap, 0, F - 0.02], [0, h * 0.82, F - 0.02]], inside);

    // A groundsheet, so the floor inside is not snow.
    face([[L, 0.01, F], [R, 0.01, F], [R, 0.01, B], [L, 0.01, F], [R, 0.01, B], [L, 0.01, B]], inside);

    // Ridge pole and the two uprights that carry it.
    parts.push({
      geometry: new THREE.CylinderGeometry(0.035, 0.035, d + 0.4, 6),
      matrix: place(0, h + 0.02, 0, { rx: Math.PI / 2 }),
      color: pole,
    });
    for (const z of [F + 0.12, B - 0.12]) {
      parts.push({
        geometry: new THREE.CylinderGeometry(0.035, 0.04, h + 0.1, 6),
        matrix: place(0, h / 2, z),
        color: pole,
      });
    }

    // Guy ropes, from halfway up each wall out to a peg. What makes a tent
    // look pitched rather than dropped.
    for (const sx of [-1, 1]) {
      for (const z of [F - 0.35, B + 0.35]) {
        const peg = [sx * (w / 2 + 0.75), 0, z];
        parts.push(rod([sx * w * 0.25, h * 0.5, z], peg, 0.011, '#cfc4ae', 4));
        parts.push(rod(peg, [peg[0], 0.16, peg[2]], 0.022, pole, 4));
      }
    }

    return parts;
  },
});

/**
 * A campfire. Logs leaning into a cone, stones round them, a flame above.
 *
 * The flame is emissive rather than lit: a real point light here would cost a
 * shadow pass for something the size of a hand.
 */
AFRAME.registerComponent('campfire', {
  schema: {
    radius: { type: 'number', default: 0.55 },
    log: { type: 'color', default: '#5d4530' },
    stone: { type: 'color', default: '#8d8579' },
    flame: { type: 'color', default: '#f2913d' },
    lit: { type: 'boolean', default: true },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const { radius, log, stone, flame, lit } = this.data;
    const parts = [];

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      parts.push({
        geometry: new THREE.CylinderGeometry(0.05, 0.065, radius * 2, 6),
        matrix: place(Math.cos(a) * radius * 0.4, radius * 0.46, Math.sin(a) * radius * 0.4, {
          rx: Math.sin(a) * 0.62, rz: -Math.cos(a) * 0.62,
        }),
        color: log,
      });
    }

    // Stones round the edge — what says "this fire is contained" to a child.
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      parts.push({
        geometry: new THREE.IcosahedronGeometry(0.11, 0),
        matrix: place(Math.cos(a) * radius * 1.05, 0.05, Math.sin(a) * radius * 1.05, { sy: 0.7 }),
        color: stone,
      });
    }

    // Melted ground: a dark ring where the snow has gone.
    parts.push({
      geometry: new THREE.CircleGeometry(radius * 1.5, 14),
      matrix: place(0, 0.012, 0, { rx: -Math.PI / 2 }),
      color: '#6b6258',
    });

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));

    this.el.innerHTML = '';
    if (!lit) return;

    for (let i = 0; i < 3; i += 1) {
      const el = document.createElement('a-cone');
      el.setAttribute('radius-bottom', 0.22 - i * 0.06);
      el.setAttribute('radius-top', 0);
      el.setAttribute('height', 0.62 - i * 0.14);
      el.setAttribute('segments-radial', 6);
      el.setAttribute('position', `0 ${0.5 + i * 0.1} 0`);
      el.setAttribute('material', {
        color: i ? '#f6c445' : flame,
        emissive: i ? '#f6c445' : flame,
        emissiveIntensity: 0.9,
        opacity: 0.88,
        transparent: true,
        flatShading: true,
      });
      // A fire that does not move is a sculpture of a fire.
      el.setAttribute('animation', {
        property: 'scale',
        to: `${0.9 - i * 0.05} ${1.22 + i * 0.08} ${0.9 - i * 0.05}`,
        dir: 'alternate',
        loop: true,
        dur: 430 + i * 140,
        easing: 'easeInOutSine',
      });
      this.el.appendChild(el);
    }
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});

/**
 * Snow drifts: low white mounds that break up the ground.
 *
 * A flat white plane to the horizon is a sheet of paper. Drifts give the eye
 * something to measure distance against, and they are what makes snow look
 * deep rather than painted on.
 */
AFRAME.registerComponent('drifts', {
  schema: {
    count: { type: 'number', default: 26 },
    inner: { type: 'number', default: 3.5 },
    outer: { type: 'number', default: 34 },
    color: { type: 'color', default: '#f3f7fa' },
    shade: { type: 'color', default: '#dfe8ef' },
    seed: { type: 'number', default: 5 },
  },

  ...direct,

  parts() {
    const { count, inner, outer, color, shade, seed } = this.data;
    const random = seeded(seed);
    const parts = [];

    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const r = inner + random() * (outer - inner);
      const size = 1.2 + random() * 3.4;

      parts.push({
        geometry: new THREE.IcosahedronGeometry(size, 1),
        // Squashed nearly flat and sunk, so only the crown shows above ground.
        matrix: place(Math.cos(angle) * r, -size * 0.12, Math.sin(angle) * r, {
          ry: random() * Math.PI, sy: 0.2 + random() * 0.12, sx: 1 + random() * 0.8,
        }),
        color: random() > 0.5 ? color : shade,
        shade: [0.9, 1.03],
      });
    }

    return parts;
  },
});

/**
 * Falling snow — one `Points` object, one draw call, a few hundred flakes.
 *
 * The flakes fall in a box around the viewer and wrap to the top when they
 * reach the ground, so the same few hundred points snow forever.
 *
 * Slow on purpose. Fast-moving specks across the whole field of view are a
 * known trigger for discomfort in a headset; drifting ones are calming.
 */
AFRAME.registerComponent('snowfall', {
  schema: {
    count: { type: 'number', default: 420 },
    radius: { type: 'number', default: 16 },
    ceiling: { type: 'number', default: 11 },
    speed: { type: 'number', default: 0.55 },
    size: { type: 'number', default: 0.075 },
  },

  init() {
    const { count, radius, ceiling, size } = this.data;
    const random = seeded(19);

    this.positions = new Float32Array(count * 3);
    this.drift = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      this.positions[i * 3] = (random() - 0.5) * radius * 2;
      this.positions[i * 3 + 1] = random() * ceiling;
      this.positions[i * 3 + 2] = (random() - 0.5) * radius * 2;
      this.drift[i] = random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: '#ffffff', size, sizeAttenuation: true, map: flake(),
      transparent: true, opacity: 0.92, depthWrite: false, alphaTest: 0.05,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.el.setObject3D('snow', this.points);
  },

  tick(time, delta) {
    if (!this.points) return;

    const dt = Math.min(delta, 50) / 1000;
    const { count, ceiling, speed } = this.data;
    const p = this.positions;

    for (let i = 0; i < count; i += 1) {
      p[i * 3 + 1] -= speed * dt * (0.7 + (i % 5) * 0.12);
      p[i * 3] += Math.sin(time / 1700 + this.drift[i]) * dt * 0.16;

      if (p[i * 3 + 1] < 0) p[i * 3 + 1] = ceiling;
    }

    this.points.geometry.getAttribute('position').needsUpdate = true;
  },

  remove() {
    this.points?.geometry.dispose();
    this.points?.material.dispose();
    this.el.removeObject3D('snow');
  },
});

/**
 * A soft round dot, drawn once.
 *
 * Points without a texture are squares, and square snow reads as a rendering
 * fault rather than as weather. Drawn to a canvas rather than shipped as a
 * file: it is a radial gradient, and a gradient is not an asset.
 */
let dot = null;

export function flake() {
  if (dot) return dot;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;

  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);

  dot = new THREE.CanvasTexture(canvas);
  return dot;
}

/**
 * A snowman. Three balls, a carrot, coal, two sticks and a scarf.
 *
 * Here because it is the single most recognisable thing in a snow field to a
 * five-year-old, it is made entirely of primitives, and a camp with nobody in
 * it is a photograph of a camp.
 */
AFRAME.registerComponent('snowman', {
  schema: {
    height: { type: 'number', default: 1.5 },
    snow: { type: 'color', default: '#f6f9fb' },
    scarf: { type: 'color', default: '#c8402f' },
  },

  ...direct,

  parts() {
    const { height: h, snow, scarf } = this.data;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: h * 0.36 });
    const ball = (r, y) => parts.push({
      geometry: new THREE.IcosahedronGeometry(r, 2), matrix: place(0, y, 0), color: snow, shade: [0.8, 1.04],
    });

    const r1 = h * 0.27, r2 = h * 0.2, r3 = h * 0.145;
    const y1 = r1 * 0.9, y2 = y1 + r1 * 0.78 + r2 * 0.7, y3 = y2 + r2 * 0.75 + r3 * 0.72;
    ball(r1, y1); ball(r2, y2); ball(r3, y3);

    // Carrot, pointing at the child.
    parts.push({
      geometry: new THREE.ConeGeometry(r3 * 0.2, r3 * 1.1, 6),
      matrix: place(0, y3, r3 * 1.3, { rx: Math.PI / 2 }),
      color: '#e8812c',
    });

    const coal = (x, y, z, r = 0.028) => parts.push({
      geometry: new THREE.IcosahedronGeometry(h * r, 0), matrix: place(x, y, z), color: '#2a2a2e',
    });
    coal(-r3 * 0.36, y3 + r3 * 0.3, r3 * 0.88); coal(r3 * 0.36, y3 + r3 * 0.3, r3 * 0.88);
    for (const dy of [0.35, 0, -0.35]) coal(0, y2 + r2 * dy, r2 * 0.97 - Math.abs(dy) * r2 * 0.12);

    // Scarf: a ring where head meets body, and an end hanging down.
    parts.push({
      geometry: new THREE.TorusGeometry(r3 * 0.86, r3 * 0.2, 5, 12),
      matrix: place(0, y3 - r3 * 0.74, 0, { rx: Math.PI / 2 }),
      color: scarf,
    });
    parts.push({
      geometry: new THREE.BoxGeometry(r3 * 0.42, r3 * 1.3, r3 * 0.12),
      matrix: place(r3 * 0.5, y3 - r3 * 1.35, r2 * 0.86, { rz: -0.18 }),
      color: scarf,
    });

    // Stick arms, raised — a snowman with its arms down looks sad.
    for (const sx of [-1, 1]) {
      parts.push(rod([sx * r2 * 0.8, y2 + r2 * 0.1, 0], [sx * r2 * 2.5, y2 + r2 * 1.25, r2 * 0.2], h * 0.014, '#5d4530', 4));
      parts.push(rod([sx * r2 * 2.1, y2 + r2 * 0.95, r2 * 0.16], [sx * r2 * 2.6, y2 + r2 * 0.72, r2 * 0.3], h * 0.01, '#5d4530', 4));
    }

    return parts;
  },
});
