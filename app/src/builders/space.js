/**
 * The solar system.
 *
 * Nothing else in this project works like this land, and it is worth saying
 * why rather than treating it as one more scene.
 *
 * Every other land is a **place**: a field, a yard, a room. It has a ground
 * plane, a sky that lights it, and objects standing on the floor at the size
 * they really are — one unit is one metre, and that rule is the backbone of
 * the whole pipeline. Space has none of that. There is no ground to stand on,
 * no sky to light anything, and the real numbers are unusable: at any scale
 * where Neptune fits in front of a seated child, the Earth is smaller than a
 * grain of sand.
 *
 * So this is not a place. It is an **orrery** — the brass model of the planets
 * on a schoolroom table, and every teaching decision follows from that:
 *
 * - **Sizes and distances are not to scale, and cannot be.** They are ordered
 *   correctly — Mercury nearest, Neptune furthest, Jupiter biggest — because
 *   the order is the lesson. The ratios are compressed because the truth does
 *   not fit in a room.
 * - **Orbit speeds are compressed too**, but not evenly. Using the real
 *   periods puts Neptune's year at 165 of Earth's, which on screen is a planet
 *   that does not move. Raising them to a power keeps the ordering that
 *   matters — the inner ones are visibly faster — while letting the outer ones
 *   still go round.
 * - **The Sun is the only light.** No sun lamp, no sky fill, no environment
 *   map: one point light at the centre, so every planet is lit from the Sun
 *   and has a night side. That single fact is most of what makes the scene
 *   read as space rather than as balls on black paper.
 *
 * The maps are photographs, and this is the one place in the project where a
 * photograph beats anything we could build. What makes Jupiter Jupiter is its
 * banding, and that is a picture, not geometry.
 */

const PLANETS = 'assets/planets';

const ringLight = new THREE.Vector3();
const ringRotation = new THREE.Matrix4();

/**
 * The Sun's glare, painted once into a small canvas and shared.
 *
 * A radial gradient that reaches zero at the edge. Everything about how the
 * corona looks is in these four colour stops: bright and tight in the middle,
 * a long thin tail out to nothing. A linear falloff gives a visible disc; this
 * one gives a glare.
 */
let corona = null;

function coronaTexture() {
  if (corona) return corona;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

  // Read these against the sprite, not on their own.
  //
  // The sprite is seven times the Sun's radius across, so half of it is 3.5R
  // and a stop at fraction f sits at 3.5R × f from the centre. The Sun's own
  // edge is therefore at **f = 0.29** — and that is the number that matters.
  // Tuned tighter than that, every one of these stops falls inside the disc
  // and the glare is completely hidden behind the very thing it is supposed to
  // be coming off, which is exactly what happened: a flat orange ball with a
  // hard edge and no light around it at all.
  //
  // So it is still bright at the edge and only then falls away, reaching
  // nothing about two radii out.
  gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,250,236,0.85)');
  gradient.addColorStop(0.29, 'rgba(255,226,170,0.52)');
  gradient.addColorStop(0.42, 'rgba(255,186,105,0.22)');
  gradient.addColorStop(0.62, 'rgba(255,150,70,0.07)');
  gradient.addColorStop(1.0, 'rgba(255,140,60,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  corona = new THREE.CanvasTexture(canvas);
  return corona;
}

/**
 * The Milky Way, wrapped round everything.
 *
 * An inverted sphere rather than a scene background, because it has to sit
 * *inside* the far plane and behind everything else regardless of draw order —
 * and because a background image in three.js is not affected by the camera's
 * position, which for a scene you are meant to feel inside is the wrong
 * behaviour by a small but visible amount.
 */
