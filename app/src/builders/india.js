/**
 * The India land: a courtyard of plinths.
 *
 * Three topics stand here — States of India, National Symbols, and the
 * cultures of India — and all three are the same shape of lesson: a thing on
 * a stand, named, one at a time.
 *
 * ## Why a courtyard and not a map
 *
 * A literal outline of India would be the obvious answer and it is not one
 * this file can honestly give: a coastline is not a shape arithmetic can
 * produce, so it needs a texture or a mesh somebody draws. Until that exists,
 * a map plate here would be a rectangle pretending to be a country.
 *
 * A courtyard of plinths is the honest version of the same lesson. It is also
 * the better one for a five-year-old: a tiger on a stand at their own height
 * teaches "this is our national animal" more directly than a marker on a map
 * they cannot read.
 *
 * The plinths are built. What stands on them — a tiger, a peacock, a lotus —
 * is downloaded, and that is the part this land is still waiting for.
 */

import { builder } from './built.js';
import { flatMaterial, mergeParts, place, rod } from './terrain.js';

/** A display pedestal. Base, shaft, cap — so it reads as made, not extruded. */
AFRAME.registerComponent('plinth', {
  schema: {
    height: { type: 'number', default: 0.85 },
    width: { type: 'number', default: 0.7 },
    stone: { type: 'color', default: '#ddd5c4' },
    trim: { type: 'color', default: '#b9a683' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { height, width, stone, trim } = this.data;
    const shaft = height - 0.16;

    this.block(width, 0.08, width, 0, 0.04, 0, trim);
    this.block(width * 0.78, shaft, width * 0.78, 0, 0.08 + shaft / 2, 0, stone);
    this.block(width, 0.08, width, 0, height - 0.04, 0, trim);

    this.bake();
  },
});

/**
 * The paved floor of the courtyard, with a step up onto it.
 *
 * A step matters more than it sounds: it is what tells a child the plinths are
 * on a platform rather than scattered on open ground, and it gives the land an
 * edge, which a flat plane does not have.
 */
AFRAME.registerComponent('courtyard', {
  schema: {
    width: { type: 'number', default: 16 },
    depth: { type: 'number', default: 12 },
    rise: { type: 'number', default: 0.18 },
    steps: { type: 'number', default: 2 },
    paving: { type: 'color', default: '#cfc7b6' },
    edge: { type: 'color', default: '#b0a693' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, depth, rise, steps, paving, edge } = this.data;

    for (let i = 0; i < steps; i += 1) {
      const inset = i * 0.45;
      const y = i * rise;
      this.block(width - inset * 2, rise, depth - inset * 2, 0, y + rise / 2, 0,
                 i === steps - 1 ? paving : edge);
    }

    this.bake();
  },
});

/**
 * The Ashoka Chakra: the wheel at the centre of the flag. A rim, a hub and
 * twenty-four spokes.
 *
 * It is here because it is the one national symbol that is pure geometry. The
 * tiger, the peacock and the banyan all need a model somebody sculpts; the
 * wheel is a torus and twenty-four rods, and a child has seen it on every
 * flag they have ever looked at. Twenty-four is not a style choice — it is
 * the number on the flag, so it is the number here.
 */
AFRAME.registerComponent('chakra', {
  schema: {
    radius: { type: 'number', default: 0.55 },
    color: { type: 'color', default: '#0b2a6f' },
    /** Slow turn. A wheel that turns reads as a wheel. 0 to hold it still. */
    rpm: { type: 'number', default: 1.5 },
  },

  init() {
    this.build();

    if (!this.data.rpm) return;
    this.el.setAttribute('animation__turn', {
      property: 'object3D.rotation.z',
      from: 0, to: -360,
      loop: true, dur: 60000 / this.data.rpm, easing: 'linear',
    });
  },

  update() { this.build(); },

  build() {
    const { radius: r, color } = this.data;
    const parts = [
      { geometry: new THREE.TorusGeometry(r, r * 0.075, 6, 36), color },
      { geometry: new THREE.CylinderGeometry(r * 0.16, r * 0.16, r * 0.14, 12), matrix: place(0, 0, 0, { rx: Math.PI / 2 }), color },
    ];

    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      parts.push(rod(
        [Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15, 0],
        [Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96, 0],
        r * 0.022, color, 4
      ));
      // The small bead between each pair of spokes, at the rim.
      const b = a + Math.PI / 24;
      parts.push({
        geometry: new THREE.IcosahedronGeometry(r * 0.035, 0),
        matrix: place(Math.cos(b) * r * 0.9, Math.sin(b) * r * 0.9, 0),
        color,
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

/**
 * A ceremonial gateway — two piers, an arch between them, a stepped crown.
 *
 * Not a copy of any one monument: India Gate, the Gateway of India and a
 * thousand town arches share this shape, and the shared shape is the point.
 * It gives the courtyard a back wall to look at and a sense of having arrived
 * somewhere, which a row of plinths on open ground does not have.
 */
AFRAME.registerComponent('gateway', {
  schema: {
    width: { type: 'number', default: 9 },
    height: { type: 'number', default: 8.5 },
    depth: { type: 'number', default: 2.2 },
    stone: { type: 'color', default: '#d9b98a' },
    trim: { type: 'color', default: '#b8935f' },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const { width: w, height: h, depth: d, stone, trim } = this.data;
    const parts = [];
    const box = (bw, bh, bd, x, y, z, color) => parts.push({
      geometry: new THREE.BoxGeometry(bw, bh, bd), matrix: place(x, y, z), color,
    });

    const pier = w * 0.26;
    const opening = w - pier * 2;
    const spring = h * 0.52;

    // Piers run the full height. Stopping them at the spring of the arch left
    // daylight at both shoulders and the cornice apparently floating.
    for (const sx of [-1, 1]) {
      const x = sx * (opening / 2 + pier / 2);
      box(pier * 1.12, 0.5, d * 1.12, x, 0.25, 0, trim);
      box(pier, h - 0.5, d, x, 0.5 + (h - 0.5) / 2, 0, stone);
      box(pier * 1.08, 0.28, d * 1.08, x, 0.5 + spring + 0.14, 0, trim);
    }

    // The arch: wedge-shaped blocks round a half circle.
    const R = opening / 2;
    const STONES = 11;
    for (let i = 0; i < STONES; i += 1) {
      const a = ((i + 0.5) / STONES) * Math.PI;
      parts.push({
        geometry: new THREE.BoxGeometry((Math.PI * (R + 0.45)) / STONES * 1.04, 0.9, d),
        matrix: place(Math.cos(a) * (R + 0.45), 0.5 + spring + 0.28 + Math.sin(a) * (R + 0.45), 0, { rz: a - Math.PI / 2 }),
        color: i % 2 ? stone : trim,
      });
    }

    // Wall above the arch, up to the cornice, then a stepped crown.
    const top = 0.5 + spring + 0.28 + R + 0.85;
    box(opening + 0.1, Math.max(0.5, h - top), d, 0, top + Math.max(0.5, h - top) / 2, 0, stone);
    box(w * 1.06, 0.34, d * 1.1, 0, h + 0.12, 0, trim);
    box(w * 0.62, 0.7, d * 0.9, 0, h + 0.64, 0, stone);
    box(w * 0.34, 0.55, d * 0.8, 0, h + 1.26, 0, trim);

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});
