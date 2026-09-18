/**
 * Above the ground: the balloon you stand in, the clouds beside you, and the
 * countryside a long way down.
 *
 * One builder file per land, so a change to the sky cannot disturb the snow
 * field and nobody has to read four unrelated components to find one.
 *
 * ## What the first version got wrong
 *
 * The basket sat on the grass. The narration said "look down — the ground is
 * far below" while the ground was level with the child's knees, and a lesson
 * about being high up that is not high up is not a lesson about anything.
 *
 * Height cannot be told; it has to be seen. So this land has no ground plane
 * at all. What is under the basket is `countryside`: fields, a river, roads
 * and villages, ninety metres down and drawn small, because looking at small
 * familiar things from above is the entire sensation of altitude.
 *
 * ## Nothing moves
 *
 * Per the comfort rules, the balloon does not travel. A moving camera with a
 * still body is the fastest way to make a four-year-old ill. The clouds drift,
 * slowly, and that is enough to feel afloat.
 */

import { seeded } from './random.js';
import { direct, flatMaterial, hazed, mergeParts, place, rod, roundParts } from './terrain.js';

/**
 * A cloud — a cluster of lumps, which is how clouds are drawn in stylised art
 * and has been since long before anyone rendered one.
 *
 * Deliberately not a particle system or a volumetric shader. Both cost frame
 * time a Quest does not have, to draw something a five-year-old reads from
 * five lumps. Each cloud is one mesh.
 */
AFRAME.registerComponent('cloud', {
  schema: {
    width: { type: 'number', default: 8 },
    puffs: { type: 'number', default: 7 },
    color: { type: 'color', default: '#fbfdfe' },
    shade: { type: 'color', default: '#dfe9f0' },
    /** Grey and heavy, for the rain half of the water cycle. */
    rain: { type: 'boolean', default: false },
    /** Metres of slow side-to-side drift. 0 for none. */
    drift: { type: 'number', default: 0 },
    seed: { type: 'number', default: 1 },
  },

  init() {
    this.rebuild();

    if (!this.data.drift) return;

    const { x, y, z } = this.el.object3D.position;
    this.el.setAttribute('animation__drift', {
      property: 'position',
      to: `${x + this.data.drift} ${y} ${z}`,
      dir: 'alternate',
      loop: true,
      // Tens of seconds. A cloud you can see moving is a cloud in a hurry.
      dur: 38000 + this.data.seed * 2900,
      easing: 'easeInOutSine',
    });
  },

  update() { this.rebuild(); },

  rebuild() {
    const { width, puffs, rain, seed } = this.data;
    const color = rain ? '#94a0ac' : this.data.color;
    const shade = rain ? '#75818d' : this.data.shade;
    const random = seeded(seed);
    const parts = [];

    for (let i = 0; i < puffs; i += 1) {
      const t = i / Math.max(1, puffs - 1);
      // Biggest in the middle, smaller at the ends — a cloud is not a row of
      // equal balls.
      const r = (width / 4.2) * (0.5 + 0.5 * Math.sin(Math.PI * t)) * (0.85 + random() * 0.3);

      parts.push({
        geometry: new THREE.IcosahedronGeometry(r, 1),
        matrix: place((t - 0.5) * width, r * 0.28 * random(), (random() - 0.5) * r * 1.1, {
          ry: random() * Math.PI, sy: 0.72,
        }),
        color: i % 2 ? shade : color,
        lumpy: 0.14,
        // Lit from above, grey underneath — what makes a cloud a solid thing.
        shade: [0.74, 1.05],
      });
    }

    // A flat underside. Real cumulus has one, and it is what stops a cluster
    // of spheres reading as a bunch of grapes.
    parts.push({
      geometry: new THREE.CylinderGeometry(width * 0.4, width * 0.36, width * 0.06, 9),
      matrix: place(0, -width * 0.09, 0, { sz: 0.5 }),
      color: shade,
    });

    if (rain) {
      for (let i = 0; i < 34; i += 1) {
        const drop = 0.5 + random() * 0.9;
        parts.push({
          geometry: new THREE.BoxGeometry(0.04, drop, 0.04),
          matrix: place((random() - 0.5) * width * 0.8, -1.2 - random() * 3.4, (random() - 0.5) * width * 0.3),
          color: '#a8cfe4',
        });
      }
    }

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});

/**
 * A rainbow. Seven bands of a torus, cut in half.
 *
 * Half, because the lower half would be underground and a full ring reads as
 * a hoop. Translucent, because a solid rainbow is a bridge.
 */
AFRAME.registerComponent('rainbow', {
  schema: {
    radius: { type: 'number', default: 60 },
    band: { type: 'number', default: 2.4 },
    opacity: { type: 'number', default: 0.55 },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const COLOURS = ['#e03a2f', '#ef7d1a', '#f2c72e', '#3f9a4a', '#2d7fc1', '#3f4fa8', '#77399b'];
    const { radius, band, opacity } = this.data;

    const parts = COLOURS.map((color, i) => ({
      geometry: new THREE.TorusGeometry(radius - i * band, band / 2, 4, 48, Math.PI),
      color,
    }));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity, side: THREE.DoubleSide,
      depthWrite: false, fog: false,
    });

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), material));
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});

