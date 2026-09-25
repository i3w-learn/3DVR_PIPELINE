/**
 * A volcano erupting, far off.
 *
 * The mountain itself is a downloaded model. What cannot be downloaded is the
 * eruption, because an eruption is motion: a column of smoke that keeps
 * rising, a crater that glows and dims, lumps of lava thrown up and falling
 * back. So those are built here and stood on top of the model's crater.
 *
 * Everything is sized for distance. The volcano sits eighty to a hundred
 * metres from the child, so the puffs are the size of houses and the plume
 * climbs sixty metres, or it would read as a bonfire on a hill.
 *
 * Like the campfire, the crater's light casts no shadow. A shadow pass for a
 * light a hundred metres away would cost more than every dinosaur.
 */

import { seeded } from './random.js';

/** A soft lump of smoke: a low-detail sphere, so a plume of forty is cheap. */
const PUFF = new THREE.IcosahedronGeometry(1, 1);


/**
 * Smoke that is soft at the edges.
 *
 * A grey sphere is a ball. The same sphere fading out where its surface turns
 * away from the eye is a cloud: the silhouette dissolves and neighbouring
 * puffs merge. One small shader, lit by a single sun direction so the column
 * is brighter on the sunny side, with the per-puff colour the plume sets.
 */
export function smokeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      sun: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      opacity: { value: 0.7 },
      time: { value: 0 },
      // 1 = shaded like a solid cloud, 0 = flat, like mist lit from everywhere.
      shade: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vTint;
      varying vec3 vWorld;
      void main() {
        vec3 tint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          tint = instanceColor;
        #endif
        vTint = tint;
        mat4 model = modelMatrix;
        #ifdef USE_INSTANCING
          model = modelMatrix * instanceMatrix;
        #endif
        vec4 world = model * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(model) * normal);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sun;
      uniform float opacity;
      uniform float shade;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vTint;
      varying vec3 vWorld;

      // Cheap value noise, so a puff's edge is torn rather than round and no
      // two puffs tear the same way: the pattern is taken from where the puff
      // is in the world, and it creeps with time.
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z);
      }

      void main() {
        float lit = mix(1.0, 0.7 + 0.4 * max(0.0, dot(normalize(vNormal), sun)), shade);
        float edge = max(0.0, dot(normalize(vNormal), normalize(vView)));
        vec3 p = vWorld * 0.12 + vec3(0.0, -time * 0.08, 0.0);
        float n = noise(p) * 0.6 + noise(p * 2.7) * 0.3 + noise(p * 6.1) * 0.1;
        // The noise both tears the silhouette and mottles the body.
        float torn = smoothstep(0.08, 0.85, edge + (n - 0.5) * 0.9);
        float body = 0.8 + 0.4 * (n - 0.5);
        float a = torn * opacity * clamp(body, 0.4, 1.0);
        gl_FragColor = vec4(vTint * lit * (0.85 + 0.3 * n), a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

AFRAME.registerComponent('eruption', {
  schema: {
    /** How high the plume climbs above the crater, in metres. */
    height: { type: 'number', default: 60 },
    /** Puffs alive at once. More is denser, not taller. */
    puffs: { type: 'number', default: 40 },
    /** Which way the wind leans the column, in metres of drift at the top. */
    wind: { type: 'vec2', default: { x: 18, y: 4 } },
    smoke: { type: 'color', default: '#6a625c' },
    ash: { type: 'color', default: '#b3aca5' },
    glow: { type: 'color', default: '#ff5a1a' },
    /** Lumps of lava in the air at once. */
    bombs: { type: 'number', default: 7 },
    /** Radius of the crater mouth, in metres. Sets how wide the plume starts. */
    mouth: { type: 'number', default: 7 },
  },

  init() {
    this.time = Math.random() * 60;
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.clear();
    const { puffs, smoke, ash, glow, bombs, mouth } = this.data;
    const group = new THREE.Group();

    // The plume. Each puff is born at the mouth, rises, swells, pales from
    // smoke to ash, and thins out before it is born again. One instanced
    // mesh for all of them: forty puffs, one draw call.
    this.smokeColor = new THREE.Color(smoke);
    this.ashColor = new THREE.Color(ash);
    this.plume = new THREE.InstancedMesh(PUFF, smokeMaterial(), puffs);
    this.plume.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs = [];
    for (let i = 0; i < puffs; i += 1) {
      this.puffs.push({
        life: i / puffs, // staggered, so the column is full from the first frame
        rate: 0.04 + Math.random() * 0.03,
        spin: Math.random() * Math.PI * 2,
        wobble: Math.random() * Math.PI * 2,
        size: 0.8 + Math.random() * 0.5,
      });
      this.plume.setColorAt(i, this.smokeColor);
    }
    group.add(this.plume);

    // The crater: a glowing floor of lava and the light it throws on the smoke.
    const lava = new THREE.Mesh(
      new THREE.CircleGeometry(mouth * 0.9, 24),
      new THREE.MeshBasicMaterial({ color: glow })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = 0.3;
    group.add(lava);
    this.lava = lava;

    this.light = new THREE.PointLight(new THREE.Color(glow), 40, mouth * 5, 2);
    this.light.position.set(0, mouth * 0.6, 0);
    group.add(this.light);

    // Lava bombs: thrown up in arcs, falling back on the slopes. Instanced too.
    this.rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: '#e0521a' }),
      bombs
    );
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bombs = [];
    for (let i = 0; i < bombs; i += 1) {
      const u = this.throwBomb({});
      u.t = Math.random() * u.flight;
      this.bombs.push(u);
    }
    group.add(this.rocks);

    this.dummy = new THREE.Object3D();
    this.tint = new THREE.Color();
    this.el.setObject3D('eruption', group);
  },

  /** A fresh arc for a bomb: a direction, a speed, and how long it flies. */
  throwBomb(u) {
    const { mouth } = this.data;
    const angle = Math.random() * Math.PI * 2;
    const spread = 4 + Math.random() * 10;
    u.vx = Math.cos(angle) * spread;
    u.vz = Math.sin(angle) * spread;
    u.vy = 28 + Math.random() * 16;
    u.size = mouth * (0.05 + Math.random() * 0.05);
    // Falls to the slope, which is below the crater; a little past the apex.
    u.flight = (2 * u.vy) / 20 * (1.15 + Math.random() * 0.4);
    u.t = 0;
    return u;
  },

  tick(_, delta) {
    if (!this.puffs) return;
    const dt = delta / 1000;
    this.time += dt;
    const t = this.time;
    const { height, wind, mouth } = this.data;

    const dummy = this.dummy;
    this.puffs.forEach((u, i) => {
      u.life += dt * u.rate;
      if (u.life > 1) u.life -= 1;
      const l = u.life;
      // Fast out of the mouth, slowing as it spreads; leaning with the wind.
      const rise = 1 - (1 - l) * (1 - l);
      const y = rise * height;
      const spread = mouth * 0.6 + l * l * height * 0.7;
      const wob = Math.sin(t * 0.6 + u.wobble) * mouth * 0.15;
      dummy.position.set(
        Math.cos(u.spin) * spread * 0.5 + wind.x * l * l + wob,
        y,
        Math.sin(u.spin) * spread * 0.5 + wind.y * l * l
      );
      // No per-instance opacity, so a puff fades by shrinking away at the end
      // of its life and growing in at the start.
      const fade = l < 0.08 ? l / 0.08 : 1 - Math.max(0, (l - 0.6) / 0.4);
      const s = (mouth * 0.42 + l * height * 0.24) * u.size * (0.25 + 0.75 * fade);
      dummy.scale.set(s, s * 0.85, s);
      dummy.updateMatrix();
      this.plume.setMatrixAt(i, dummy.matrix);
      this.plume.setColorAt(i, this.tint.copy(this.smokeColor).lerp(this.ashColor, Math.min(1, l * 1.4)));
    });
    this.plume.instanceMatrix.needsUpdate = true;
    if (this.plume.instanceColor) this.plume.instanceColor.needsUpdate = true;
    this.plume.material.uniforms.time.value = t;

    // The crater breathes: brighter as a pulse comes up, dimmer between.
    const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.7)) + 0.12 * Math.sin(t * 9.3);
    this.light.intensity = 25 + 45 * pulse;
    this.lava.material.color.setRGB(1, 0.25 + 0.3 * pulse, 0.05 + 0.1 * pulse);

    this.bombs.forEach((u, i) => {
      u.t += dt;
      if (u.t > u.flight) this.throwBomb(u);
      const x = u.vx * u.t;
      const y = u.vy * u.t - 10 * u.t * u.t;
      const z = u.vz * u.t;
      dummy.position.set(x, Math.max(y, -mouth * 2), z);
      dummy.scale.setScalar(u.size);
      dummy.updateMatrix();
      this.rocks.setMatrixAt(i, dummy.matrix);
    });
    this.rocks.instanceMatrix.needsUpdate = true;
  },

  clear() {
    const group = this.el.getObject3D('eruption');
    if (!group) return;
    group.traverse((o) => {
      if (o.geometry && o.geometry !== PUFF) o.geometry.dispose();
      o.material?.dispose?.();
    });
    this.el.removeObject3D('eruption');
    this.puffs = null;
    this.bombs = null;
    this.plume = null;
    this.rocks = null;
    this.light = null;
    this.lava = null;
  },

  remove() {
    this.clear();
  },
});

