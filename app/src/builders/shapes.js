/**
 * Flat shapes and line strokes, standing on the table.
 *
 * Circle, square, triangle; standing line, sleeping line, zigzag. These are
 * the first geometry a child is taught to name, and they are the purest case
 * for drawing rather than downloading: a triangle is three numbers.
 *
 * Each shape is a thin solid, not a flat picture — extruded a few centimetres
 * so it has an edge that catches the light. A shape with no thickness is a
 * sticker; one with an edge is an object on a table, which is what the rest
 * of the tabletop lessons have taught the child to expect.
 */

import { direct, place, rod } from './terrain.js';

/** Outlines, in a unit square centred on the origin. */
const OUTLINE = {
  square: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  rectangle: [[-0.7, -0.4], [0.7, -0.4], [0.7, 0.4], [-0.7, 0.4]],
  triangle: [[-0.55, -0.48], [0.55, -0.48], [0, 0.48]],
  diamond: [[0, -0.6], [0.42, 0], [0, 0.6], [-0.42, 0]],
  star: Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.24 : 0.58;
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }),
};

AFRAME.registerComponent('shape', {
  schema: {
    kind: { type: 'string', default: 'circle', oneOf: ['circle', 'oval', ...Object.keys(OUTLINE)] },
    size: { type: 'number', default: 0.2 },
    color: { type: 'color', default: '#e4572e' },
  },

  ...direct,

  parts() {
    const { kind, size, color } = this.data;
    const outline = new THREE.Shape();

    if (kind === 'circle' || kind === 'oval') {
      outline.absellipse(0, 0, kind === 'oval' ? 0.68 : 0.5, kind === 'oval' ? 0.42 : 0.5, 0, Math.PI * 2);
    } else {
      const points = OUTLINE[kind] ?? OUTLINE.square;
      outline.moveTo(...points[0]);
      for (const point of points.slice(1)) outline.lineTo(...point);
      outline.closePath();
    }

    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.16, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2,
      curveSegments: 28,
    });
    geometry.computeBoundingBox();
    const lowest = geometry.boundingBox.min.y;

    this.spots.push({ x: 0, z: 0, r: size * 0.55 });

    // Stood on its lowest point, so every shape rests on the table rather than
    // floating at the height of its own centre.
    return [{
      geometry,
      matrix: place(0, -lowest * size, -0.08 * size, { sx: size, sy: size, sz: size }),
      color,
      shade: [0.82, 1.08],
    }];
  },

  highlightAnchor() {
    return { object3D: this.el.object3D, radius: this.data.size * 0.78, thickness: 0.07 };
  },
});

/** Strokes, as points in a unit square. The pen never lifts. */
const STROKE = {
  standing: [[0, -0.4], [0, 0.4]],
  sleeping: [[-0.4, 0], [0.4, 0]],
  slanting: [[-0.34, -0.38], [0.34, 0.38]],
  zigzag: [[-0.42, -0.2], [-0.21, 0.24], [0, -0.2], [0.21, 0.24], [0.42, -0.2]],
  curve: Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * (1 - i / 12);
    return [Math.cos(a) * 0.38, Math.sin(a) * 0.5 - 0.22];
  }),
  wavy: Array.from({ length: 25 }, (_, i) => [-0.42 + (i / 24) * 0.84, Math.sin((i / 24) * Math.PI * 3) * 0.2]),
};

/** A line drawn on a standing card — thick and raised, like a crayon mark. */
AFRAME.registerComponent('stroke', {
  schema: {
    kind: { type: 'string', default: 'standing', oneOf: Object.keys(STROKE) },
    size: { type: 'number', default: 0.24 },
    ink: { type: 'color', default: '#c8402f' },
    card: { type: 'color', default: '#fbf7ee' },
  },

  ...direct,

  parts() {
    const { kind, size, ink, card } = this.data;
    const points = STROKE[kind] ?? STROKE.standing;
    const parts = [{
      geometry: new THREE.BoxGeometry(size, size, 0.016),
      matrix: place(0, size / 2, 0),
      color: card,
    }];

    const at = ([x, y]) => [x * size, size / 2 + y * size, 0.016];
    const thick = size * 0.045;

    for (let i = 0; i < points.length - 1; i += 1) parts.push(rod(at(points[i]), at(points[i + 1]), thick, ink, 8));
    // A bead at every joint, so corners are round and the ends are not cut off.
    for (const point of points) {
      parts.push({ geometry: new THREE.IcosahedronGeometry(thick, 1), matrix: place(...at(point)), color: ink });
    }

    this.spots.push({ x: 0, z: 0, r: size * 0.5 });
    return parts;
  },

  highlightAnchor() {
    return { object3D: this.el.object3D, radius: this.data.size * 0.8, thickness: 0.07 };
  },
});
