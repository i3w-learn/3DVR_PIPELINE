/**
 * Plants: the parts of one, a seed becoming one, and the flowers a child here
 * actually sees — lotus, marigold, hibiscus, jasmine — plus a mango.
 *
 * The plant is drawn in a block of soil with the front cut away, because the
 * first thing the lesson has to say is "there is a part you cannot see".
 */

import { direct, flatMaterial, mergeParts, place, rod } from './terrain.js';

const SOIL = '#6b4a30';
const STEM = '#3f8f45';
const LEAF = '#4aa052';

const ball = (rx, ry, rz, x, y, z, color, o = {}, shade = [0.78, 1.06]) => ({
  geometry: new THREE.IcosahedronGeometry(1, 2), matrix: place(x, y, z, { sx: rx, sy: ry, sz: rz, ...o }), color, shade,
});

/** A leaf: a flattened ball, tilted up and out from where it joins the stem. */
function leaf(parts, x, y, z, angle, len, color = LEAF) {
  const dx = Math.sin(angle), dz = Math.cos(angle);
  parts.push(ball(len * 0.3, len * 0.04, len * 0.5, x + dx * len * 0.5, y + len * 0.16, z + dz * len * 0.5, color, { ry: angle, rx: -0.35 }, [0.85, 1.08]));
}

/** A cutaway block of soil. Roots are drawn on its front face, in front of the brown. */
function soilBlock(parts, w, h, d) {
  parts.push({ geometry: new THREE.BoxGeometry(w, h, d), matrix: place(0, h / 2, 0), color: SOIL, shade: [0.72, 1.0] });
  parts.push({ geometry: new THREE.BoxGeometry(w * 1.02, h * 0.1, d * 1.04), matrix: place(0, h * 0.97, 0), color: '#5a8f3c', shade: [0.9, 1.05] });
}

function plant(h) {
  const w = h * 0.8, sh = h * 0.42, d = h * 0.3, front = d / 2 + h * 0.006, top = sh;
  const groups = { soil: [], roots: [], stem: [], leaves: [], flower: [], fruit: [] };

  soilBlock(groups.soil, w, sh, d);

  // Roots: a tap root and side roots, pale against the soil.
  const root = (a, b, r) => groups.roots.push({ ...rod(a, b, r, '#e9dcc0', 5), shade: [0.9, 1.05] });
  root([0, top, front], [0, top * 0.18, front], h * 0.016);
  for (const [y, dx, dy] of [[0.78, -0.26, -0.22], [0.72, 0.24, -0.26], [0.52, -0.2, -0.24], [0.46, 0.22, -0.2], [0.3, -0.12, -0.16], [0.28, 0.13, -0.14]]) {
    root([0, top * y, front], [dx * h, top * y + dy * h, front], h * 0.009);
  }

  const stemTop = top + h;
  groups.stem.push({ ...rod([0, top, 0], [0, stemTop, 0], h * 0.022, STEM, 7), shade: [0.85, 1.05] });

  for (const [y, angle, len] of [[0.22, 0.9, 0.3], [0.36, -2.2, 0.32], [0.52, 2.4, 0.28], [0.66, -0.7, 0.26]]) leaf(groups.leaves, 0, top + h * y, 0, angle, h * len);

  // The flower, face to the child.
  const fy = stemTop + h * 0.02, fz = h * 0.03;
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    groups.flower.push(ball(h * 0.05, h * 0.085, h * 0.014, Math.sin(a) * h * 0.105, fy + Math.cos(a) * h * 0.105, fz, '#e8476a', { rz: -a }, [0.9, 1.06]));
  }
  groups.flower.push(ball(h * 0.06, h * 0.06, h * 0.03, 0, fy, fz + h * 0.012, '#f0c52e', {}, [0.9, 1.05]));

  // A fruit, hanging from a short side branch.
  groups.fruit.push({ ...rod([0, top + h * 0.44, 0], [h * 0.2, top + h * 0.5, h * 0.06], h * 0.012, STEM, 5) });
  groups.fruit.push(ball(h * 0.085, h * 0.08, h * 0.085, h * 0.22, top + h * 0.4, h * 0.07, '#d9362b', {}, [0.78, 1.08]));
  groups.fruit.push(ball(h * 0.03, h * 0.01, h * 0.03, h * 0.22, top + h * 0.478, h * 0.07, STEM, {}, [1, 1]));

  const centres = {
    soil: [0, top * 0.5, 0, w * 0.6], roots: [0, top * 0.5, front, h * 0.3], stem: [0, top + h * 0.5, 0, h * 0.5],
    leaves: [0, top + h * 0.45, 0, h * 0.42], flower: [0, fy, fz, h * 0.2], fruit: [h * 0.22, top + h * 0.41, h * 0.07, h * 0.13],
  };
  return { groups, centres };
}