/**
 * Ground mist round the horizon.
 *
 * Every far thing in a land — a volcano, a mountain, the tree ring — stands
 * on a flat plane, and where its base meets that plane there is a line. Fog
 * alone fades the line; it does not hide it. A low band of soft mist at the
 * distance does, and it is what the eye expects over open ground in the
 * morning anyway. Same soft-edged puffs as the eruption, near white, slow.
 */
AFRAME.registerComponent('mist', {
  schema: {
    count: { type: 'number', default: 80 },
    inner: { type: 'number', default: 50 },
    outer: { type: 'number', default: 140 },
    /** Puff radius range, in metres. */
    size: { type: 'number', default: 16 },
    /** How high the band sits and how tall it is. */
    height: { type: 'number', default: 3 },
    color: { type: 'color', default: '#d4dddb' },
    opacity: { type: 'number', default: 0.2 },
    seed: { type: 'number', default: 3 },
  },

  init() {
    const { count, inner, outer, size, height, color, opacity, seed } = this.data;
    const random = seeded(seed);
    const material = smokeMaterial();
    material.uniforms.opacity.value = opacity;
    material.uniforms.shade.value = 0.15;
    this.cloud = new THREE.InstancedMesh(PUFF, material, count);
    this.cloud.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs = [];
    const tint = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const r = inner + random() * (outer - inner);
      this.puffs.push({
        x: Math.sin(angle) * r, z: -Math.cos(angle) * r,
        y: height * (0.2 + random() * 1.2),
        s: size * (0.6 + random() * 0.9),
        flat: 0.22 + random() * 0.33,
        drift: (random() - 0.5) * 0.6,
        wobble: random() * Math.PI * 2,
      });
      this.cloud.setColorAt(i, tint);
    }
    this.cloud.renderOrder = 2;
    this.dummy = new THREE.Object3D();
    this.time = random() * 100;
    this.el.setObject3D('mist', this.cloud);
  },

  tick(_, delta) {
    if (!this.cloud) return;
    this.time += delta / 1000;
    const t = this.time;
    this.puffs.forEach((p, i) => {
      this.dummy.position.set(p.x + Math.sin(t * 0.05 + p.wobble) * 4 + p.drift * t * 0.2, p.y + Math.sin(t * 0.09 + p.wobble) * 0.5, p.z);
      // Wide and low: a bank of mist, not a ball of it.
      this.dummy.scale.set(p.s * 1.7, p.s * p.flat, p.s * 1.7);
      this.dummy.updateMatrix();
      this.cloud.setMatrixAt(i, this.dummy.matrix);
    });
    this.cloud.instanceMatrix.needsUpdate = true;
    this.cloud.material.uniforms.time.value = t * 0.3;
  },

  remove() {
    if (!this.cloud) return;
    this.cloud.material.dispose();
    this.el.removeObject3D('mist');
    this.cloud = null;
  },
});
