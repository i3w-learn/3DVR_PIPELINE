/**
 * The snow field: pines under snow, a ridge tent, a campfire, drifts, and the
 * snow itself coming down.
 *
 * One builder file per land, so a change to the snow field cannot disturb the
 * sky and nobody has to read four unrelated components to find one.
 *
 * Only the fire pit is downloaded. A stylised pine is a stack of cones and a child
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
 * A campfire: a real ring of stones and logs, and a fire built here.
 *
 * The stones and logs are a scanned model. A drawn log is a brown cylinder,
 * and every child has sat next to a real one. The fire is the one thing that
 * cannot be downloaded: a flame is motion, not a shape. So it is made here —
 * a few tongues that lick upward out of step with each other, embers that
 * rise and go out, and a warm light that wavers over the snow. The light
 * casts no shadow (that pass would cost more than the whole camp), but it is
 * what makes the tent and the snowman look warmed rather than pasted in.
 */
const FLAME_VERT = /* glsl */ `
  uniform float time;
  varying float vH;
  varying float vFlick;
  varying float vEdge;
  void main() {
    vH = uv.y;
    // Soft at the silhouette, so a tongue reads as glowing gas, not a shape.
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(n.z);
    // Sway that grows with height: the base is pinned, the tip wanders.
    float sway = vH * vH;
    vec3 p = position;
    p.x += sin(time * 6.0 + position.y * 9.0) * 0.06 * sway;
    p.z += cos(time * 5.2 + position.y * 7.0) * 0.05 * sway;
    p.y *= 1.0 + sin(time * 9.0 + position.x * 20.0) * 0.08 * sway;
    vFlick = 0.5 + 0.5 * sin(time * 13.0 + position.y * 15.0 + position.x * 30.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FLAME_FRAG = /* glsl */ `
  uniform vec3 core;
  uniform vec3 flame;
  varying float vH;
  varying float vFlick;
  varying float vEdge;
  void main() {
    // White-hot at the base, orange through the middle, dark red at the tip.
    vec3 c = mix(core, flame, smoothstep(0.0, 0.45, vH));
    c = mix(c, vec3(0.55, 0.08, 0.02), smoothstep(0.55, 1.0, vH));
    float a = pow(1.0 - vH, 1.3);
    a *= 0.7 + 0.3 * vFlick;
    a *= mix(0.3, 1.0, pow(vEdge, 0.7));
    gl_FragColor = vec4(c, a);
  }
