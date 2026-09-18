/**
 * What makes a room a home: somewhere to sleep.
 *
 * One builder file per land.
 *
 * The room, the stove, the almirah and the water pot all already existed — a
 * classroom, a kitchen and an office share them. What none of those rooms has
 * is a bed, and a room with a stove and a cupboard and no bed is a canteen.
 * The charpai is the one object that says "people live here".
 */

import { flatMaterial, mergeParts, place, rod } from './terrain.js';

/**
 * A charpai: a wooden frame on four turned legs, strung with woven rope.
 *
 * A charpai and not a Western bed, because it is what is in these children's
 * homes. The weave is drawn as alternating strips; from across a room that is
 * exactly what woven rope looks like.
 */
AFRAME.registerComponent('charpai', {
  schema: {
    length: { type: 'number', default: 1.9 },
    width: { type: 'number', default: 0.95 },
    height: { type: 'number', default: 0.45 },
    wood: { type: 'color', default: '#7a5230' },
    rope: { type: 'color', default: '#d9c49a' },
    shade: { type: 'color', default: '#c4ab7c' },
    /** A folded quilt at the head. */
    quilt: { type: 'color', default: '#b5483a' },
  },

  init() { this.build(); },
  update() { this.build(); },

  build() {
    const { length: L, width: W, height: H, wood, rope, shade, quilt } = this.data;
    const parts = [];

    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = sx * (W / 2), z = sz * (L / 2);
      parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.03, H + 0.12, 7), matrix: place(x, (H + 0.12) / 2, z), color: wood });
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.055, 0), matrix: place(x, H + 0.13, z), color: wood });
    }

    // The frame: two long rails and two short ones.
    for (const sx of [-1, 1]) parts.push(rod([sx * W / 2, H, -L / 2], [sx * W / 2, H, L / 2], 0.035, wood, 6));
    for (const sz of [-1, 1]) parts.push(rod([-W / 2, H, sz * L / 2], [W / 2, H, sz * L / 2], 0.035, wood, 6));

    // The weave, as strips in two tones.
    const STRIPS = 14;
    for (let i = 0; i < STRIPS; i += 1) {
      parts.push({
        geometry: new THREE.BoxGeometry(W - 0.08, 0.018, (L - 0.1) / STRIPS * 0.92),
        matrix: place(0, H - 0.005, -L / 2 + 0.05 + ((i + 0.5) * (L - 0.1)) / STRIPS),
        color: i % 2 ? rope : shade,
      });
    }

    parts.push({ geometry: new THREE.BoxGeometry(W * 0.8, 0.12, 0.42), matrix: place(0, H + 0.07, -L / 2 + 0.3), color: quilt });
    parts.push({ geometry: new THREE.BoxGeometry(W * 0.62, 0.1, 0.3), matrix: place(0, H + 0.17, -L / 2 + 0.3), color: '#e8dcc0' });

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});

/**
 * One nameable piece of a house: the walls, the roof, a door, a window, steps.
 *
 * `building` makes a whole house as one mesh, which is right for scenery and
 * useless for "Parts of the House" — a lesson cannot ring the roof of a thing
 * that has no separate roof. So this draws each part as its own object, and a
 * lesson stands them together into a house it can take apart by name.
 *
 * The ring for a part is a circle facing the child, drawn round the part —
 * a ring lying on the ground cannot point at a roof.
 */
AFRAME.registerComponent('housepart', {
  schema: {
    kind: { type: 'string', default: 'walls', oneOf: ['walls', 'roof', 'door', 'window', 'steps'] },
    width: { type: 'number', default: 5 },
    height: { type: 'number', default: 2.8 },
    depth: { type: 'number', default: 4 },
    color: { type: 'color', default: '#f0e2c4' },
    trim: { type: 'color', default: '#7a5230' },
  },

  init() {
    this.centre = new THREE.Object3D();
    this.el.object3D.add(this.centre);
    this.build();
  },

  update() { this.build(); },

  build() {
    const { kind, width: w, height: h, depth: d, color, trim } = this.data;
    const parts = [];
    const box = (bw, bh, bd, x, y, z, c) => parts.push({
      geometry: new THREE.BoxGeometry(bw, bh, bd), matrix: place(x, y, z), color: c, shade: [0.88, 1.05],
    });

    if (kind === 'walls') {
      box(w, h, d, 0, h / 2, 0, color);
      box(w + 0.12, 0.35, d + 0.12, 0, 0.175, 0, trim);           // plinth band
    } else if (kind === 'roof') {
      // A prism from its corners: two slopes and two gable ends.
      const x = w / 2, z = d / 2;
      const tri = (pts, c) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
        parts.push({ geometry: g, color: c });
      };
      tri([[-x, 0, z], [x, 0, z], [x, h, 0], [-x, 0, z], [x, h, 0], [-x, h, 0]], color);
      tri([[x, 0, -z], [-x, 0, -z], [-x, h, 0], [x, 0, -z], [-x, h, 0], [x, h, 0]], color);
      tri([[-x, 0, -z], [-x, 0, z], [-x, h, 0]], trim);
      tri([[x, 0, z], [x, 0, -z], [x, h, 0]], trim);
    } else if (kind === 'door') {
      box(w + 0.16, h + 0.08, 0.06, 0, (h + 0.08) / 2, -0.02, trim);
      box(w, h, 0.07, 0, h / 2, 0.01, color);
      box(0.07, 0.07, 0.06, w * 0.34, h * 0.5, 0.07, '#c9a227');  // the handle
    } else if (kind === 'window') {
      box(w + 0.16, h + 0.16, 0.06, 0, 0, -0.02, trim);
      box(w, h, 0.05, 0, 0, 0.0, color);
      box(0.06, h, 0.07, 0, 0, 0.02, trim);
      box(w, 0.06, 0.07, 0, 0, 0.02, trim);
    } else {
      box(w, h / 2, d, 0, h / 4, 0, color);
      box(w, h / 2, d / 2, 0, h * 0.75, -d / 4, color);
    }

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));

    // A window is centred on its own origin; everything else stands on it.
    this.centre.position.set(0, kind === 'window' ? 0 : h / 2, 0.1);
  },

  highlightAnchor() {
    const { width, height, kind } = this.data;
    const reach = kind === 'walls' || kind === 'roof' ? Math.max(width, height) * 0.56 : Math.max(width, height) * 0.78;
    return { object3D: this.centre, radius: reach, thickness: 0.035, billboard: true, opacity: 0.9 };
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});
