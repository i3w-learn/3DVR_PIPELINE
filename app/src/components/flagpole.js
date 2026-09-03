/**
 * The flag pole.
 *
 * Every school in India has one, and it stands where the children line up. It
 * is the single detail that turns a building with a wall around it into a
 * school a child recognises before anybody says the word — which is exactly
 * why getting it wrong is worse than leaving it out.
 *
 * Two things it has to do that the first version did not.
 *
 * **The Ashoka Chakra.** Three coloured bands is not the Indian flag; it is
 * the Irish flag rotated. The wheel is not decoration, and a child who sees
 * this every morning will notice before any adult does. It is drawn into a
 * canvas texture — twenty-four spokes, navy, centred in the white band.
 *
 * **It moves.** A stiff rectangle nailed to a pole reads as a signboard. Cloth
 * is the one thing in an outdoor scene that is always moving, and a flag that
 * does not move makes the whole yard feel like a photograph. The wave is a
 * vertex displacement in the shader: no cloth simulation, no physics, no cost
 * beyond a sine per vertex — and it is anchored at the pole, so the hoist edge
 * stays put and the fly end travels, which is how cloth actually behaves.
 */

AFRAME.registerComponent('flagpole', {
  schema: {
    height: { type: 'number', default: 7 },
    /** Flag width along the fly. Height follows the 3:2 ratio. */
    flagWidth: { type: 'number', default: 1.8 },
    /** How far the fly end swings, in metres. */
    wave: { type: 'number', default: 0.16 },
    /** Waves per second. A flag in light wind, not a whip. */
    speed: { type: 'number', default: 1.6 },

    pole: { type: 'color', default: '#b9bfc6' },
    base: { type: 'color', default: '#ded5c4' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { height, flagWidth, pole, base } = this.data;

    // A stepped plinth — the pole never comes straight out of the ground.
    this.block(1.4, 0.25, 1.4, 0, 0.125, 0, base);
    this.block(1.0, 0.25, 1.0, 0, 0.375, 0, base);

    const mast = document.createElement('a-cylinder');
    mast.setAttribute('radius', 0.06);
    mast.setAttribute('height', height);
    mast.setAttribute('position', `0 ${height / 2 + 0.5} 0`);
    mast.setAttribute('material', { color: pole, roughness: 0.35, metalness: 0.4 });
    this.el.appendChild(mast);

    this.flag(height, flagWidth);
  },

  flag(height, width) {
    const flagHeight = (width * 2) / 3;

    const el = document.createElement('a-plane');
    el.setAttribute('width', width);
    el.setAttribute('height', flagHeight);
    // Segments along the fly: the wave is a vertex displacement, so a plane
    // with four corners has nothing to displace.
    el.setAttribute('segments-width', 24);
    el.setAttribute('segments-height', 2);
    el.setAttribute('position', `${width / 2 + 0.06} ${height + 0.5 - flagHeight / 2 - 0.25} 0`);
    el.setAttribute('material', { shader: 'flat', side: 'double' });

    el.addEventListener('loaded', () => this.animate(el, width));
    this.el.appendChild(el);
  },

  /** Paint the flag, then make it move. */
  animate(el, width) {
    const mesh = el.getObject3D('mesh');
    if (!mesh) return;

    mesh.material.map = tricolour();
    mesh.material.needsUpdate = true;

    const uniforms = { uTime: { value: 0 }, uWave: { value: this.data.wave } };
    this.uniforms = uniforms;

    mesh.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWave = uniforms.uWave;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWave;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           // uv.x is 0 at the hoist and 1 at the fly. Scaling the amplitude by
           // it pins the flag to the pole and lets the far edge travel — a
           // uniform wave would make the whole thing slide sideways.
           float travel = uv.x;
           transformed.z += sin(uv.x * 7.0 - uTime) * uWave * travel;
           transformed.y += cos(uv.x * 5.0 - uTime * 0.8) * uWave * 0.35 * travel;`
        );
    };
  },

  tick(time) {
    if (this.uniforms) this.uniforms.uTime.value = (time / 1000) * this.data.speed;
  },

  block(w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', { color, roughness: 0.85, metalness: 0 });

    this.el.appendChild(box);
    return box;
  },
});

/** Cached: one flag texture serves every pole in every land. */
let cached = null;

/**
 * The tricolour, drawn rather than assembled.
 *
 * Three boxes could make the bands but not the wheel, and the wheel is the
 * part that makes it this flag rather than any flag.
 */
function tricolour() {
  if (cached) return cached;

  const w = 600;
  const h = 400;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const c = canvas.getContext('2d');

  c.fillStyle = '#ff9933'; c.fillRect(0, 0, w, h / 3);
  c.fillStyle = '#ffffff'; c.fillRect(0, h / 3, w, h / 3);
  c.fillStyle = '#138808'; c.fillRect(0, (2 * h) / 3, w, h / 3);

  // The Chakra: a navy rim and twenty-four spokes, sized to the white band.
  const radius = h / 3 / 2 - 6;
  c.save();
  c.translate(w / 2, h / 2);
  c.strokeStyle = '#000080';
  c.fillStyle = '#000080';
  c.lineWidth = 3;

  c.beginPath();
  c.arc(0, 0, radius, 0, Math.PI * 2);
  c.stroke();

  c.lineWidth = 2;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    c.stroke();
  }

  c.beginPath();
  c.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
  c.fill();
  c.restore();

  cached = new THREE.CanvasTexture(canvas);
  cached.colorSpace = THREE.SRGBColorSpace;
  return cached;
}