`;

/** A tongue of flame: a teardrop turned on a lathe, fat low and pointed high. */
function tongueGeometry(radius, height) {
  const points = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const r = radius * Math.pow(Math.sin(Math.PI * Math.min(t, 0.999)), 0.75) * (1 - 0.55 * t);
    points.push(new THREE.Vector2(Math.max(r, 0.001), t * height));
  }
  const geometry = new THREE.LatheGeometry(points, 10);
  // uv.y is the height fraction the shader fades and colours by.
  const uv = geometry.getAttribute('uv');
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < uv.count; i += 1) uv.setY(i, pos.getY(i) / height);
  return geometry;
}

AFRAME.registerComponent('campfire', {
  schema: {
    radius: { type: 'number', default: 0.55 },
    flame: { type: 'color', default: '#ff7a1f' },
    core: { type: 'color', default: '#fff3b0' },
    lit: { type: 'boolean', default: true },
  },

  init() {
    this.time = Math.random() * 100;
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    const { radius, flame, core, lit } = this.data;
    this.clear();

    // The pit. The model is 0.94 m across; the lesson says how wide it is.
    const pit = document.createElement('a-entity');
    pit.setAttribute('gltf-model', 'assets/models/realbonfire.glb');
    const s = (radius * 2) / 0.94;
    pit.setAttribute('scale', `${s} ${s} ${s}`);
    this.el.appendChild(pit);

    // Melted ground: a dark ring where the snow has gone.
    const melt = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 1.3, 24),
      new THREE.MeshStandardMaterial({ color: '#6f675e', roughness: 1 })
    );
    melt.rotation.x = -Math.PI / 2;
    melt.position.y = 0.012;
    melt.receiveShadow = true;
    this.el.setObject3D('melt', melt);

    if (!lit) return;

    const fire = new THREE.Group();
    this.uniforms = {
      time: { value: 0 },
      core: { value: new THREE.Color(core) },
      flame: { value: new THREE.Color(flame) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Five tongues: one tall in the middle, four shorter leaning outward.
    this.tongues = [];
    const base = radius * 0.28;
    const specs = [
      [0, 0, 0.26, 0.95, 0],
      [0.09, 0.05, 0.19, 0.7, 0.28],
      [-0.08, 0.07, 0.17, 0.62, -0.3],
      [0.03, -0.1, 0.18, 0.66, 0.22],
      [-0.05, -0.06, 0.15, 0.55, -0.2],
    ];
    for (const [x, z, r, h, lean] of specs) {
      const mesh = new THREE.Mesh(tongueGeometry(r * radius * 2.1, h * radius * 1.9), material);
      mesh.position.set(x * radius * 2, 0.05, z * radius * 2);
      mesh.rotation.z = lean;
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.userData.phase = Math.random() * Math.PI * 2;
      mesh.userData.rate = 5 + Math.random() * 4;
      fire.add(mesh);
      this.tongues.push(mesh);
    }

    // Embers: small points of orange that drift up and go out.
    this.embers = [];
    const emberGeometry = new THREE.IcosahedronGeometry(0.012, 0);
    for (let i = 0; i < 14; i += 1) {
      const ember = new THREE.Mesh(
        emberGeometry,
        new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 1 })
      );
      ember.userData.life = Math.random();
      ember.userData.speed = 0.35 + Math.random() * 0.4;
      ember.userData.drift = (Math.random() - 0.5) * 0.4;
      ember.userData.spin = Math.random() * Math.PI * 2;
      fire.add(ember);
      this.embers.push(ember);
    }

    // The glow on everything nearby. No shadow map, deliberately.
    this.light = new THREE.PointLight(0xff9a3c, 2.2, radius * 22, 2);
    this.light.position.set(0, 0.5, 0);
    fire.add(this.light);

    this.el.setObject3D('fire', fire);
    this.base = base;
  },

  tick(_, delta) {
    if (!this.tongues) return;
    this.time += delta / 1000;
    const t = this.time;
    this.uniforms.time.value = t;

    for (const tongue of this.tongues) {
      const { phase, rate } = tongue.userData;
      const flick = 1 + 0.16 * Math.sin(t * rate + phase) + 0.08 * Math.sin(t * rate * 2.3 + phase);
      tongue.scale.set(1 + 0.06 * Math.sin(t * 3 + phase), flick, 1 + 0.06 * Math.cos(t * 3.4 + phase));
    }

    const { radius } = this.data;
    for (const ember of this.embers) {
      const u = ember.userData;
      u.life += (delta / 1000) * u.speed * 0.6;
      if (u.life > 1) {
        u.life = 0;
        u.drift = (Math.random() - 0.5) * 0.4;
        u.spin = Math.random() * Math.PI * 2;
      }
      const y = 0.15 + u.life * 1.3;
      const r = radius * 0.25 * (1 - u.life * 0.5);
      ember.position.set(
        Math.cos(u.spin + u.life * 4) * r + u.drift * u.life,
        y,
        Math.sin(u.spin + u.life * 4) * r
      );
      ember.material.opacity = Math.max(0, 1 - u.life) * (0.6 + 0.4 * Math.sin(t * 20 + u.spin));
    }

    // A fire's light breathes; steady light looks like a lamp.
    this.light.intensity = 2.1 + 0.45 * Math.sin(t * 9.1) + 0.25 * Math.sin(t * 23.7);
  },

  clear() {
    this.el.innerHTML = '';
    for (const key of ['melt', 'fire']) {
      const obj = this.el.getObject3D(key);
      if (!obj) continue;
      obj.traverse((o) => {
        o.geometry?.dispose();
        if (o.material && o.material !== this.tongues?.[0]?.material) o.material.dispose?.();
      });
      this.el.removeObject3D(key);
    }
    this.tongues = null;
    this.embers = null;
    this.light = null;
  },

  remove() {
    this.clear();
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