AFRAME.registerComponent('plantpart', {
  schema: {
    kind: { type: 'string', default: 'stem', oneOf: ['soil', 'roots', 'stem', 'leaves', 'flower', 'fruit'] },
    height: { type: 'number', default: 0.5 },
  },

  init() {
    this.centre = new THREE.Object3D();
    this.el.object3D.add(this.centre);
    this.build();
  },

  update() { this.build(); },

  build() {
    const { groups, centres } = plant(this.data.height);
    for (const [name, list] of Object.entries(groups)) if (name !== this.data.kind) list.forEach((p) => p.geometry.dispose());

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(groups[this.data.kind]), flatMaterial()));

    const [x, y, z, reach] = centres[this.data.kind];
    this.centre.position.set(x, y, z);
    this.reach = reach;
  },

  highlightAnchor() {
    return { object3D: this.centre, radius: this.reach, thickness: 0.05, billboard: true, opacity: 0.95 };
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});

/**
 * A seed becoming a plant, one stage at a time.
 *
 * Five small soil blocks rather than one that changes: the sequence template
 * lays stages out left to right, so a child can look back at what it was.
 */
AFRAME.registerComponent('sprout', {
  schema: {
    stage: { type: 'number', default: 1 },
    size: { type: 'number', default: 0.2 },
  },

  ...direct,

  parts() {
    const { stage, size: s } = this.data;
    const parts = [];
    const h = s * 0.7, d = s * 0.6, front = d / 2 + s * 0.006, top = h;
    this.spots.push({ x: 0, z: 0, r: s * 0.62 });

    soilBlock(parts, s, h, d);

    const seedY = top * 0.66;
    const root = (a, b, r) => parts.push({ ...rod(a, b, r, '#efe3c6', 5), shade: [0.95, 1.05] });
    // The seed is there at every stage until the plant has used it up.
    if (stage <= 4) parts.push(ball(s * (stage === 1 ? 0.075 : 0.09), s * 0.055, s * 0.03, 0, seedY, front, '#c9a05a', { rz: 0.3 }, [0.9, 1.05]));
    if (stage >= 2) root([0, seedY, front], [s * 0.02, seedY - s * (stage === 2 ? 0.12 : 0.3), front], s * 0.012);
    if (stage >= 4) for (const dx of [-0.14, 0.13]) root([0, seedY - s * 0.14, front], [dx * s, seedY - s * 0.28, front], s * 0.008);
    if (stage >= 5) for (const dx of [-0.2, 0.19]) root([0, seedY - s * 0.06, front], [dx * s, seedY - s * 0.2, front], s * 0.008);

    if (stage >= 3) {
      const up = [0, 0, 0.22, 0.5, 1.0][stage - 1] * s;
      parts.push({ ...rod([0, seedY, front], [0, top + up, front * (stage === 3 ? 1 : 0.6)], s * 0.016, stage === 3 ? '#cfe3a0' : STEM, 6) });
      const z = front * (stage === 3 ? 1 : 0.6);
      if (stage === 3) parts.push(ball(s * 0.035, s * 0.03, s * 0.03, 0, top + up, z, '#9ccf6a', {}, [1, 1]));
      if (stage >= 4) for (const a of [Math.PI / 2, -Math.PI / 2]) leaf(parts, 0, top + up - s * 0.02, z, a, s * (stage === 4 ? 0.26 : 0.34));
      if (stage >= 5) for (const a of [0.4, Math.PI + 0.4]) leaf(parts, 0, top + up * 0.55, z, a, s * 0.3);
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.size * 0.75, thickness: 0.05 }; },
});