AFRAME.registerComponent('starfield', {
  schema: {
    src: { type: 'string', default: `${PLANETS}/stars.webp` },
    radius: { type: 'number', default: 220 },
    /** Dimmed, because a full-brightness Milky Way outshines the planets. */
    brightness: { type: 'number', default: 0.32 },

    /** Pinpoint stars drawn over the plate. See `pinpoints`. */
    stars: { type: 'number', default: 3000 },
  },

  init() {
    const texture = new THREE.TextureLoader().load(this.data.src);
    texture.colorSpace = THREE.SRGBColorSpace;

    const group = new THREE.Group();

    // The Milky Way plate. It carries the band and the colour, and nothing
    // else: two thousand pixels stretched over a whole sphere means every star
    // in it is a soft blob several degrees across, which is why it is dimmed
    // and why it is not the whole answer.
    const plate = new THREE.Mesh(
      new THREE.SphereGeometry(this.data.radius, 32, 24),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        color: new THREE.Color(this.data.brightness, this.data.brightness, this.data.brightness),
        // It is infinitely far away and must never occlude or be occluded.
        depthWrite: false,
        // Tone mapping would crush the faint stars into the black.
        toneMapped: false,
      })
    );
    plate.renderOrder = -1;
    group.add(plate);

    group.add(this.pinpoints());

    this.el.setObject3D('mesh', group);
  },

  /**
   * Real points of light, scattered over the same sphere.
   *
   * This is what makes the sky look like a sky. A star is a point source and
   * the eye knows it: anything with a visible width reads as a smudge, and a
   * texture stretched across a hemisphere can only ever give smudges. Points
   * are drawn at a fixed pixel size no matter how far away they are, which is
   * exactly the behaviour a star has.
   *
   * Distributed properly, too. Picking a random latitude and longitude piles
   * stars up at the poles; taking the latitude from `acos` of a uniform number
   * spreads them evenly over the sphere, which is what an actual sky does.
   */
  pinpoints() {
    const count = this.data.stars;
    const radius = this.data.radius * 0.92;

    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const tint = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;

      positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.cos(theta);
      positions[i * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);

      // Most stars are faint; a few are not. A uniform brightness reads as
      // static, and the handful of bright ones are what the eye latches on to.
      const brightness = 0.25 + Math.random() ** 3 * 0.75;
      // A little colour. Real stars run from cool blue to warm orange, and
      // even a slight spread stops the field looking like grey noise.
      tint.setHSL(0.55 + (Math.random() - 0.5) * 0.16, 0.35, brightness * 0.7);

      colours[i * 3] = tint.r;
      colours[i * 3 + 1] = tint.g;
      colours[i * 3 + 2] = tint.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 2,
        // Off, so a star stays a point rather than growing as you approach the
        // far side of a sphere it is painted on.
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
    );
    points.renderOrder = -1;

    return points;
  },

  remove() {
    this.el.removeObject3D('mesh');
  },
});

/**
 * The Sun: a lit sphere that is its own light source.
 *
 * `MeshBasicMaterial`, not standard — the Sun is not lit by anything, it emits.
 * A standard material at the centre of the only light in the scene would be
 * lit from inside itself and come out black.
 */
