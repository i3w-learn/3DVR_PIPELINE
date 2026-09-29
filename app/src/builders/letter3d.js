/**
 * A letter with depth, floating in the sky.
 *
 * The letter lesson's one idea: the letter is huge, it hangs in the air where
 * the child is already looking, and the things it stands for arrive on the
 * sand underneath it. A `glyph` is a flat card and will not do — seen from a
 * step to the side it is a line, and it throws no shadow. This extrudes the
 * real outline of the letter, so it is a solid thing with a shadow on the
 * sand, the way a wooden block letter is.
 *
 * ## Where the outline comes from
 *
 * `lib/fonts/letters-3d.json`, built by `tools/build/letters.js` from the same
 * Noto TTFs as the atlases. The fetch happens once per page and is shared.
 *
 * ## How it moves
 *
 * On first showing it drops in from the sky and settles, then bobs and sways
 * gently for as long as it is up: a still letter reads as a sign, a moving one
 * as a character. Movement is applied to an inner group, so the entity's own
 * position stays exactly what the lesson wrote.
 *
 * ## How it is pointed at
 *
 * Not with the ring. A torus in the air in front of a letter hides the letter
 * and reads as a hoop, not a mark. The letter has a soft halo behind it that
 * breathes all the time and brightens when the letter is highlighted, and the
 * face itself warms. The ring is still set — the templates do that — but it
 * is told to draw nothing.
 *
 * Params:
 *   char    the letter (must be in the JSON; the checker looks, VAL_L16)
 *   height  cap height in metres (default 1.2)
 *   depth   thickness in metres (default 0.22)
 *   color   face colour (default a school-yellow)
 *   side    colour of the extruded sides (default a darker yellow)
 *   float   bob and sway once settled (default true)
 *   drop    metres it falls in from (default 6; 0 = just appear)
 */

const FILE = 'lib/fonts/letters-3d.json';
let outlines = null;

async function loadOutlines() {
  outlines ??= fetch(FILE).then((r) => {
    if (!r.ok) throw new Error(`${FILE}: ${r.status}`);
    return r.json();
  });
  return outlines;
}

/**
 * opentype's commands into three.js shapes, in em units.
 *
 * opentype hands the outline out with y pointing DOWN, as fonts do; three.js
 * has y up. Used as they come, every letter is upside down and — because the
 * flip also reverses the winding — inside out: the front face points away
 * from the child and is culled, and what shows is the hollow inside of the
 * side walls. A "B" flipped is still a B, which is how that got past a first
 * look. So y is negated here.
 */
function shapesFor(glyph, unitsPerEm) {
  const path = new THREE.ShapePath();
  const s = 1 / unitsPerEm;
  for (const c of glyph.commands) {
    switch (c[0]) {
      case 'M': path.moveTo(c[1] * s, -c[2] * s); break;
      case 'L': path.lineTo(c[1] * s, -c[2] * s); break;
      case 'Q': path.quadraticCurveTo(c[1] * s, -c[2] * s, c[3] * s, -c[4] * s); break;
      case 'C': path.bezierCurveTo(c[1] * s, -c[2] * s, c[3] * s, -c[4] * s, c[5] * s, -c[6] * s); break;
      case 'Z': path.currentPath?.closePath(); break;
      default: break;
    }
  }
  // Noto's outlines are consistently wound, so holes (the inside of an A, a B,
  // an O) come out as holes rather than as second solids.
  return path.toShapes(false);
}