/** Flowers a child in India sees. Each stands in a small pot, to the same height. */
AFRAME.registerComponent('flower', {
  schema: {
    kind: { type: 'string', default: 'marigold', oneOf: ['lotus', 'marigold', 'hibiscus', 'jasmine'] },
    height: { type: 'number', default: 0.34 },
  },

  ...direct,

  parts() {
    const { kind, height: h } = this.data;
    const parts = [];
    this.spots.push({ x: 0, z: 0, r: h * 0.4 });

    const petals = (count, at, y, len, wide, color, tilt, turn = 0, cx = 0, cz = 0) => {
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + turn;
        parts.push(ball(wide, len * 0.12, len, cx + Math.sin(a) * at, y + Math.sin(tilt) * len * 0.5, cz + Math.cos(a) * at, color, { ry: a, rx: -tilt }, [0.82, 1.08]));
      }
    };

    if (kind === 'lotus') {
      // No pot: a lotus sits on its own leaf, on water.
      parts.push({ geometry: new THREE.CylinderGeometry(h * 0.62, h * 0.62, h * 0.025, 20), matrix: place(0, h * 0.012, 0), color: '#2f7d4a', shade: [1, 1.05] });
      petals(8, h * 0.24, h * 0.06, h * 0.26, h * 0.11, '#f4a8c4', 0.45);
      petals(8, h * 0.15, h * 0.12, h * 0.24, h * 0.095, '#ee7fa8', 0.9, Math.PI / 8);
      petals(6, h * 0.07, h * 0.18, h * 0.2, h * 0.075, '#e85f93', 1.25);
      parts.push(ball(h * 0.075, h * 0.06, h * 0.075, 0, h * 0.2, 0, '#f0c52e', {}, [0.9, 1.05]));
      return parts;
    }

    // Pot, stem, two leaves — then the bloom.
    parts.push({ geometry: new THREE.CylinderGeometry(h * 0.2, h * 0.14, h * 0.26, 14), matrix: place(0, h * 0.13, 0), color: '#b5623a', shade: [0.75, 1.05] });
    parts.push({ geometry: new THREE.CylinderGeometry(h * 0.18, h * 0.18, h * 0.02, 14), matrix: place(0, h * 0.26, 0), color: SOIL });
    const top = h * 0.86;
    parts.push({ ...rod([0, h * 0.26, 0], [0, top, 0], h * 0.018, STEM, 6) });
    leaf(parts, 0, h * 0.42, 0, 1.2, h * 0.3); leaf(parts, 0, h * 0.54, 0, -1.9, h * 0.28);

    if (kind === 'marigold') {
      parts.push({ geometry: new THREE.IcosahedronGeometry(h * 0.15, 2), matrix: place(0, top + h * 0.05, 0, { sy: 0.72 }), color: '#f08a1c', shade: [0.8, 1.1], lumpy: 0.22 });
      petals(14, h * 0.13, top + h * 0.0, h * 0.09, h * 0.04, '#f6a623', 0.25);
    } else if (kind === 'hibiscus') {
      petals(5, h * 0.13, top, h * 0.19, h * 0.12, '#d9262b', 0.55);
      parts.push({ ...rod([0, top, 0], [0, top + h * 0.26, h * 0.06], h * 0.012, '#f0c52e', 5) });
      parts.push(ball(h * 0.03, h * 0.03, h * 0.03, 0, top + h * 0.27, h * 0.062, '#f6d743', {}, [1, 1]));
    } else {
      // Jasmine: a little spray of small white stars.
      for (const [x, y, z] of [[0, 0.04, 0], [-0.13, -0.04, 0.05], [0.13, -0.02, 0.04], [0.02, -0.09, 0.12]]) {
        if (x || z) parts.push({ ...rod([0, top - h * 0.12, 0], [x * h, top + y * h, z * h], h * 0.009, STEM, 4) });
        petals(6, h * 0.05, top + y * h, h * 0.075, h * 0.032, '#fbfbf6', 0.5, 0, x * h, z * h);
        parts.push(ball(h * 0.02, h * 0.02, h * 0.02, x * h, top + y * h + h * 0.03, z * h, '#f0d45a', {}, [1, 1]));
      }
    }

    return parts;
  },

  highlightAnchor() { return { radius: this.data.height * 0.6, thickness: 0.05 }; },
});

AFRAME.registerComponent('mango', {
  schema: { size: { type: 'number', default: 0.2 } },

  ...direct,

  parts() {
    const s = this.data.size;
    this.spots.push({ x: 0, z: 0, r: s * 0.5 });

    return [
      // Fatter at the shoulder, drawn in to a point at the bottom — two balls do it.
      ball(s * 0.4, s * 0.42, s * 0.34, s * 0.02, s * 0.56, 0, '#f2b631', { rz: 0.25 }, [0.85, 1.12]),
      ball(s * 0.3, s * 0.36, s * 0.27, -s * 0.06, s * 0.36, 0, '#f0a128', { rz: 0.5 }, [0.8, 1.05]),
      ball(s * 0.16, s * 0.12, s * 0.15, s * 0.16, s * 0.8, 0, '#e8683a', {}, [1, 1.05]),
      { ...rod([s * 0.1, s * 0.92, 0], [s * 0.14, s * 1.06, 0], s * 0.025, '#5a4228', 5) },
      ball(s * 0.12, s * 0.015, s * 0.22, s * 0.3, s * 1.04, 0, LEAF, { rz: -0.4 }, [1, 1]),
    ];
  },

  highlightAnchor() { return { radius: this.data.size * 0.7, thickness: 0.05 }; },
});
