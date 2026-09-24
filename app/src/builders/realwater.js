/**
 * Water that looks like water, and a far tree line that looks like trees.
 *
 * The first pond and river were flat blue sheets with block trees round them,
 * and beside the programme's own farm — scanned trees, a real sky — they looked
 * like a different product. These two components are the fix:
 *
 * - `waterbody` is one flat sheet. What makes it water is that it mirrors the
 *   sky it sits under (the land's captured sky is already the scene's
 *   environment map) and that its surface is never still: a ripple pattern
 *   drifts across it as a normal map, so the reflection shivers.
 * - `treeline` is the far forest: one real tree, thinned for distance, drawn
 *   many times in a single batch. Solid from every side — see its own note.
 */

import { seeded } from './random.js';

/**
 * A ripple pattern that tiles, drawn once.
 *
 * Summed waves with whole-number frequencies, so the left edge meets the right
 * and the top meets the bottom; the slope of that height field is the normal
 * map. Drawn rather than downloaded: it is arithmetic, not an asset.
 */
let ripples = null;

function rippleTexture() {
  if (ripples) return ripples;

  const SIZE = 256;
  const random = seeded(7);
  const waves = Array.from({ length: 16 }, () => ({
    kx: Math.round((random() - 0.5) * 22), ky: Math.round((random() - 0.5) * 22) || 1,
    phase: random() * Math.PI * 2, height: 0.35 + random() * 0.65,
  }));

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(SIZE, SIZE);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const slope = Math.cos(((x * w.kx + y * w.ky) / SIZE) * Math.PI * 2 + w.phase) * w.height;
        dx += slope * w.kx; dy += slope * w.ky;
      }
      const n = new THREE.Vector3(-dx * 0.016, -dy * 0.016, 1).normalize();
      const i = (y * SIZE + x) * 4;
      image.data[i] = (n.x * 0.5 + 0.5) * 255; image.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      image.data[i + 2] = (n.z * 0.5 + 0.5) * 255; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ripples = new THREE.CanvasTexture(canvas);
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
  return ripples;
}

AFRAME.registerComponent('waterbody', {
  schema: {
    /** `pond` is an ellipse; `river` is a long strip across the view. */
    shape: { type: 'string', default: 'pond', oneOf: ['pond', 'river'] },
    radius: { type: 'number', default: 7.5 },
    stretch: { type: 'number', default: 1.7 },
    length: { type: 'number', default: 160 },
    width: { type: 'number', default: 9 },
    color: { type: 'color', default: '#24545c' },
    /** Metres a second the ripples drift. A pond breathes; a river goes somewhere. */
    flow: { type: 'number', default: 0.05 },
    mud: { type: 'color', default: '#5f5138' },
  },

  init() {
    const { shape, radius, stretch, length, width, color, mud } = this.data;
    const river = shape === 'river';

    // The bank: wet earth shelving down to the water, a little proud of the
    // grass, so the water has an edge and does not just stop.
    const bankShape = river ? new THREE.PlaneGeometry(length, width * 1.16) : new THREE.CircleGeometry(radius * 1.06, 56);
    bankShape.rotateX(-Math.PI / 2);
    if (!river) bankShape.scale(stretch, 1, 1);
    const bank = new THREE.Mesh(bankShape, new THREE.MeshStandardMaterial({ color: mud, roughness: 1 }));
    bank.position.y = 0.035;
    this.el.setObject3D('bank', bank);

    const sheet = river ? new THREE.PlaneGeometry(length, width) : new THREE.CircleGeometry(radius, 56);
    sheet.rotateX(-Math.PI / 2);
    if (!river) sheet.scale(stretch, 1, 1);

    const normalMap = rippleTexture().clone();
    normalMap.needsUpdate = true;
    const span = river ? [length / 7, width / 7] : [(radius * stretch) / 3.5, radius / 3.5];
    normalMap.repeat.set(...span);

    // Smooth, dark, and lit by the sky above it. Nearly all of what reads as
    // "water" here is the environment map; the colour is only what shows where
    // you look straight down.
    this.material = new THREE.MeshStandardMaterial({
      color, roughness: 0.07, metalness: 0.25, envMapIntensity: 1.35,
      normalMap, normalScale: new THREE.Vector2(0.38, 0.38), transparent: true, opacity: 0.94,
    });
    const water = new THREE.Mesh(sheet, this.material);
    water.position.y = 0.075;
    this.el.setObject3D('water', water);
  },

  tick(time) {
    const map = this.material?.normalMap;
    if (!map) return;
    const t = time / 1000;
    // A river runs along its length; a pond only drifts, and wanders as it does.
    if (this.data.shape === 'river') map.offset.set(-t * this.data.flow, Math.sin(t * 0.21) * 0.02);
    else map.offset.set(t * this.data.flow * 0.6 + Math.sin(t * 0.13) * 0.03, t * this.data.flow);
  },

  remove() {
    for (const name of ['bank', 'water']) {
      const mesh = this.el.getObject3D(name);
      mesh?.geometry.dispose(); mesh?.material.normalMap?.dispose(); mesh?.material.dispose();
      this.el.removeObject3D(name);
    }
  },
});