AFRAME.registerComponent('sun', {
  schema: {
    radius: { type: 'number', default: 1.3 },
    src: { type: 'string', default: `${PLANETS}/sun.webp` },

    /** How far the light reaches. 0 is no limit. */
    distance: { type: 'number', default: 0 },
    intensity: { type: 'number', default: 8 },

    /**
     * How fast the light falls off with distance.
     *
     * Physically this is 2, and physically correct is unusable here: the outer
     * planets sit ten times further from the Sun than the inner ones, so a
     * square law leaves Neptune a hundred times darker than Mercury and the
     * back half of the model in the dark. A gentle exponent keeps the inner
     * planets brighter — which is true, and is worth showing — while leaving
     * the outer ones lit enough to be looked at.
     */
    decay: { type: 'number', default: 0.35 },

    /** Seconds for one rotation. The real Sun takes about 27 days. */
    spin: { type: 'number', default: 90 },
  },

  init() {
    const texture = new THREE.TextureLoader().load(this.data.src);
    texture.colorSpace = THREE.SRGBColorSpace;

    const group = new THREE.Group();

    this.body = new THREE.Mesh(
      new THREE.SphereGeometry(this.data.radius, 48, 32),
      // Pushed past white on purpose.
      //
      // The map is a real photograph of the Sun and, like every photograph of
      // it, exposed so the surface detail survives — which makes it an orange
      // ball. Nothing in the sky is orange at that brightness; the Sun is the
      // one thing you cannot look at. Multiplying past 1 blows the bright
      // parts out to white and leaves the darker granulation orange, which is
      // what the eye expects and what stops it reading as a painted marble.
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    );
    this.body.material.color.setRGB(1.75, 1.5, 1.25);
    group.add(this.body);

    // The corona: a camera-facing sprite with a painted falloff, not a shell.
    //
    // A sphere was the obvious version and it is wrong twice over. It has a
    // hard edge of its own — the glare stops at a radius, like a sticker — and
    // a faint warm colour added over black comes out as a **dark brown disc**,
    // which is what it looked like: a muddy circle round the Sun that swallowed
    // the orbit rings behind it.
    //
    // A gradient painted into a texture has no edge at all, and because it is
    // a sprite it always faces the viewer, which is what a glare does.
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: coronaTexture(),
        // Near-white, not orange. A faint warm colour added over black is a
        // dark colour — 15% of orange is brown — and a wide orange sprite laid
        // a muddy wash across half the sky.
        color: 0xfff0d8,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    // Seven radii across, so the falloff has somewhere to happen outside the
    // Sun itself. See the stops in `coronaTexture`.
    glow.scale.setScalar(this.data.radius * 7);
    group.add(glow);

    // The only light in the land.
    const light = new THREE.PointLight(
      0xfff2e0, this.data.intensity, this.data.distance, this.data.decay
    );
    group.add(light);

    this.el.setObject3D('mesh', group);
  },

  highlightAnchor() {
    // Outside the corona, or the ring is buried in the glare.
    return { object3D: this.body, radius: this.data.radius * 2.4, thickness: 0.02, opacity: 0.6, billboard: true };
  },

  tick(time, delta) {
    if (this.body) this.body.rotation.y += (delta / 1000) * ((Math.PI * 2) / this.data.spin);
  },

  remove() {
    this.el.removeObject3D('mesh');
  },
});

/**
 * One planet, on its orbit.
 *
 * The entity is placed at the **centre of the system**, not at the planet —
 * the orbit radius is the component's business, so a stage file lists eight
 * planets at one position and they arrange themselves. Moving the system
 * moves all of it.
 *
 * Three nested objects, because three things turn independently: the orbit
 * carries the planet round the Sun, the tilt holds the axis over at a fixed
 * angle, and the body spins inside it. Collapsing any two makes the axis
 * wobble as the planet goes round.
 */
