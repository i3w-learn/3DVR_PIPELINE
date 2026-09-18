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
