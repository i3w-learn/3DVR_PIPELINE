/**
 * People.
 *
 * Built, because the free libraries have a farmer in dungarees and a police
 * officer in an American uniform, and a child in an Anganwadi has met neither.
 * Here the police wear khaki, the farmer wears a turban and the teacher wears
 * a saree — and every figure is the same friendly toy, so nobody is more
 * "real" than anybody else.
 *
 * One function draws the figure as named groups of parts. `person` merges all
 * of them into one mesh. `bodypart` merges one group, so a lesson can stand
 * eight of them on the same spot and ring the nose without ringing the child.
 */

import { direct, flatMaterial, mergeParts, place, rod } from './terrain.js';

const SKIN = '#c58a5c';
const HAIR = '#1d1613';
const KHAKI = '#b79c62';

const ROLES = {
  child: { top: '#e8b23a', bottom: '#2f5f9a', shorts: true },
  girl: { top: '#d9487a', bottom: '#d9487a', frock: true, hair: 'plaits' },
  man: { top: '#5b8fc7', bottom: '#4a4f5c' },
  woman: { top: '#2f8f7a', bottom: '#2f8f7a', saree: '#e2b33c', hair: 'bun' },
  doctor: { top: '#f5f7f8', bottom: '#3d4a5c', coat: '#f5f7f8', item: 'stethoscope' },
  nurse: { top: '#f5f7f8', bottom: '#f5f7f8', frock: true, hat: 'nursecap', hair: 'bun' },
  teacher: { top: '#a8456a', bottom: '#a8456a', saree: '#e7c15a', hair: 'bun', item: 'book' },
  police: { top: KHAKI, bottom: KHAKI, hat: 'peak', hatColor: KHAKI, belt: true },
  farmer: { top: '#f1ece0', bottom: '#f1ece0', hat: 'turban', hatColor: '#d9483b', item: 'spade' },
  firefighter: { top: '#c8402f', bottom: '#2b2f38', coat: '#c8402f', stripes: true, hat: 'helmet', hatColor: '#f0c52e' },
  postman: { top: KHAKI, bottom: '#8a7444', hat: 'peak', hatColor: '#8a7444', item: 'letter', bag: true },
  soldier: { top: '#5c6b3e', bottom: '#5c6b3e', hat: 'beret', hatColor: '#7a2f2f', belt: true },
  driver: { top: '#e9ecef', bottom: '#2f3a4a', hat: 'peak', hatColor: '#2f3a4a' },
  chef: { top: '#f5f7f8', bottom: '#3a3f48', hat: 'toque', hatColor: '#f5f7f8' },
  queen: { top: '#7a3fa0', bottom: '#7a3fa0', saree: '#e2b33c', hair: 'bun', hat: 'crown', hatColor: '#e9b92f' },
  pilot: { top: '#22324f', bottom: '#22324f', hat: 'peak', hatColor: '#f1f3f5', belt: true },
};

/**
 * @returns {{groups: Record<string, object[]>, centres: Record<string, [number, number, number, number]>}}
 *   parts by body part, and for each part where its middle is and how far it reaches.
 */