AFRAME.registerComponent('planet', {
  schema: {
    src: { type: 'string' },
    radius: { type: 'number', default: 0.2 },

    /** Distance from the Sun, in this model's metres. */
    orbit: { type: 'number', default: 3 },

    /** The real orbital period in Earth days. Compressed for the screen. */
    days: { type: 'number', default: 365 },

    /** Where it starts on its orbit, in degrees. Spreads them out. */
    phase: { type: 'number', default: 0 },

    /** Axial tilt in degrees. Uranus is on its side, and that is the lesson. */
    tilt: { type: 'number', default: 0 },

    /** Seconds for one turn on its own axis. */
    spin: { type: 'number', default: 20 },

    /** Saturn's rings, in multiples of the planet's own radius. */
    ring: { type: 'boolean', default: false },
    ringInner: { type: 'number', default: 1.3 },
    ringOuter: { type: 'number', default: 2.2 },

    /** A moon, for the Earth. */
    moon: { type: 'boolean', default: false },

    /**
     * A light of its own, for a planet met on its own.
     *
     * In the orrery every planet is lit by the Sun at the centre, which is the
     * whole point of it. A close-up is somewhere else entirely: the Sun is far
     * off to one side and the planet needs a key light from that direction or
     * it is a black circle. Given as `x y z`, the direction the light comes
     * from.
     *
     * The light is a child, so hiding the planet hides it — three.js skips
     * invisible subtrees when it gathers lights, which is what lets eight
     * close-ups sit in one scene with only the visible one lighting anything.
     */
    key: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
    keyIntensity: { type: 'number', default: 2.6 },

    /**
     * How big the Sun looks from here, as a fraction of the planet's radius.
     *
     * Not decoration. From Mercury the Sun is a furnace filling the sky; from
     * Neptune it is a bright star among the others. That difference is the
     * clearest thing anybody can be shown about how far apart these are, and
     * it costs one sprite.
     */
    sunSize: { type: 'number', default: 0 },

    /**
     * A band of air round the edge, in a colour.
     *
     * The rim is the single detail that separates a planet with an atmosphere
     * from a painted ball. Empty for the airless ones, which is most of them.
     */
    atmosphere: { type: 'color', default: '' },
  },

  init() {
    const { radius, orbit, phase, tilt } = this.data;

    const loader = new THREE.TextureLoader();
    const load = (src) => {
      const t = loader.load(src);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };

    // Orbit → tilt → body. Each turns about a different thing.
    this.orbit = new THREE.Group();
    this.orbit.rotation.y = THREE.MathUtils.degToRad(phase);

    const carriage = new THREE.Group();
    carriage.position.x = orbit;
    this.orbit.add(carriage);

    // The axis, and the one thing about it that is easy to get wrong.
    //
    // Hung inside the orbit group, a fixed tilt is a tilt *relative to the
    // orbit* — so as the planet is carried round, the direction it leans in is
    // carried round with it. Saturn's rings swung through a full turn every
    // orbit, which is what makes them look like they are rotating oddly rather
    // than simply being there.
    //
    // A real planet's axis points at a fixed star and stays pointing there all
    // year. `tick` undoes the orbit's own rotation here, so the lean stays put
    // in space while the planet travels. The `YZX` order is what makes that
    // work: the undo has to be applied before the tilt, not after.
    const axis = new THREE.Group();
    axis.rotation.order = 'YZX';
    axis.rotation.z = THREE.MathUtils.degToRad(tilt);
    carriage.add(axis);

    this.axis = axis;

    this.body = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 28),
      // Standard, not basic: a planet must have a night side. That is the
      // whole reason the Sun is a light and not a bright ball.
      new THREE.MeshStandardMaterial({ map: load(this.data.src), roughness: 1, metalness: 0 })
    );
    axis.add(this.body);

    if (this.data.ring) axis.add(this.rings(radius, load));
    if (this.data.moon) this.addMoon(carriage, radius, load);

    const { key } = this.data;
    if (key.x || key.y || key.z) {
      // Directional, not a point light.
      //
      // A point light falls off with the square of the distance, so the same
      // numbers that lit Mercury properly left Jupiter — four times the size,
      // and so with its light four times further out — in near darkness. The
      // Sun seen from any planet is effectively at infinity: parallel rays, no
      // falloff, which is exactly what a directional light is.
      const light = new THREE.DirectionalLight(0xfff4e2, this.data.keyIntensity);
      light.position.set(key.x, key.y, key.z).normalize().multiplyScalar(radius * 8);
      // Aim at an empty at the carriage origin, NOT at `this.body`. A light's
      // target is a real object in the graph, and `add()` detaches whatever it
      // is given from its current parent — so targeting the body pulled it out
      // of `axis`, the group that carries the tilt. Uranus stood up straight,
      // and Saturn's rings kept a lean the planet no longer had. The body sits
      // at the carriage origin anyway, so an empty there aims at the same
      // point and nothing about the lighting changes.
      light.target = new THREE.Object3D();
      carriage.add(light);
      carriage.add(light.target);

      if (this.data.sunSize) carriage.add(this.distantSun(radius));
    }

    if (this.data.atmosphere) axis.add(this.air(radius));

    this.el.setObject3D('mesh', this.orbit);
  },

  /** Saturn's rings: a flat annulus, lying in the planet's own tilted plane. */
  rings(radius, load) {
    const texture = load(`${PLANETS}/saturn-ring.webp`);

    const geometry = new THREE.RingGeometry(
      radius * this.data.ringInner,
      radius * this.data.ringOuter,
      64
    );

    // A ring's default UVs run corner to corner, which smears the plate across
    // it. Rewriting them so U follows the radius puts the bands where the
    // bands belong.
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const inner = radius * this.data.ringInner;
    const outer = radius * this.data.ringOuter;

    for (let i = 0; i < position.count; i += 1) {
      const distance = Math.hypot(position.getX(i), position.getY(i));
      uv.setXY(i, (distance - inner) / (outer - inner), 0.5);
    }

    // Neither lit nor unlit — scattering, with a shadow.
    //
    // Both obvious materials are wrong. Unlit, the rings are a glowing hoop at
    // full brightness right across the planet's night side. Lit as a surface,
    // they go black: they are a sheet a few metres thick seen almost edge-on
    // to the Sun, and `dot(normal, light)` on a sheet like that is nearly
    // zero. That is why they vanished.
    //
    // Real rings are not a sheet. They are billions of separate lumps of ice,
    // each one a little sphere catching the light from every direction, which
    // is why they are bright at almost any angle. So they are drawn at full
    // brightness — and the one thing that must be there is the **shadow the
    // planet throws across them**, which is the detail every photograph of
    // Saturn is remembered for.
    //
    // The shadow is a cylinder test, not a shadow map: a point on the ring is
    // in shadow when it lies behind the planet along the light, and closer to
    // that line than the planet is wide.
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: texture },
          uLight: { value: new THREE.Vector3(0, 0, 1) },
          uPlanet: { value: radius },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vPos;
          void main() {
            vUv = uv;
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform vec3 uLight;
          uniform float uPlanet;
          varying vec2 vUv;
          varying vec3 vPos;
          void main() {
            vec4 c = texture2D(uMap, vUv);
            if (c.a < 0.06) discard;

            float along = dot(vPos, uLight);
            float across = length(vPos - uLight * along);

            // Behind the planet, and within its width: in shadow. Softened at
            // the edge, because the Sun is not a point and the shadow's edge
            // on the real rings is not a line either.
            float shadow = along < 0.0
              ? smoothstep(uPlanet * 0.90, uPlanet * 1.12, across)
              : 1.0;

            gl_FragColor = vec4(c.rgb * mix(0.13, 1.0, shadow), c.a);

            // A hand-written shader gets none of the conversions three.js
            // gives its own materials. Without these the ring is written to
            // the screen as if its linear values were already sRGB, which is
            // exactly as dark as it looked: the picture was right and only the
            // last step was missing.
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        toneMapped: true,
      })
    );

    this.ring = mesh;

    // Flat in the planet's equator, not standing up beside it.
    mesh.rotation.x = -Math.PI / 2;

    return mesh;
  },

  /** The Sun as it looks from here: a point of glare in the key direction. */
  distantSun(radius) {
    const { key } = this.data;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: coronaTexture(),
        color: 0xfff3d8,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );

    sprite.position.set(key.x, key.y, key.z).normalize().multiplyScalar(radius * 3.6);
    sprite.scale.setScalar(radius * this.data.sunSize);

    return sprite;
  },

  /**
   * The atmosphere: a thin shell that only glows where it is edge-on and lit.
   *
   * Fresnel — the falling-off of `dot(normal, view)` — is what makes air visible
   * at all: looking straight down at it you see through it, looking across it
   * you see a long way through and it glows. Multiplying by the light gives the
   * other half of it: the day side has a blue rim and the night side does not,
   * which is the part that makes it read as a real planet rather than a ball
   * with a halo drawn round it.
   */
  air(radius) {
    const { key } = this.data;

    return new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.035, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(this.data.atmosphere) },
          uLight: { value: new THREE.Vector3(key.x, key.y, key.z).normalize() },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 eye = modelViewMatrix * vec4(position, 1.0);
            vView = -eye.xyz;
            gl_Position = projectionMatrix * eye;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform vec3 uLight;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec3 n = normalize(vNormal);
            float rim = pow(1.0 - abs(dot(n, normalize(vView))), 2.6);
            float lit = smoothstep(-0.35, 0.45, dot(n, normalize((viewMatrix * vec4(uLight, 0.0)).xyz)));
            gl_FragColor = vec4(uColor * rim * lit * 1.6, rim * lit);

            // Same reason as the rings: a custom shader has to ask for the
            // conversions by hand.
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
  },

  addMoon(carriage, radius, load) {
    this.moon = new THREE.Group();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.27, 24, 16),
      new THREE.MeshStandardMaterial({ map: load(`${PLANETS}/moon.webp`), roughness: 1 })
    );
    mesh.position.x = radius * 2.6;

    this.moon.add(mesh);
    carriage.add(this.moon);
  },

  /**
   * Tell the rings which way the light is coming from, in their own space.
   *
   * Recomputed every frame rather than set once: the rings are three groups
   * deep inside a planet that orbits, and a direction that was right at one
   * point on the orbit is wrong at the next.
   *
   * Rotation only. A direction has no position, and using the full world
   * matrix would drag the orbit's translation into it.
   */
  aimRingShadow() {
    if (!this.ring) return;

    const key = this.data.key;
    const light = ringLight.set(key.x, key.y, key.z);

    // No key means this planet is in the orrery, where the Sun sits at the
    // middle — which in the carriage's own space is straight back along -X.
    if (!key.x && !key.y && !key.z) light.set(-1, 0, 0);

    this.ring.updateWorldMatrix(true, false);
    ringRotation.extractRotation(this.ring.matrixWorld).invert();

    this.ring.material.uniforms.uLight.value
      .copy(light)
      .normalize()
      .applyMatrix4(ringRotation);
  },

  /**
   * Where a highlight ring should sit: on the planet, not at the Sun.
   *
   * The entity is the centre of the system; the planet is out on an orbit and
   * moving. `highlight` follows whatever this returns.
   */
  highlightAnchor() {
    return { object3D: this.body, radius: this.data.radius * 1.75, thickness: 0.03, opacity: 0.8, billboard: true };
  },

  tick(time, delta) {
    if (!this.orbit) return;

    const seconds = delta / 1000;

    // Compressed, and not linearly.
    //
    // Real periods put Neptune's year at 165 of Earth's, which on screen is a
    // planet that does not move at all. The 0.45 power keeps what matters —
    // the inner planets are visibly quicker — while letting the outer ones
    // still complete an orbit while somebody is watching.
    const period = 26 * (this.data.days / 365) ** 0.45;
    this.orbit.rotation.y += seconds * ((Math.PI * 2) / period);

    // Cancel the orbit, so the axis keeps pointing where it pointed.
    this.axis.rotation.y = -this.orbit.rotation.y;

    this.aimRingShadow();

    this.body.rotation.y += seconds * ((Math.PI * 2) / this.data.spin);
    if (this.moon) this.moon.rotation.y += seconds * ((Math.PI * 2) / 9);
  },

  remove() {
    this.el.removeObject3D('mesh');
  },
});

