/**
 * How a thing comes into the scene.
 *
 * Until now an object was simply there, or switched on by a step: an apple
 * blinking into existence on the sand. A child looks at what moves, and a
 * thing that arrives the way it would in life also teaches what it is: an
 * apple falls, a dog walks up, a bird flies in, a dolphin leaps out of the
 * sea, a rocket goes up.
 *
 * ## How it is triggered
 *
 * By the `shown` event, which `applyShow` fires when a step makes the object
 * visible for the first time. Nothing here fires on load: every object of a
 * lesson is placed at the start, hidden, and the entrance must happen in
 * front of the child.
 *
 * ## What moves
 *
 * The entity itself. `wander` captures its home at init, before any step, so
 * the home is the place the lesson wrote and the walk-in ends there. The
 * contact shadow and the ring are children and come along, which is right:
 * a shadow under a falling apple is what says how high it is.
 *
 * The name card is placed by `showName` at the moment of highlighting, which
 * for an arriving object is the wrong moment. So `arrived` is emitted at the
 * end, and `showName` waits for it.
 *
 * Schema:
 *   how       walk | fly | leap | fall | launch | pop   (default pop)
 *   from      metres away it starts (walk, fly), or up (fall), or down (leap)
 *   side      -1 | 1: which side a walker or flyer comes in from (default 1, the child's right)
 *   duration  seconds the arrival takes
 *   again     seconds between repeats, for a leap that keeps leaping (0 = once)
 *   idle      clip to switch to once there, for a rig whose `clip` is its walk
 */

const HOW = {
  pop:    { duration: 0.6 },
  walk:   { from: 7, duration: 4.0 },
  fly:    { from: 12, duration: 3.5 },
  leap:   { from: 1.6, duration: 1.8, again: 5 },
  fall:   { from: 3.2, duration: 0.9 },
  launch: { from: 0, duration: 2.6 },
};

const home = new THREE.Vector3();
const start = new THREE.Vector3();

