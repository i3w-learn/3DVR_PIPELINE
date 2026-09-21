/**
 * What stands in a street: lamps, market stalls, a line of trees.
 *
 * One builder file per land.
 *
 * `building` makes the shopfronts and `path` makes the road, and the first
 * version of this land stopped there — which produced two rows of clean boxes
 * either side of an empty strip of paving running to the horizon. A street is
 * not its buildings. It is the clutter between them: the stall with the
 * striped awning, the lamp, the tree somebody planted outside the clinic.
 * That clutter is also what the market and community-helper lessons need to
 * stand their people beside.
 */

import { seeded } from './random.js';
import { direct, hazed, place, rod, roundParts } from './terrain.js';

/**
 * A market stall: a table of goods under a striped awning on four poles.
 *
 * The goods are coloured lumps on purpose. From across a road a pile of
 * oranges is an orange heap, and a heap is all that is visible; the fruit
 * that a lesson actually names is placed by the lesson, as a real model, at
 * the front of the table.
 */
AFRAME.registerComponent('stall', {
  schema: {
    width: { type: 'number', default: 2.4 },
    depth: { type: 'number', default: 1.5 },
    awning: { type: 'color', default: '#c8402f' },
    stripe: { type: 'color', default: '#f4ead6' },
    goods: { type: 'string', default: '#e8872b, #d9433a, #7fae3e, #f0c93a' },
    seed: { type: 'number', default: 1 },
  },

  ...direct,

  parts() {
    const { width: w, depth: d, awning, stripe, goods, seed } = this.data;
    const random = seeded(seed);
    const parts = [];
    const wood = '#8a6238';
    this.spots.push({ x: 0, z: 0.1, r: Math.max(w, d) * 0.72 });

    // Table: a top, a skirt board, four legs.
    parts.push({ geometry: new THREE.BoxGeometry(w, 0.06, d), matrix: place(0, 0.86, 0), color: wood });
    parts.push({ geometry: new THREE.BoxGeometry(w, 0.3, 0.04), matrix: place(0, 0.7, d / 2), color: '#a97b45' });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      parts.push(rod([sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)], [sx * (w / 2 - 0.08), 0.86, sz * (d / 2 - 0.08)], 0.035, wood, 4));
      parts.push(rod([sx * (w / 2), 0, sz * (d / 2)], [sx * (w / 2), sz > 0 ? 2.05 : 2.45, sz * (d / 2)], 0.03, wood, 5));
    }

    // Awning: sloping toward the customer, in stripes.
    const STRIPES = 8;
    const slope = Math.atan2(0.4, d);
    for (let i = 0; i < STRIPES; i += 1) {
      parts.push({
        geometry: new THREE.BoxGeometry((w + 0.5) / STRIPES, 0.03, d + 0.55),
        matrix: place(-(w + 0.5) / 2 + ((i + 0.5) * (w + 0.5)) / STRIPES, 2.27, 0.05, { rx: slope }),
        color: i % 2 ? stripe : awning,
      });
    }

    // Heaps of goods, in baskets.
    const colours = goods.split(',').map((c) => c.trim());
    colours.forEach((colour, i) => {
      const x = -w / 2 + ((i + 0.5) * w) / colours.length;
      parts.push({
        geometry: new THREE.CylinderGeometry(0.24, 0.19, 0.14, 9),
        matrix: place(x, 0.96, 0.05), color: '#b89258',
      });
      for (let k = 0; k < 9; k += 1) {
        parts.push({
          geometry: new THREE.IcosahedronGeometry(0.06 + random() * 0.025, 0),
          matrix: place(x + (random() - 0.5) * 0.3, 1.05 + random() * 0.12, 0.05 + (random() - 0.5) * 0.3),
          color: hazed(colour, '#ffffff', random() * 0.18),
        });
      }
    });

    return parts;
  },
});

/** A street lamp: a post, an arm, a lantern. */
AFRAME.registerComponent('streetlamp', {
  schema: {
    height: { type: 'number', default: 4.6 },
    post: { type: 'color', default: '#3c464d' },
    lamp: { type: 'color', default: '#fff1c4' },
  },

  ...direct,

  parts() {
    const { height: h, post, lamp } = this.data;
    this.spots.push({ x: 0, z: 0, r: 0.4 });
    return [
      { geometry: new THREE.CylinderGeometry(0.11, 0.15, 0.5, 8), matrix: place(0, 0.25, 0), color: post },
      rod([0, 0.5, 0], [0, h, 0], 0.055, post, 6),
      rod([0, h, 0], [0.9, h + 0.18, 0], 0.04, post, 5),
      { geometry: new THREE.BoxGeometry(0.42, 0.13, 0.26), matrix: place(0.95, h + 0.1, 0), color: post },
      { geometry: new THREE.BoxGeometry(0.34, 0.06, 0.2), matrix: place(0.95, h + 0.01, 0), color: lamp },
    ];
  },
});

/**
 * Trees planted along both sides of a road, each in its own square of earth.
 * One mesh, however many trees.
 */
AFRAME.registerComponent('avenue', {
  schema: {
    length: { type: 'number', default: 40 },
    /** Distance from the centre line to each row. */
    offset: { type: 'number', default: 4.1 },
    spacing: { type: 'number', default: 7 },
    height: { type: 'number', default: 5.2 },
    leaf: { type: 'color', default: '#4a8a45' },
    seed: { type: 'number', default: 61 },
    /** Only the squares of earth — for a land that stands real trees in them. */
    bare: { type: 'boolean', default: false },
  },

  ...direct,

  parts() {
    const { length, offset, spacing, height, leaf, seed, bare } = this.data;
    const random = seeded(seed);
    const parts = [];

    for (let z = 0; z > -length; z -= spacing) {
      for (const sx of [-1, 1]) {
        const x = sx * offset;
        const zz = z - (sx > 0 ? spacing / 2 : 0); // staggered, not in pairs

        parts.push({
          geometry: new THREE.BoxGeometry(1.1, 0.1, 1.1), matrix: place(x, 0.05, zz), color: '#6e5a40',
        });
        const h = height * (0.85 + random() * 0.3);
        if (bare) continue;
        parts.push(...roundParts(x, zz, h, hazed(leaf, '#9fc25f', random() * 0.35), '#5d4632', random));
        this.spots.push({ x, z: zz, r: h * 0.42 });
      }
    }

    return parts;
  },
});