/**
 * The circle a planet travels on.
 *
 * A flat annulus, not a line. `THREE.Line` is one hardware pixel wide on every
 * platform that matters — `linewidth` has been ignored by WebGL for years — so
 * eight of them across a dark scene came out as hairlines you had to hunt for,
 * and the shape of the solar system was the thing they existed to show.
 *
 * A ring with real width can also be seen at a glancing angle, which matters
 * here: the orrery is tipped towards the viewer and the far side of every
 * orbit is nearly edge-on.
 */
AFRAME.registerComponent('orbit-ring', {
  schema: {
    radius: { type: 'number', default: 3 },
    color: { type: 'color', default: '#7f93b5' },
    opacity: { type: 'number', default: 0.16 },
  },

  init() {
    const { radius } = this.data;

    // A fixed width, not a proportional one.
    //
    // Scaling the width with the orbit was right when the whole model was
    // across the room. Standing inside it, Neptune's orbit is fifty metres
    // out and six times wider than Mercury's — pale bands as thick as a plank,
    // sweeping across the whole sky. They stopped being a hint and became the
    // loudest thing in the picture, and a diagram drawn over space is exactly
    // what makes space look like a cartoon.
    //
    // Space has no orbit lines. These earn their place only by being almost
    // not there.
    const width = 0.05;

    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius - width, radius + width, 128),
      new THREE.MeshBasicMaterial({
        color: this.data.color,
        transparent: true,
        opacity: this.data.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      })
    );
    mesh.rotation.x = -Math.PI / 2;

    this.el.setObject3D('mesh', mesh);
  },

  remove() {
    this.el.removeObject3D('mesh');
  },
});

