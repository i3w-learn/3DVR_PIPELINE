/**
 * Water that looks like water, and a far tree line that looks like trees.
 *
 * The first pond and river were flat blue sheets with block trees round them,
 * and beside the programme's own farm — scanned trees, a real sky — they looked
 * like a different product. These two components are the fix, and both are
 * made of light rather than of geometry, which is why they are cheap:
 *
 * - `waterbody` is one flat sheet. What makes it water is that it mirrors the
 *   sky it sits under (the land's captured sky is already the scene's
 *   environment map) and that its surface is never still: a ripple pattern
 *   drifts across it as a normal map, so the reflection shivers.
 * - `treeline` is a photograph of a real tree, taken once, when the land loads,
 *   by rendering the actual tree model to a texture. A hundred distant trees
 *   are then a hundred flat cards facing the child — 200 triangles, against
 *   half a million for a hundred real ones.
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
 * A far tree line: one real tree, photographed once, shown many times.
 *
 * Every card faces the origin, because that is where the child sits and stays.
 * Cards differ in size, in a slight lean of tint, and are flipped at random, so
 * the eye does not find the repeat.
 */
AFRAME.registerComponent('treeline', {
  schema: {
    model: { type: 'string', default: 'realmangotree' },
    count: { type: 'number', default: 90 },
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
      this.plant(this.photograph(gltf.scene));
    });
  },

  /** Render the tree, side on and evenly lit, into a texture with a clear background. */
  photograph(tree) {
    const renderer = this.el.sceneEl.renderer;
    const box = new THREE.Box3().setFromObject(tree);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    this.aspect = Math.max(size.x, size.z) / size.y;

    const studio = new THREE.Scene();
    studio.add(tree, new THREE.AmbientLight('#dfe8ee', 0.85));
    const sun = new THREE.DirectionalLight('#fff4dd', 1.5);
    sun.position.set(3, 6, 5);
    studio.add(sun);

    const half = Math.max(size.x, size.z) / 2;
    const camera = new THREE.OrthographicCamera(-half, half, size.y / 2, -size.y / 2, 0.1, size.z + half * 4 + 10);
    camera.position.set(centre.x, centre.y, centre.z + half * 2 + 5);
    camera.lookAt(centre);

    const target = new THREE.WebGLRenderTarget(512, 512, { samples: 4 });
    const before = { target: renderer.getRenderTarget(), colour: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), xr: renderer.xr.enabled };

    // Off-screen, and with XR switched off for the one frame: in a headset the
    // renderer would otherwise try to draw the studio through the headset's eyes.
    renderer.xr.enabled = false;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(studio, camera);
    renderer.setRenderTarget(before.target);
    renderer.setClearColor(before.colour, before.alpha);
    renderer.xr.enabled = before.xr;

    tree.traverse((o) => { o.geometry?.dispose(); });
    this.target = target;
    return target.texture;
  },

  plant(texture) {
    const { count, inner, outer, arc, facing, height, seed } = this.data;
    const random = seeded(seed);
    const position = [], uv = [], colour = [];

    for (let i = 0; i < count; i += 1) {
      const angle = THREE.MathUtils.degToRad(facing + (random() - 0.5) * arc);
      const r = inner + Math.sqrt(random()) * (outer - inner);
      const x = Math.sin(angle) * r, z = -Math.cos(angle) * r;
      const h = height * (0.75 + random() * 0.55), w = (h * this.aspect) / 2;
      // The card's own left and right, square-on to a viewer at the origin.
      const tx = -z / r, tz = x / r;
      const flip = random() < 0.5 ? 1 : 0, tint = 0.7 + random() * 0.2;

      const corners = [[-1, 0, flip ? 1 : 0, 0], [1, 0, flip ? 0 : 1, 0], [1, 1, flip ? 0 : 1, 1], [-1, 1, flip ? 1 : 0, 1]];
      for (const c of [0, 1, 2, 0, 2, 3]) {
        const [side, up, u, v] = corners[c];
        position.push(x + tx * w * side, up * h - 0.05, z + tz * w * side);
        uv.push(u, v); colour.push(tint, tint, tint * 0.97);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, alphaTest: 0.35, side: THREE.DoubleSide });
    this.el.setObject3D('mesh', new THREE.Mesh(geometry, material));
  },

  remove() {
    const mesh = this.el.getObject3D('mesh');
    mesh?.geometry.dispose(); mesh?.material.dispose();
    this.target?.dispose();
    this.el.removeObject3D('mesh');
  },
});