AFRAME.registerComponent('arrive', {
  schema: {
    how: { type: 'string', default: 'pop' },
    from: { type: 'number', default: NaN },
    side: { type: 'number', default: 1 },
    duration: { type: 'number', default: NaN },
    again: { type: 'number', default: NaN },
    idle: { type: 'string', default: '' },
  },

  init() {
    const preset = HOW[this.data.how] ?? HOW.pop;
    this.from = Number.isFinite(this.data.from) ? this.data.from : preset.from ?? 0;
    this.duration = Number.isFinite(this.data.duration) ? this.data.duration : preset.duration;
    this.again = Number.isFinite(this.data.again) ? this.data.again : preset.again ?? 0;

    this.home = this.el.object3D.position.clone();
    this.homeYaw = this.el.object3D.rotation.y;
    // The tilt the lesson gave it. An arrival used to end by standing the
    // thing bolt upright — which for a butterfly leaned over to show the child
    // its wings meant wings seen edge on, a line in the air.
    this.homeTilt = { x: this.el.object3D.rotation.x, z: this.el.object3D.rotation.z };
    this.homeScale = this.el.object3D.scale.clone();
    this.t = null;       // null = not arriving
    this.done = false;
    this.rest = 0;

    this.onShown = () => this.begin();
    this.el.addEventListener('shown', this.onShown);
  },

  /** Is an arrival in progress? `showName` asks. */
  arriving() {
    return this.t !== null;
  },

  begin() {
    if (this.t !== null) return;
    this.t = 0;
    this.el.object3D.position.copy(this.home);
    this.el.object3D.scale.copy(this.homeScale);
    this.el.object3D.rotation.set(this.homeTilt.x, this.homeYaw, this.homeTilt.z);
    this.el.emit('arriving', { id: this.el.id, how: this.data.how }, true);
  },

  tick(_, dt) {
    if (this.t === null) {
      // A leaper leaps again after a rest. A dolphin that leapt once and then
      // lay on the water is a dead dolphin.
      if (this.again && this.done && this.el.getAttribute('visible') !== false) {
        this.rest += dt / 1000;
        if (this.rest >= this.again) { this.rest = 0; this.begin(); }
      }
      return;
    }

    this.t = Math.min(1, this.t + dt / 1000 / this.duration);
    const t = this.t;
    const o = this.el.object3D;
    home.copy(this.home);

    switch (this.data.how) {
      case 'walk': {
        // In from one side, along the sand, facing the way it walks; then it
        // turns to the child over the last stretch.
        const side = this.data.side;
        start.set(home.x + side * this.from, home.y, home.z);
        const e = t < 0.85 ? t / 0.85 : 1;
        o.position.lerpVectors(start, home, easeOut(e));
        const walking = Math.atan2(-side, 0); // heading along -x or +x, as a yaw about y
        const turn = t < 0.85 ? 0 : (t - 0.85) / 0.15;
        o.rotation.y = lerpAngle(walking, this.homeYaw, easeInOut(turn));
        break;
      }
      case 'fly': {
        // Down a long shallow glide from high and far, banking a little, and
        // landing exactly where the lesson put it.
        const side = this.data.side;
        start.set(home.x + side * this.from, home.y + this.from * 0.55, home.z - this.from * 0.4);
        const e = easeInOut(t);
        o.position.lerpVectors(start, home, e);
        o.position.y += Math.sin(t * Math.PI) * 0.6;
        o.rotation.z = Math.sin(t * Math.PI) * 0.25 * -side;
        o.rotation.y = lerpAngle(Math.atan2(-side, 0.4), this.homeYaw, e);
        break;
      }
      case 'leap': {
        // Up out of the water in an arc and back in, nose up then nose down.
        const h = this.from;
        const arc = Math.sin(t * Math.PI);
        o.position.set(home.x, home.y - h * 0.6 + arc * h * 1.6, home.z);
        o.rotation.x = -(0.5 - t) * 1.4;
        o.rotation.y = this.homeYaw;
        break;
      }
      case 'fall': {
        // Gravity, then a small bounce and a settle.
        const h = this.from;
        let y;
        if (t < 0.7) { const u = t / 0.7; y = h * (1 - u * u); }
        else { const u = (t - 0.7) / 0.3; y = Math.sin(u * Math.PI) * 0.12 * h; }
        o.position.set(home.x, home.y + y, home.z);
        o.rotation.y = this.homeYaw + t * 0.6;
        break;
      }
      case 'launch': {
        // Fire on the ground, then up to where the lesson put it, slowing.
        const from = this.from; // metres below home it starts (0 = the ground under home)
        start.set(home.x, from, home.z);
        const e = t < 0.25 ? 0 : easeInOut((t - 0.25) / 0.75);
        o.position.lerpVectors(start, home, e);
        o.position.x += Math.sin(t * 40) * 0.01 * (1 - t);
        o.rotation.y = this.homeYaw + t * 1.2;
        break;
      }
      default: {
        // Pop: grow from nothing with a small overshoot. Not a fade — a thing
        // going see-through is a thing that is not there.
        const e = t < 0.7 ? easeOut(t / 0.7) * 1.08 : 1.08 - 0.08 * ((t - 0.7) / 0.3);
        o.scale.copy(this.homeScale).multiplyScalar(e);
        o.position.copy(home);
      }
    }

    if (t >= 1) {
      o.position.copy(home);
      o.scale.copy(this.homeScale);
      o.rotation.set(this.homeTilt.x, this.homeYaw, this.homeTilt.z);
      this.t = null;
      const first = !this.done;
      this.done = true;
      this.rest = 0;
      // Legs stop when the walking stops.
      if (this.data.idle && first) this.el.setAttribute('animation-mixer', { clip: this.data.idle, crossFadeDuration: 0.4 });
      this.el.emit('arrived', { id: this.el.id, how: this.data.how, first }, true);
    }
  },

  remove() {
    this.el.removeEventListener('shown', this.onShown);
  },
});

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