/**
 * A far tree line: one real tree, stood up many times.
 *
 * These were photographs on cards once — two triangles a tree. From the
 * child's seat that held; the moment anyone walked, a forest turned edge-on
 * and showed itself to be paper. Everything in a land is solid now.
 *
 * What makes a hundred solid trees affordable is two things. The model is the
 * `…far` copy of a near tree: the same trunk and boughs with most of the leaf
 * cards thinned away (`thin` in its sidecar), about a thousand triangles. And
 * they are drawn *instanced*: the tree is handed to the graphics chip once,
 * with a list of places to put it, so sixty trees cost a handful of drawing
 * instructions rather than sixty.
 *
 * They take no part in the shadow pass. They stand outside the sun's shadow
 * box anyway, and would be submitted to it only to be clipped out.
 */
AFRAME.registerComponent('treeline', {
  schema: {
    model: { type: 'string', default: 'realmangotreefar' },
    count: { type: 'number', default: 60 },
    inner: { type: 'number', default: 34 },
    outer: { type: 'number', default: 95 },
    /** Degrees of arc the trees fill, centred on `facing`; 360 is all round. */
    arc: { type: 'number', default: 360 },
    facing: { type: 'number', default: 0 },
    height: { type: 'number', default: 10 },
    seed: { type: 'number', default: 1 },
  },

  init() {
    const loader = new THREE.GLTFLoader();
    const draco = this.el.sceneEl.systems['gltf-model']?.getDRACOLoader?.();
    if (draco) loader.setDRACOLoader(draco);

    loader.load(`assets/models/${this.data.model}.glb`, (gltf) => {
      // The entity may have been torn down while the model was on its way.
      if (!this.el.parentNode) return;
      this.plant(gltf.scene);
    });
  },

  plant(tree) {
    const { count, inner, outer, arc, facing, height, seed } = this.data;
    const random = seeded(seed);

    tree.updateMatrixWorld(true);
    const tall = new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3()).y || 1;

    // Where each tree stands, how tall it is, and which way it is turned —
    // sorted into six wedges round the child. A batch is drawn or skipped as a
    // whole, so one batch all the way round would always be drawn in full,
    // including the half of the forest behind the child's head. In wedges, the
    // ones out of view are skipped, and about half the trees are drawn at once.
    const WEDGES = 6;
    const wedges = Array.from({ length: WEDGES }, () => []);
    const at = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i += 1) {
      const angle = THREE.MathUtils.degToRad(facing + (random() - 0.5) * arc);
      const r = inner + Math.sqrt(random()) * (outer - inner);
      const k = (height * (0.75 + random() * 0.55)) / tall;

      at.set(Math.sin(angle) * r, -0.05, -Math.cos(angle) * r);
      turn.setFromAxisAngle(up, random() * Math.PI * 2);
      size.set(k, k, k);

      const wedge = Math.floor((((angle / (Math.PI * 2)) % 1) + 1) % 1 * WEDGES);
      wedges[wedge].push(new THREE.Matrix4().compose(at, turn, size));
    }

    // One instanced mesh per wedge per part of the tree (bark, leaves).
    const grove = new THREE.Group();
    const placed = new THREE.Matrix4();
    tree.traverse((part) => {
      if (!part.isMesh) return;

      for (const spots of wedges) {
        if (!spots.length) continue;

        const copies = new THREE.InstancedMesh(part.geometry, part.material, spots.length);
        spots.forEach((spot, i) => copies.setMatrixAt(i, placed.multiplyMatrices(spot, part.matrixWorld)));
        copies.instanceMatrix.needsUpdate = true;
        copies.computeBoundingSphere();
        grove.add(copies);
      }
    });

    this.el.setObject3D('mesh', grove);
  },

  remove() {
    this.el.getObject3D('mesh')?.traverse((part) => {
      if (!part.isMesh) return;
      part.geometry.dispose();
      for (const material of [].concat(part.material)) { material.map?.dispose(); material.dispose(); }
    });
    this.el.removeObject3D('mesh');
  },
});
