/**
 * The water's edge.
 *
 * A sea that is a flat sheet ending in a straight line on the sand is a
 * swimming pool. What says "beach" is the last of each wave: a lace of foam
 * that slides up the sand, thins, and slides back, and the darker band of wet
 * sand it leaves. Neither is geometry worth having; both are a strip of
 * see-through white that moves.
 *
 * Two strips. The foam is a long plane with a hand-drawn foam texture
 * scrolling sideways, whose whole body slides up the beach and back on a slow
 * cycle, fading as it recedes. The wet band is a plain darker plane just
 * behind it that the foam slides over.
 *
 * Params:
 *   length  metres across (default 220)
 *   reach   metres the foam runs up the sand (default 2.4)
 *   period  seconds per wave (default 7)
 *   wet     colour of the wet sand band (default a darker sand)
 */

function foamTexture() {
  const w = 1024;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Lace: many soft white blobs, dense along the lower edge (the water) and
  // sparse towards the top (the sand), so the strip reads as a ragged front.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w;
    const towardSand = Math.pow(rnd(), 1.8);           // few reach the top
    const y = h - towardSand * h;
    const r = 3 + rnd() * 9 * (1 - towardSand * 0.6);
    const a = 0.25 + (1 - towardSand) * 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // A solid-ish base along the water edge so the foam joins the sea.
  const base = ctx.createLinearGradient(0, h, 0, h * 0.55);
  base.addColorStop(0, 'rgba(255,255,255,0.75)');
  base.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

AFRAME.registerComponent('shore', {
  schema: {
    length: { type: 'number', default: 220 },
    reach: { type: 'number', default: 2.4 },
    period: { type: 'number', default: 7 },
    wet: { type: 'color', default: '#c9b78c' },
  },

  init() {
    const { length, reach, wet } = this.data;
    const group = new THREE.Group();

    // Wet sand: a band from the water line up the beach, fixed. Slightly
    // above the ground so it wins the depth test, below the water surface.
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(length, reach * 1.35),
      new THREE.MeshStandardMaterial({ color: wet, roughness: 0.55, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false })
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.045, reach * 0.55);
    band.renderOrder = 1;

    // Foam: the moving strip. Its texture repeats along the length.
    const map = foamTexture();
    map.repeat.set(length / 14, 1);
    this.foam = new THREE.Mesh(
      new THREE.PlaneGeometry(length, reach * 1.1),
      new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
    );
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.y = 0.09;
    this.foam.renderOrder = 2;
    this.map = map;

    group.add(band, this.foam);
    this.el.setObject3D('mesh', group);
    this.t = Math.random() * this.data.period;
  },

  tick(_, dt) {
    if (!this.foam) return;
    this.t += dt / 1000;
    const { reach, period } = this.data;
    // Up the beach fast, back slowly: a wave runs in and drains out.
    const phase = (this.t % period) / period;
    const run = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI / 2) : Math.cos(((phase - 0.4) / 0.6) * Math.PI / 2);
    this.foam.position.z = reach * 0.5 * run;
    // Thin as it drains. Never quite gone: the sea's edge is always white.
    this.foam.material.opacity = 0.45 + run * 0.5;
    this.map.offset.x += dt / 1000 * 0.012;
  },

  remove() {
    this.el.removeObject3D('mesh');
  },
});