/** A soft round glow, drawn once and shared: white in the middle, nothing at the edge. */
let haloTexture = null;
function halo() {
  if (haloTexture) return haloTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 244, 200, 1)');
  g.addColorStop(0.35, 'rgba(255, 236, 160, 0.55)');
  g.addColorStop(0.7, 'rgba(255, 225, 120, 0.14)');
  g.addColorStop(1, 'rgba(255, 220, 100, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

AFRAME.registerComponent('letter3d', {
  schema: {
    char: { type: 'string', default: 'A' },
    height: { type: 'number', default: 1.2 },
    depth: { type: 'number', default: 0.22 },
    color: { type: 'color', default: '#ffd23f' },
    side: { type: 'color', default: '#d9a800' },
    float: { type: 'boolean', default: true },
    drop: { type: 'number', default: 6 },
  },

  async init() {
    this.group = new THREE.Group();
    this.el.setObject3D('mesh', this.group);
    this.time = Math.random() * 10;
    this.settled = this.data.drop <= 0;
    this.fall = 0;
    this.lit = 0;          // 0 = plain, 1 = highlighted; eased between
    this.wantLit = this.el.hasAttribute('highlight');

    // Drop in the first time the letter is shown, not when the lesson loads:
    // every letter of a lesson is placed at the start and hidden, and the fall
    // has to happen in front of the child.
    this.onShown = () => this.begin();
    this.el.addEventListener('shown', this.onShown);

    // The templates ring things by setting `highlight`; the letter answers
    // with its halo instead of a hoop.
    this.onComponent = (event) => {
      if (event.detail.name !== 'highlight') return;
      this.wantLit = event.type === 'componentinitialized';
    };
    this.el.addEventListener('componentinitialized', this.onComponent);
    this.el.addEventListener('componentremoved', this.onComponent);

    const { unitsPerEm, glyphs } = await loadOutlines();
    const glyph = glyphs[this.data.char];
    if (!glyph) {
      console.warn(`[letter3d] no outline for "${this.data.char}"`);
      return;
    }

    const shapes = shapesFor(glyph, unitsPerEm);
    const em = this.data.height / 0.714; // Noto's cap height, in em
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: this.data.depth / em,
      bevelEnabled: true,
      // A rounded edge is where the sun catches a block letter. Too small and
      // the letter is a cut-out; this is a finger's width on a metre letter.
      bevelThickness: 0.028,
      bevelSize: 0.022,
      bevelSegments: 4,
      curveSegments: 14,
    });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    // Centred left-right and front-back, standing on its baseline, so the
    // entity's position is the point under the middle of the letter.
    geometry.translate(-(box.min.x + box.max.x) / 2, 0, -(box.min.z + box.max.z) / 2);

    // Painted wood with a coat of varnish: colour underneath, a thin gloss on
    // top that takes the sky. Plain matte plastic reads as a toy.
    const face = new THREE.MeshPhysicalMaterial({
      color: this.data.color, roughness: 0.32, metalness: 0,
      clearcoat: 0.7, clearcoatRoughness: 0.25,
      emissive: new THREE.Color(this.data.color), emissiveIntensity: 0,
    });
    const side = new THREE.MeshPhysicalMaterial({
      color: this.data.side, roughness: 0.4, metalness: 0,
      clearcoat: 0.5, clearcoatRoughness: 0.3,
      emissive: new THREE.Color(this.data.side), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(geometry, [face, side]);
    mesh.scale.setScalar(em);
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    // The halo: a sprite behind the letter, always faintly there so the
    // letter is lit from behind like a thing in the sun, brighter when it is
    // the one being pointed at.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo(), transparent: true, depthWrite: false, opacity: 0.16,
      blending: THREE.AdditiveBlending, color: '#ffd76a',
    }));
    const width = (box.max.x - box.min.x) * em;
    this.glowBase = { x: Math.max(width, this.data.height) * 1.55, y: this.data.height * 1.55 };
    glow.scale.set(this.glowBase.x, this.glowBase.y, 1);
    glow.position.set(0, this.data.height * 0.5, -this.data.depth * 0.5 - 0.05);
    glow.renderOrder = -1;

    this.mesh = mesh;
    this.face = face;
    this.sideMat = side;
    this.glow = glow;
    this.group.add(glow, mesh);
    this.el.emit('model-loaded', { format: 'built', model: this.group }, false);

    if (this.el.getAttribute('visible') !== false && !this.settled) this.begin();
  },

  /** Start the fall: the letter is `drop` metres up and comes down over ~1.4 s. */
  begin() {
    if (this.settled || this.falling) return;
    this.falling = true;
    this.fall = 0;
  },

  tick(_, dt) {
    if (!this.mesh) return;
    const seconds = dt / 1000;
    this.time += seconds;

    let lift = 0;
    if (this.falling) {
      this.fall = Math.min(1, this.fall + seconds / 1.4);
      // Ease out with a small overshoot, like a thing settling on a cushion of
      // air rather than hitting the ground.
      const t = this.fall;
      const eased = 1 - Math.pow(1 - t, 3);
      const bounce = Math.sin(t * Math.PI) * 0.08;
      lift = this.data.drop * (1 - eased) - bounce;
      if (t >= 1) { this.falling = false; this.settled = true; }
    }

    if (this.settled && this.data.float) {
      lift += Math.sin(this.time * 1.1) * 0.06;
      this.group.rotation.y = Math.sin(this.time * 0.55) * 0.12;
      this.group.rotation.z = Math.sin(this.time * 0.8 + 1) * 0.03;
    }
    this.group.position.y = lift;

    // Highlight eases in and out rather than snapping, and the halo breathes.
    const target = this.wantLit ? 1 : 0;
    this.lit += (target - this.lit) * Math.min(1, seconds * 5);
    const breath = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    const swell = 1 + this.lit * (0.1 + breath * 0.1);
    this.glow.material.opacity = 0.16 + this.lit * (0.3 + breath * 0.16);
    this.glow.scale.set(this.glowBase.x * swell, this.glowBase.y * swell, 1);
    this.face.emissiveIntensity = this.lit * (0.18 + breath * 0.12);
    this.sideMat.emissiveIntensity = this.lit * 0.08;
  },

  /** The ring draws nothing here; the halo is the mark. */
  highlightAnchor() {
    const anchor = new THREE.Object3D();
    anchor.position.set(0, this.data.height * 0.5, 0);
    this.group.add(anchor);
    return { object3D: anchor, radius: 0.001, thickness: 0.01, opacity: 0, billboard: true };
  },

  remove() {
    this.el.removeEventListener('shown', this.onShown);
    this.el.removeEventListener('componentinitialized', this.onComponent);
    this.el.removeEventListener('componentremoved', this.onComponent);
    this.el.removeObject3D('mesh');
  },
});