/**
 * A hot-air balloon and its basket, as one mesh.
 *
 * The rim is at 0.72 m on purpose. A balloon basket is chest-high to an adult,
 * and the first version copied that — which put a wicker wall across the whole
 * view of a seated five-year-old. The child has to be able to see over the
 * edge without standing, because looking over the edge is the lesson.
 */
AFRAME.registerComponent('balloon', {
  schema: {
    radius: { type: 'number', default: 3.4 },
    basket: { type: 'number', default: 1.7 },
    rim: { type: 'number', default: 0.72 },
    envelope: { type: 'color', default: '#d4453a' },
    stripe: { type: 'color', default: '#f2c14e' },
    wicker: { type: 'color', default: '#a97b45' },
    weave: { type: 'color', default: '#8a6238' },
  },

  ...direct,

  parts() {
    const { radius, basket, rim, envelope, stripe, wicker, weave } = this.data;
    const parts = [];
    const half = basket / 2;

    // Heights, from the floor up. The mouth of the envelope sits well clear of
    // a standing adult's head, as it does on a real balloon — the first
    // version hung the skirt at 1.4 m, which put the viewer's head *inside* it
    // and filled the whole view with red fabric.
    const mouth = rim + 2.6;
    const skirt = radius * 0.42;
    const lift = mouth + skirt + radius * 1.2 * 0.94;

    // Gores, alternating colour — what makes it a balloon and not a ball.
    for (let i = 0; i < 12; i += 1) {
      parts.push({
        geometry: new THREE.SphereGeometry(radius, 3, 10, (i / 12) * Math.PI * 2, Math.PI / 6),
        matrix: place(0, lift, 0, { sy: 1.2 }),
        color: i % 2 ? stripe : envelope,
        shade: [0.7, 1.08],
      });
    }

    // The skirt, narrowing to the burner.
    parts.push({
      geometry: new THREE.CylinderGeometry(radius * 0.44, radius * 0.16, skirt, 12, 1, true),
      matrix: place(0, mouth + skirt / 2, 0),
      color: envelope,
    });

    // Floor, four walls, and a darker band of weave round the top edge.
    const t = 0.06;
    parts.push({ geometry: new THREE.BoxGeometry(basket, t, basket), matrix: place(0, t / 2, 0), color: weave });

    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      parts.push({
        geometry: new THREE.BoxGeometry(dx ? t : basket, rim, dz ? t : basket),
        matrix: place(dx * half, rim / 2, dz * half),
        color: wicker,
      });
      parts.push({
        geometry: new THREE.BoxGeometry(dx ? t * 2 : basket + t * 2, 0.07, dz ? t * 2 : basket + t * 2),
        matrix: place(dx * half, rim, dz * half),
        color: weave,
      });
    }

    // Four uprights, then ropes from their tops up to the mouth of the skirt.
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      parts.push(rod([sx * half, rim, sz * half], [sx * half, rim + 1.1, sz * half], 0.028, weave, 6));
      parts.push(rod([sx * half, rim + 1.1, sz * half], [sx * radius * 0.11, mouth, sz * radius * 0.11], 0.014, '#5a4a38', 4));
    }

    // The burner, under the mouth.
    parts.push({
      geometry: new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8),
      matrix: place(0, rim + 1.22, 0),
      color: '#3c4248',
    });

    return parts;
  },
});

/**
 * The world far below: fields, a river, roads, villages, trees.
 *
 * Placed by the stage at around y = −90, so it is this component and not a
 * ground plane that the child sees over the basket's edge.
 *
 * Everything is sized true and then simply stands a long way off. A 40-metre
 * field from ninety metres up is a patch the size of a palm, and that — small
 * things you know are big — is what altitude looks like. One mesh.
 */
