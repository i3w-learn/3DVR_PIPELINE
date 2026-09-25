/**
 * A field of grass, drawn as one batch.
 *
 * Seven scanned clumps on a flat green texture read as a lawn with ornaments.
 * A field reads as a field because there is grass everywhere the eye lands.
 * Hundreds of clumps placed one by one would each be a model and a draw call
 * and blow the budget; this draws them all at once, the way the far tree line
 * draws a forest.
 *
 * Each clump is three crossed cards with a painted blade texture, about
 * twelve triangles, so three hundred of them cost less than two scanned
 * clumps. The blades are drawn here rather than downloaded: a tuft of grass
 * is a shape the computer can draw, and drawing it costs no bytes, no licence
 * and no intake pass.
 *
 * Sorted into six wedges round the child, so the half behind the head is
 * skipped, like the tree line.
 */
import { seeded } from './random.js';

let bladeTexture = null;

/** A tuft of blades on a transparent card, painted once and shared. */
function blades() {
  if (bladeTexture) return bladeTexture;
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const random = seeded(11);
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 150; i += 1) {
    const x0 = SIZE * (0.06 + random() * 0.88);
    const lean = (random() - 0.5) * SIZE * 0.55;
    const top = SIZE * (0.02 + random() * 0.35);
    const w = 2 + random() * 3.5;
    // Olive and straw, darker at the root, like the scanned clumps and the
    // ground texture — never a saturated cartoon green.
    const g = 105 + Math.floor(random() * 55);
    const r = g - 28 + Math.floor(random() * 30);
    const b = 30 + Math.floor(random() * 22);
    const shade = ctx.createLinearGradient(0, SIZE, 0, top);
    shade.addColorStop(0, `rgb(${Math.floor(r * 0.45)}, ${Math.floor(g * 0.45)}, ${Math.floor(b * 0.5)})`);
    shade.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
    shade.addColorStop(1, `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 30)}, ${b + 20})`);
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(x0 - w, SIZE);
    ctx.quadraticCurveTo(x0 + lean * 0.4, SIZE * 0.55, x0 + lean, top);
    ctx.quadraticCurveTo(x0 + lean * 0.4 + w * 0.6, SIZE * 0.55, x0 + w, SIZE);
    ctx.closePath();
    ctx.fill();
  }
  bladeTexture = new THREE.CanvasTexture(canvas);
  bladeTexture.colorSpace = THREE.SRGBColorSpace;
  return bladeTexture;
}

/** Three cards crossed at 60°, standing on the ground, 1 m tall and wide. */
function clumpGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i += 1) {
    const card = new THREE.PlaneGeometry(1, 1);
    card.translate(0, 0.5, 0);
    card.rotateY((i * Math.PI) / 3);
    parts.push(card);
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Concatenate geometries that share attributes. Small, so done by hand. */
function mergeGeometries(list) {
  const positions = [], normals = [], uvs = [], indices = [];
  let offset = 0;
  for (const g of list) {
    positions.push(...g.getAttribute('position').array);
    normals.push(...g.getAttribute('normal').array);
    uvs.push(...g.getAttribute('uv').array);
    for (const i of g.getIndex().array) indices.push(i + offset);
    offset += g.getAttribute('position').count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  return out;
}

AFRAME.registerComponent('grassfield', {
  schema: {
    count: { type: 'number', default: 300 },
    inner: { type: 'number', default: 1.5 },
    outer: { type: 'number', default: 30 },
    /** Clump height in metres; each varies around it. */
    height: { type: 'number', default: 0.55 },
    seed: { type: 'number', default: 5 },
    /** Spots to leave clear, "x z r" triples, so a path or a pool stays open. */
    avoid: { type: 'array', default: [] },
  },

  init() {
    const { count, inner, outer, height, seed, avoid } = this.data;
    const random = seeded(seed);
    const clear = avoid.map((s) => s.trim().split(/\s+/).map(Number)).filter((a) => a.length === 3);

    const WEDGES = 6;
    const wedges = Array.from({ length: WEDGES }, () => []);
    const tints = Array.from({ length: WEDGES }, () => []);
    const at = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 4) {
      tries += 1;
      const angle = random() * Math.PI * 2;
      const r = inner + Math.sqrt(random()) * (outer - inner);
      const x = Math.sin(angle) * r, z = -Math.cos(angle) * r;
      if (clear.some(([cx, cz, cr]) => (x - cx) ** 2 + (z - cz) ** 2 < cr * cr)) continue;
      const h = height * (0.6 + random() * 0.9);
      at.set(x, 0, z);
      turn.setFromAxisAngle(up, random() * Math.PI * 2);
      size.set(h * 1.1, h, h * 1.1);
      const wedge = Math.floor((((angle / (Math.PI * 2)) % 1) + 1) % 1 * WEDGES);
      wedges[wedge].push(new THREE.Matrix4().compose(at, turn, size));
      // Slightly different greens, so the field is not one flat colour.
      tints[wedge].push(new THREE.Color().setHSL(0.17 + random() * 0.06, 0.25 + random() * 0.2, 0.34 + random() * 0.2));
      placed += 1;
    }

    const geometry = clumpGeometry();
    const material = new THREE.MeshStandardMaterial({
      map: blades(),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
    });
    const field = new THREE.Group();
    wedges.forEach((spots, w) => {
      if (!spots.length) return;
      const copies = new THREE.InstancedMesh(geometry, material, spots.length);
      spots.forEach((spot, i) => {
        copies.setMatrixAt(i, spot);
        copies.setColorAt(i, tints[w][i]);
      });
      copies.instanceMatrix.needsUpdate = true;
      copies.computeBoundingSphere();
      field.add(copies);
    });
    this.el.setObject3D('mesh', field);
  },

  remove() {
    const field = this.el.getObject3D('mesh');
    if (!field) return;
    field.traverse((part) => { if (part.isMesh) { part.geometry.dispose(); part.material.dispose(); } });
    this.el.removeObject3D('mesh');
  },
});