function figure({ height: h, role, skin, pose }) {
  const look = ROLES[role] ?? ROLES.child;
  const young = ['child', 'girl'].includes(role);
  const R = h * (young ? 0.128 : 0.098);            // head radius: children are mostly head
  const neckTop = h * (young ? 0.72 : 0.79);
  const headY = neckTop + R * 0.86;
  const shoulderY = neckTop - h * 0.045;
  const hipY = h * (young ? 0.4 : 0.46);
  const bare = look.shorts || look.frock;

  const groups = {};
  const put = (group, part) => (groups[group] ??= []).push(part);
  const ball = (group, r, x, y, z, color, o = {}, shade = [0.78, 1.05]) =>
    put(group, { geometry: new THREE.IcosahedronGeometry(r, 2), matrix: place(x, y, z, o), color, shade });
  const tube = (group, from, to, r, color, sides = 8) => put(group, { ...rod(from, to, r, color, sides), shade: [0.82, 1.04] });

  // Legs and feet.
  for (const s of [-1, 1]) {
    const hip = [s * h * 0.065, hipY, 0], ankle = [s * h * 0.07, h * 0.045, 0];
    if (look.shorts) {
      const knee = [s * h * 0.068, hipY * 0.55, 0];
      tube('legs', hip, knee, h * 0.056, look.bottom);
      tube('legs', knee, ankle, h * 0.042, skin);
    } else {
      tube('legs', hip, ankle, h * (bare ? 0.04 : 0.052), bare ? skin : look.bottom);
    }
    ball('feet', 1, s * h * 0.07, h * 0.03, h * 0.028, '#3a2c24', { sx: h * 0.05, sy: h * 0.03, sz: h * 0.085 });
  }

  // The body: a slightly tapered trunk, with rounded shoulders on top.
  put('tummy', {
    geometry: new THREE.CylinderGeometry(h * 0.115, h * 0.125, shoulderY - hipY + h * 0.02, 12),
    matrix: place(0, (shoulderY + hipY) / 2, 0, { sz: 0.78 }), color: look.top, shade: [0.8, 1.05],
  });
  ball('shoulders', 1, 0, shoulderY, 0, look.top, { sx: h * 0.165, sy: h * 0.055, sz: h * 0.095 });

  // Anything that hangs from the waist or the shoulders.
  const skirt = (from, to, top, bottom, color, group = 'tummy') => put(group, {
    geometry: new THREE.CylinderGeometry(top, bottom, from - to, 14, 1, true),
    matrix: place(0, (from + to) / 2, 0, { sz: 0.8 }), color, shade: [0.76, 1.05],
  });
  if (look.frock) skirt(hipY + h * 0.06, hipY * 0.52, h * 0.125, h * 0.21, look.bottom);
  if (look.saree) {
    skirt(hipY + h * 0.05, h * 0.06, h * 0.125, h * 0.2, look.bottom);
    // The pallu: a band from the right hip up over the left shoulder.
    put('tummy', { ...rod([h * 0.11, hipY + h * 0.02, h * 0.085], [-h * 0.13, shoulderY + h * 0.02, h * 0.06], h * 0.04, look.saree, 6), shade: [0.85, 1.05] });
    put('tummy', { ...rod([-h * 0.13, shoulderY + h * 0.02, h * 0.05], [-h * 0.12, hipY + h * 0.1, -h * 0.09], h * 0.04, look.saree, 6), shade: [0.85, 1.05] });
  }
  if (look.coat) skirt(shoulderY - h * 0.03, hipY * 0.72, h * 0.13, h * 0.16, look.coat);
  if (look.belt) put('tummy', { geometry: new THREE.CylinderGeometry(h * 0.129, h * 0.129, h * 0.03, 12), matrix: place(0, hipY + h * 0.035, 0, { sz: 0.8 }), color: '#3a2c24' });
  if (look.stripes) {
    for (const y of [hipY * 0.8, (shoulderY + hipY) / 2]) {
      put('tummy', { geometry: new THREE.CylinderGeometry(h * 0.15, h * 0.155, h * 0.025, 14), matrix: place(0, y, 0, { sz: 0.82 }), color: '#f0e04a' });
    }
  }

  // Arms. Down by the sides, unless the pose says otherwise.
  const hands = {};
  for (const s of [-1, 1]) {
    const shoulder = [s * h * 0.16, shoulderY - h * 0.01, 0];
    let elbow = [s * h * 0.195, shoulderY - h * 0.15, h * 0.01];
    let hand = [s * h * 0.2, hipY - h * 0.015, h * 0.035];

    if (pose === 'namaste') {
      elbow = [s * h * 0.2, shoulderY - h * 0.16, h * 0.05];
      hand = [s * h * 0.018, shoulderY - h * 0.08, h * 0.15];
    } else if (pose === 'wave' && s === 1) {
      elbow = [h * 0.27, shoulderY + h * 0.02, h * 0.02];
      hand = [h * 0.31, shoulderY + h * 0.2, h * 0.03];
    } else if ((look.item === 'letter' || look.item === 'book') && s === 1) {
      elbow = [h * 0.2, shoulderY - h * 0.15, h * 0.04];
      hand = [h * 0.15, shoulderY - h * 0.17, h * 0.2];
    }

    const sleeve = young || look.shorts ? skin : look.coat ?? look.top;
    tube('arms', shoulder, elbow, h * 0.04, young ? look.top : sleeve, 7);
    tube('arms', elbow, hand, h * 0.035, sleeve, 7);
    ball('hands', h * 0.043, ...hand, skin);
    hands[s] = hand;
  }

  // Neck and head.
  tube('neck', [0, shoulderY, 0], [0, neckTop + R * 0.1, 0], h * 0.036, skin);
  ball('head', R, 0, headY, 0, skin, {}, [0.86, 1.04]);
  for (const s of [-1, 1]) {
    ball('ears', 1, s * R * 0.97, headY - R * 0.02, -R * 0.02, skin, { sx: R * 0.13, sy: R * 0.22, sz: R * 0.16 }, [0.8, 1]);
    ball('eyes', R * 0.15, s * R * 0.37, headY + R * 0.12, R * 0.86, '#fbfbf8', { sz: 0.6 }, [1, 1]);
    ball('eyes', R * 0.085, s * R * 0.37, headY + R * 0.12, R * 0.95, '#201815', { sz: 0.6 }, [1, 1]);
  }
  ball('nose', R * 0.115, 0, headY - R * 0.1, R * 0.98, '#b0764c', {}, [0.9, 1.05]);
  put('mouth', {
    geometry: new THREE.TorusGeometry(R * 0.3, R * 0.045, 5, 12, Math.PI),
    matrix: place(0, headY - R * 0.3, R * 0.86, { rz: Math.PI, rx: 0.32 }), color: '#9c3b3b',
  });

  // Hair: a cap tipped back off the forehead.
  put('hair', {
    geometry: new THREE.SphereGeometry(R * 1.07, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    matrix: place(0, headY + R * 0.02, -R * 0.03, { rx: -0.5 }), color: HAIR, shade: [0.9, 1.3],
  });
  const style = look.hair;
  if (style === 'bun') ball('hair', R * 0.42, 0, headY + R * 0.25, -R * 1.02, HAIR, {}, [0.9, 1.3]);
  if (style === 'plaits') {
    for (const s of [-1, 1]) {
      tube('hair', [s * R * 0.85, headY - R * 0.15, -R * 0.3], [s * R * 1.0, headY - R * 1.55, -R * 0.12], R * 0.17, HAIR, 6);
      ball('hair', R * 0.17, s * R * 1.0, headY - R * 1.6, -R * 0.12, '#d9362b', {}, [1, 1]);
    }
  }

  // Hats.
  const hat = look.hat, hc = look.hatColor;
  if (hat === 'peak') {
    put('hat', { geometry: new THREE.CylinderGeometry(R * 1.0, R * 1.04, R * 0.42, 16), matrix: place(0, headY + R * 0.78, 0), color: hc, shade: [0.8, 1.05] });
    put('hat', { geometry: new THREE.CylinderGeometry(R * 1.12, R * 1.0, R * 0.16, 16), matrix: place(0, headY + R * 1.05, 0), color: hc, shade: [0.9, 1.08] });
    ball('hat', 1, 0, headY + R * 0.6, R * 0.95, '#2a2522', { sx: R * 0.72, sy: R * 0.05, sz: R * 0.5 });
  } else if (hat === 'turban') {
    put('hat', { geometry: new THREE.TorusGeometry(R * 0.82, R * 0.36, 8, 18), matrix: place(0, headY + R * 0.74, -R * 0.04, { rx: Math.PI / 2 + 0.16 }), color: hc, shade: [0.78, 1.06] });
    ball('hat', 1, 0, headY + R * 1.06, -R * 0.06, hc, { sx: R * 0.78, sy: R * 0.42, sz: R * 0.78 });
  } else if (hat === 'helmet') {
    put('hat', { geometry: new THREE.SphereGeometry(R * 1.12, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), matrix: place(0, headY + R * 0.18, 0), color: hc, shade: [0.82, 1.1] });
    put('hat', { geometry: new THREE.CylinderGeometry(R * 1.42, R * 1.42, R * 0.07, 18), matrix: place(0, headY + R * 0.22, -R * 0.12), color: hc, shade: [0.8, 1] });
  } else if (hat === 'beret') {
    ball('hat', 1, R * 0.12, headY + R * 0.82, 0, hc, { sx: R * 1.02, sy: R * 0.3, sz: R * 0.98 });
  } else if (hat === 'toque') {
    put('hat', { geometry: new THREE.CylinderGeometry(R * 0.78, R * 0.74, R * 0.9, 14), matrix: place(0, headY + R * 1.2, 0), color: hc, shade: [0.86, 1.04] });
    ball('hat', 1, 0, headY + R * 1.75, 0, hc, { sx: R * 0.98, sy: R * 0.5, sz: R * 0.98 }, [0.88, 1.04]);
  } else if (hat === 'crown') {
    put('hat', { geometry: new THREE.CylinderGeometry(R * 0.7, R * 0.62, R * 0.32, 14, 1, true), matrix: place(0, headY + R * 0.95, 0), color: hc, shade: [0.85, 1.1] });
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      put('hat', { geometry: new THREE.ConeGeometry(R * 0.13, R * 0.36, 4), matrix: place(Math.sin(a) * R * 0.68, headY + R * 1.27, Math.cos(a) * R * 0.68), color: hc, shade: [0.9, 1.12] });
    }
    ball('hat', R * 0.09, 0, headY + R * 0.97, R * 0.68, '#d9362b', {}, [1, 1]);
  } else if (hat === 'nursecap') {
    put('hat', { geometry: new THREE.BoxGeometry(R * 1.2, R * 0.42, R * 0.5), matrix: place(0, headY + R * 0.98, R * 0.1), color: '#f8fafb' });
    put('hat', { geometry: new THREE.BoxGeometry(R * 0.3, R * 0.09, 0.01), matrix: place(0, headY + R * 0.98, R * 0.36), color: '#d9362b' });
    put('hat', { geometry: new THREE.BoxGeometry(R * 0.09, R * 0.3, 0.01), matrix: place(0, headY + R * 0.98, R * 0.36), color: '#d9362b' });
  }

  // What they carry.
  const right = hands[1];
  if (look.item === 'stethoscope') {
    put('item', { geometry: new THREE.TorusGeometry(h * 0.085, h * 0.009, 5, 16), matrix: place(0, shoulderY - h * 0.05, h * 0.045, { rx: Math.PI / 2 - 0.75 }), color: '#2b2f38' });
    tube('item', [0, shoulderY - h * 0.11, h * 0.105], [h * 0.02, shoulderY - h * 0.2, h * 0.115], h * 0.008, '#2b2f38', 5);
    put('item', { geometry: new THREE.CylinderGeometry(h * 0.024, h * 0.024, h * 0.012, 12), matrix: place(h * 0.02, shoulderY - h * 0.21, h * 0.118, { rx: Math.PI / 2 }), color: '#c9ced4' });
  } else if (look.item === 'book') {
    put('item', { geometry: new THREE.BoxGeometry(h * 0.11, h * 0.145, h * 0.028), matrix: place(right[0] - h * 0.03, right[1] + h * 0.02, right[2] + h * 0.03, { rx: -0.35 }), color: '#2f5f9a' });
  } else if (look.item === 'letter') {
    put('item', { geometry: new THREE.BoxGeometry(h * 0.13, h * 0.085, h * 0.006), matrix: place(right[0], right[1] + h * 0.035, right[2] + h * 0.035, { rx: -0.5 }), color: '#fbf8ee' });
  } else if (look.item === 'spade') {
    const x = right[0] + h * 0.035, z = right[2] + h * 0.03;
    tube('item', [x, h * 0.1, z], [x, h * 0.86, z], h * 0.013, '#7a5a3c', 6);
    put('item', { geometry: new THREE.BoxGeometry(h * 0.12, h * 0.15, h * 0.012), matrix: place(x, h * 0.085, z), color: '#8d949b' });
  }
  if (look.bag) {
    put('item', { geometry: new THREE.BoxGeometry(h * 0.06, h * 0.13, h * 0.17), matrix: place(-h * 0.17, hipY + h * 0.02, h * 0.01), color: '#6d4a2c', shade: [0.8, 1.05] });
    tube('item', [h * 0.12, shoulderY + h * 0.02, 0], [-h * 0.16, hipY + h * 0.08, h * 0.02], h * 0.012, '#6d4a2c', 5);
  }

  // Where each part is, for the ring: x, y, z of its middle, and its reach.
  const centres = {
    head: [0, headY, 0, R * 1.35], hair: [0, headY + R * 0.75, 0, R * 1.0], eyes: [0, headY + R * 0.12, R, R * 0.6],
    ears: [0, headY - R * 0.02, 0, R * 1.3], nose: [0, headY - R * 0.1, R, R * 0.3], mouth: [0, headY - R * 0.42, R, R * 0.48],
    neck: [0, (shoulderY + neckTop) / 2, 0, h * 0.07], shoulders: [0, shoulderY, 0, h * 0.2],
    arms: [0, shoulderY - h * 0.14, 0, h * 0.27], hands: [0, hipY - h * 0.015, h * 0.035, h * 0.27],
    tummy: [0, (shoulderY + hipY) / 2, h * 0.05, h * 0.15], legs: [0, hipY * 0.55, 0, h * 0.17], feet: [0, h * 0.03, h * 0.03, h * 0.15],
  };

  return { groups, centres };
}

