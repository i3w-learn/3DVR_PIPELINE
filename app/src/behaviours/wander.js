/**
 * An animal that moves about its patch.
 *
 * A walk clip playing on an animal that never leaves its spot is worse than no
 * animation at all — the legs say "walking", the position says "standing", and
 * the eye reads the contradiction immediately. Either the clip has to match
 * standing still, or the animal has to actually go somewhere.
 *
 * This is the second option, for the animals that should be moving. It picks a
 * point near where the lesson placed it, turns toward it, walks there playing
 * the walk clip, then rests for a while playing the idle one. Then again,
 * somewhere else.
 *
 * Three rules keep it from becoming a distraction rather than a scene:
 *
 * - It stays near **home** — the position the lesson author chose. A lesson
 *   that puts the hen by the shed means the hen belongs by the shed, and an
 *   animal free to cross the yard would wreck a composition nobody could then
 *   fix from the JSON.
 * - It never runs. Slow enough that a child looking at something else does not
 *   have it snatched away.
 * - The pause is longer than the walk. Real animals stand around far more than
 *   they move, and a yard where everything is always in motion reads as a
 *   screensaver.
 */

AFRAME.registerComponent('wander', {
  schema: {
    /** How far from its placed position it may stray, in metres. */
    radius: { type: 'number', default: 2.5 },
    /** Metres per second while roaming. A grazing pace, never a hurry. */
    speed: { type: 'number', default: 0.35 },
    /**
     * How much brisker it is when called.
     *
     * An animal crossing a yard because a child called it moves with purpose;
     * at a grazing pace the walk takes thirteen seconds and the child has
     * stopped watching by then. Still a walk, not a run — nothing charges a
     * three-year-old.
     */
    approachSpeed: { type: 'number', default: 1.9 },
    /** Degrees per second while turning to face a new heading. */
    turnSpeed: { type: 'number', default: 90 },
    /** Clip while moving, and while resting. */
    walk: { type: 'string' },
    idle: { type: 'string' },
    /** Rest between walks, in milliseconds. Actual pause is 0.5×–1.5× this. */
    pause: { type: 'number', default: 6000 },
    /** How much room to leave around another animal, in metres. */
    clearance: { type: 'number', default: 1.4 },
    /**
     * How close it comes when called, in metres.
     *
     * Not zero, and not the same for everything. A hen at arm's length is
     * charming; a three-metre elephant at arm's length is a wall, and a child
     * who cannot step back has nowhere to go. Big animals stop further out.
     */
    stopDistance: { type: 'number', default: 2.2 },
    /** How long it stays after arriving, before drifting back to its patch. */
    stayFor: { type: 'number', default: 12000 },
  },

  init() {
    // Remembered before rest() slows the mixer, so setOff() can restore it.
    this.walkScale = this.el.getAttribute('animation-mixer')?.timeScale ?? 1;
    this.home = this.el.object3D.position.clone();
    this.target = new THREE.Vector3();
    this.step = new THREE.Vector3();
    this.called = false;

    this.rest(true);
  },

  /**
   * Come to whoever called, and stop a polite distance away.
   *
   * This is the difference between looking at an animal and meeting one. It
   * walks — slowly, on its real walk cycle — and only speaks once it has
   * arrived, so the child watches something happen rather than being told
   * about it.
   *
   * @param {THREE.Vector3} point  usually the viewer
   */
  approach(point) {
    if (!this.data.walk) return false; // nothing to walk with

    clearTimeout(this.timer);
    this.called = true;

    // Stop short of the caller, on the line between us.
    this.step.subVectors(this.el.object3D.position, point);
    this.step.y = 0;

    if (this.step.length() < 0.01) return false;

    this.target.copy(point).addScaledVector(this.step.normalize(), this.data.stopDistance);
    this.target.y = this.home.y;

    this.moving = true;
    this.playClip(this.data.walk);
    if (!this.data.idle && this.el.components['animation-mixer']) this.el.setAttribute('animation-mixer', { timeScale: this.walkScale ?? 1 });

    return true;
  },

  /** Stop being called; drift back to the patch in due course. */
  release() {
    this.called = false;
    this.rest();
  },

  /** Stand still for a while, then pick somewhere to go. */
  rest(initial = false) {
    this.moving = false;
    this.yawRate = 0;
    this.aligned = 1;
    if (this.data.idle && !initial) this.playClip(this.data.idle);
    // An animal whose pack has only a walk cycle would march on the spot
    // while it rests. Slowing the mixer almost to a stop reads as standing.
    if (!this.data.idle && this.el.components['animation-mixer']) this.el.setAttribute('animation-mixer', { timeScale: 0.04 });

    // An animal that has just been called stays put and faces the child —
    // wandering off mid-sentence would undo the whole point of calling it.
    const wait = this.called
      ? this.data.stayFor
      : this.data.pause * (0.5 + Math.random());

    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.called = false;
      this.setOff();
    }, wait);
  },

  setOff() {
    // Try a handful of spots and take the first that is not somebody else's.
    // A sheep standing inside an elephant is the most obviously broken thing a
    // yard can show, and it is cheap to avoid at the moment of choosing.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      this.pickPoint();

      // Too short a trip is a twitch, not a walk.
      if (this.target.distanceTo(this.el.object3D.position) < 0.4) continue;
      if (this.isCrowded(this.target)) continue;

      this.moving = true;
      if (this.data.walk) this.playClip(this.data.walk);
      if (!this.data.idle && this.el.components['animation-mixer']) this.el.setAttribute('animation-mixer', { timeScale: this.walkScale ?? 1 });
      return;
    }

    // Nowhere free right now — wait and look again rather than shoving.
    this.rest();
  },

  pickPoint() {
    const angle = Math.random() * Math.PI * 2;
    // sqrt keeps the points evenly spread over the circle rather than clustered
    // in the middle, which is what a plain random radius would do.
    const distance = Math.sqrt(Math.random()) * this.data.radius;

    this.target.set(
      this.home.x + Math.cos(angle) * distance,
      this.home.y,
      this.home.z + Math.sin(angle) * distance
    );
  },

  /** Is any sibling already standing there, or heading there? */
  isCrowded(point) {
    for (const other of this.el.parentNode.children) {
      if (other === this.el) continue;

      const wander = other.components?.wander;
      const spot = wander?.moving ? wander.target : other.object3D?.position;
      if (!spot) continue;

      if (point.distanceTo(spot) < this.data.clearance) return true;
    }

    return false;
  },

  tick(time, delta) {
    if (!this.moving || !delta) return;

    const object = this.el.object3D;
    const seconds = delta / 1000;

    this.step.subVectors(this.target, object.position);
    this.step.y = 0;

    if (this.step.length() < 0.15 + this.currentSpeed() * 0.6) {
      // Announce the arrival before resting, so whatever was waiting on it —
      // the narration — can start exactly when the animal stops.
      if (this.called) this.el.emit('wander-arrived', { id: this.el.id }, true);
      return this.rest();
    }

    // Turn toward where it is going, and walk the way it faces. An animal
    // that slides sideways into its new heading is the other half of the
    // same wrongness this fixes: the body goes where the feet point, so a
    // change of direction is a curve, not a pivot. It slows while the turn
    // is sharp, the way a heavy animal has to.
    const heading = Math.atan2(this.step.x, this.step.z);
    const turn = ((this.data.turnSpeed * Math.PI) / 180) * seconds;
    // Wrapped, or a long-running scene accumulates hundreds of degrees and the
    // shortest-way-round maths starts fighting itself.
    const before = object.rotation.y;
    object.rotation.y = wrap(approach(object.rotation.y, heading, turn));

    // Face the way first. Within twenty degrees it walks at full pace;
    // beyond sixty it stands and steps round, the way a heavy animal turns.
    // The rate it turned at is kept for whoever paces the legs.
    const error = Math.abs(wrap(heading - object.rotation.y));
    this.aligned = THREE.MathUtils.clamp(1 - (error - 0.35) / 0.7, 0, 1);
    this.yawRate = seconds > 0 ? wrap(object.rotation.y - before) / seconds : 0;
    this.forward ??= new THREE.Vector3();
    this.forward.set(Math.sin(object.rotation.y), 0, Math.cos(object.rotation.y));
    object.position.addScaledVector(this.forward, this.currentSpeed() * this.aligned * seconds);
  },

  currentSpeed() {
    return this.called ? this.data.speed * this.data.approachSpeed : this.data.speed;
  },

  /**
   * Swap clips, keeping the playback speed the lesson chose.
   *
   * Setting only `clip` resets `timeScale` to 1, so an animal that was
   * deliberately slowed down speeds back up the first time it takes a step —
   * and then stays fast, because nothing sets it again.
   *
   * NOT named `play`. That is one of A-Frame's own component lifecycle
   * methods: the framework calls `component.play()` with no arguments whenever
   * the entity resumes, which here meant setting `clip: undefined` and
   * silently reverting to the idle animation. The animals slid across the
   * grass with their legs perfectly still, and nothing in the data was wrong.
   */
  playClip(clip) {
    const mixer = this.el.components['animation-mixer'];
    if (!mixer) return;

    this.el.setAttribute('animation-mixer', {
      clip,
      timeScale: this.el.getAttribute('animation-mixer').timeScale ?? 1,
    });
  },

  remove() {
    clearTimeout(this.timer);
  },
});

/** Keep an angle in (−π, π]. */
function wrap(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle <= -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Rotate `from` toward `to` by at most `max`, the short way round. */
function approach(from, to, max) {
  let difference = to - from;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;

  return from + Math.max(-max, Math.min(max, difference));
}