/**
 * The whole orrery as one thing.
 *
 * Eight planets, eight orbit rings and a Sun were eighteen entries in a stage
 * file, which is fine until a lesson wants to put the overview away and stand
 * next to Jupiter instead. Then it is eighteen things to hide and show
 * together, and a lesson should not have to know that.
 *
 * So it is one entity with one id. It builds the same `sun`, `planet` and
 * `orbit-ring` components underneath — nothing here reimplements them, and the
 * table below is the only place the model's numbers live.
 */
const ORRERY = [
  // name       radius  orbit  days   phase  tilt  spin
  //
  // The orbits are sized so that a viewer sitting twenty metres from the Sun
  // is INSIDE the outer four. The inner planets stay over by the Sun where
  // they belong; Jupiter, Saturn, Uranus and Neptune sweep round behind the
  // child's head, and following one round is the moment the model stops being
  // something being looked at and becomes somewhere they are.
  ['mercury',   0.35,     5,      88,   200,   0,    30],
  ['venus',     0.70,     8,     225,    40, 177,    50],
  ['earth',     0.75,    11,     365,   300,  23,    14],
  ['mars',      0.50,    15,     687,   120,  25,    15],
  ['jupiter',   2.50,    26,    4333,    20,   3,     8],
  ['saturn',    1.90,    35,   10759,   250,  27,     9],
  ['uranus',    1.20,    44,   30687,   150,  98,    12],
  ['neptune',   1.15,    52,   60190,    80,  28,    12],
];