AFRAME.registerComponent('countryside', {
  schema: {
    size: { type: 'number', default: 900 },
    field: { type: 'number', default: 42 },
    haze: { type: 'color', default: '#cfe0ec' },
    seed: { type: 'number', default: 21 },
  },

  ...direct,

  parts() {
    const { size, field, haze, seed } = this.data;
    const random = seeded(seed);
    const parts = [];
    const flatQuad = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);

    // The land itself. Dark, so the gaps between fields read as hedgerows.
    parts.push({ geometry: flatQuad(size, size), matrix: place(0, 0, 0), color: '#3f6633' });

    // The river's path, so fields can keep out of it.
    const river = (z) => Math.sin(z / 95) * 70 + Math.sin(z / 37) * 16 + 40;

    const CROPS = ['#6f9a3f', '#86b04a', '#5b8a3a', '#c2a63c', '#d1b04a', '#96703d', '#79a346', '#a9b548'];
    const cells = Math.floor(size / (field + 4) / 2);

    for (let ix = -cells; ix <= cells; ix += 1) {
      for (let iz = -cells; iz <= cells; iz += 1) {
        const x = ix * (field + 4) + (random() - 0.5) * 3;
        const z = iz * (field + 4) + (random() - 0.5) * 3;

        if (Math.abs(x - river(z)) < field * 0.62) continue; // the river runs here
        if (Math.abs(z + 60) < field * 0.5) continue;         // and the road here

        // Further fields are paler — the same haze the hills get.
        const far = Math.min(1, Math.hypot(x, z) / (size * 0.5));
        parts.push({
          geometry: flatQuad(field * (0.86 + random() * 0.14), field * (0.86 + random() * 0.14)),
          matrix: place(x, 0.2, z, { ry: (random() - 0.5) * 0.06 }),
          color: hazed(CROPS[Math.floor(random() * CROPS.length)], haze, far * 0.22),
        });
      }
    }

    // The river: short straight reaches, each turned to follow the curve.
    for (let z = -size / 2; z < size / 2; z += 14) {
      const x0 = river(z), x1 = river(z + 14);
      parts.push({
        geometry: flatQuad(17, 15.5),
        matrix: place((x0 + x1) / 2, 0.45, z + 7, { ry: -Math.atan2(x1 - x0, 14) }),
        color: '#4c93b4',
      });
    }

    // A road straight across, and a lane down to the nearest village.
    parts.push({ geometry: flatQuad(size, 6), matrix: place(0, 0.5, -60), color: '#b9b2a2' });
    parts.push({ geometry: flatQuad(4, 150), matrix: place(-70, 0.5, 15), color: '#b9b2a2' });

    // Villages: a scatter of houses with coloured roofs.
    const ROOFS = ['#b5543c', '#c97b4a', '#8a4b3a', '#6f7f8f', '#a8623f'];
    for (const [vx, vz, n] of [[-70, 60, 14], [120, -140, 11], [-190, -180, 9], [40, 210, 12], [230, 90, 8]]) {
      for (let i = 0; i < n; i += 1) {
        const x = vx + (random() - 0.5) * 80;
        const z = vz + (random() - 0.5) * 70;
        if (Math.abs(x - river(z)) < 16) continue;

        const w = 7 + random() * 5, d = 6 + random() * 4, h = 3.2 + random() * 2.6;
        const turn = random() * Math.PI;

        parts.push({
          geometry: new THREE.BoxGeometry(w, h, d),
          matrix: place(x, h / 2, z, { ry: turn }),
          color: random() > 0.5 ? '#efe6d2' : '#e2d6bd',
        });
        parts.push({
          geometry: new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4),
          matrix: place(x, h + 1.3, z, { ry: turn + Math.PI / 4 }),
          color: ROOFS[Math.floor(random() * ROOFS.length)],
        });
      }
    }

    // Trees along the banks and in the corners of fields.
    for (let i = 0; i < 170; i += 1) {
      const z = (random() - 0.5) * size * 0.9;
      const bank = random() > 0.55;
      const x = bank ? river(z) + (random() > 0.5 ? 1 : -1) * (13 + random() * 9) : (random() - 0.5) * size * 0.9;
      parts.push(...roundParts(x, z, 7 + random() * 6, hazed('#3f6d3c', '#7fa35a', random() * 0.5), '#5b4632', random, true));
    }

    return parts;
  },
});