const SCHEMA = {
  height: { type: 'number', default: 1.6 },
  role: { type: 'string', default: 'child' },
  skin: { type: 'color', default: SKIN },
  pose: { type: 'string', default: 'stand', oneOf: ['stand', 'namaste', 'wave'] },
};

AFRAME.registerComponent('person', {
  schema: SCHEMA,

  ...direct,

  parts() {
    this.spots.push({ x: 0, z: 0, r: this.data.height * 0.2 });
    return Object.values(figure(this.data).groups).flat();
  },

  highlightAnchor() {
    return { radius: this.data.height * 0.3, thickness: 0.06 };
  },
});

/**
 * One part of a figure, on its own entity, so it can be ringed and named.
 *
 * `rest` is everything the lesson does not name separately — give it the list
 * in `except` and it draws the remainder, so the parts add up to one child and
 * nothing is drawn twice.
 */
AFRAME.registerComponent('bodypart', {
  schema: {
    ...SCHEMA,
    kind: { type: 'string', default: 'head' },
    except: { type: 'array', default: [] },
  },

  init() {
    this.centre = new THREE.Object3D();
    this.el.object3D.add(this.centre);
    this.build();
  },

  update() { this.build(); },

  build() {
    const { kind, except, height } = this.data;
    const { groups, centres } = figure(this.data);

    const parts = kind === 'rest'
      ? Object.entries(groups).filter(([name]) => !except.includes(name)).flatMap(([, list]) => list)
      : groups[kind] ?? [];
    // Parts nobody asked for still have to free their geometry.
    for (const [name, list] of Object.entries(groups)) {
      if (kind === 'rest' ? except.includes(name) : name !== kind) list.forEach((part) => part.geometry.dispose());
    }

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(parts), flatMaterial()));

    const [x, y, z, reach] = kind === 'rest' ? [0, height * 0.5, 0, height * 0.62] : centres[kind] ?? [0, height * 0.5, 0, height * 0.3];
    this.centre.position.set(x, y, z);
    this.reach = reach;
  },

  highlightAnchor() {
    return { object3D: this.centre, radius: this.reach, thickness: this.data.kind === 'rest' ? 0.018 : 0.06, billboard: true, opacity: 0.95 };
  },

  remove() {
    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.removeObject3D('mesh');
  },
});
