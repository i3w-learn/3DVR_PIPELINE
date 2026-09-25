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

/** A soft lump of smoke: a low-detail sphere, so a plume of forty is cheap. */
const PUFF = new THREE.IcosahedronGeometry(1, 1);

AFRAME.registerComponent('eruption', {
  schema: {
    /** How high the plume climbs above the crater, in metres. */
    height: { type: 'number', default: 60 },
    /** Puffs alive at once. More is denser, not taller. */
    puffs: { type: 'number', default: 40 },
    /** Which way the wind leans the column, in metres of drift at the top. */
    wind: { type: 'vec2', default: { x: 18, y: 4 } },
    smoke: { type: 'color', default: '#3f3c3a' },
    ash: { type: 'color', default: '#8a8580' },
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
    this.plume = new THREE.InstancedMesh(
      PUFF,
      new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, depthWrite: false }),
      puffs
    );
    this.plume.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs = [];
    for (let i = 0; i < puffs; i += 1) {
      this.puffs.push({
        life: i / puffs, // staggered, so the column is full from the first frame
        rate: 0.05 + Math.random() * 0.04,
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
      new THREE.MeshBasicMaterial({ color: '#ffb347' }),
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
    u.size = mouth * (0.08 + Math.random() * 0.08);
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
      const spread = mouth * 0.5 + l * l * height * 0.5;
      const wob = Math.sin(t * 0.6 + u.wobble) * mouth * 0.15;
      dummy.position.set(
        Math.cos(u.spin) * spread * 0.5 + wind.x * l * l + wob,
        y,
        Math.sin(u.spin) * spread * 0.5 + wind.y * l * l
      );
      // No per-instance opacity, so a puff fades by shrinking away at the end
      // of its life and growing in at the start.
      const fade = l < 0.08 ? l / 0.08 : 1 - Math.max(0, (l - 0.6) / 0.4);
      const s = (mouth * 0.45 + l * height * 0.24) * u.size * (0.2 + 0.8 * fade);
      dummy.scale.set(s, s * 0.85, s);
      dummy.updateMatrix();
      this.plume.setMatrixAt(i, dummy.matrix);
      this.plume.setColorAt(i, this.tint.copy(this.smokeColor).lerp(this.ashColor, Math.min(1, l * 1.4)));
    });
    this.plume.instanceMatrix.needsUpdate = true;
    if (this.plume.instanceColor) this.plume.instanceColor.needsUpdate = true;

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