AFRAME.registerComponent('orrery', {
  schema: {
    sun: { type: 'number', default: 2.6 },

    /**
     * How far the plane is tipped.
     *
     * Nearly flat now, and that is the point. Tipped steeply the whole system
     * is a picture hanging in front of you — better to look at, and still a
     * picture. Almost level, with the viewer inside it, the orbits run past on
     * both sides and close behind, which is the only arrangement that can be
     * turned around in.
     */
    tilt: { type: 'number', default: -7 },
  },

  init() {
    this.el.innerHTML = '';
    this.el.setAttribute('rotation', `${this.data.tilt} 0 0`);

    const add = (component, params) => {
      const el = document.createElement('a-entity');
      el.setAttribute(component, params);
      this.el.appendChild(el);
    };

    add('sun', { radius: this.data.sun, intensity: 8, decay: 0.35, distance: 0 });

    for (const [name, , orbit] of ORRERY) add('orbit-ring', { radius: orbit });

    for (const [name, radius, orbit, days, phase, tilt, spin] of ORRERY) {
      add('planet', {
        src: `${PLANETS}/${name}.webp`,
        radius, orbit, days, phase, tilt, spin,
        ...(name === 'earth' ? { moon: true } : {}),
        ...(name === 'saturn' ? { ring: true, ringInner: 1.35, ringOuter: 2.45 } : {}),
      });
    }
  },
});
