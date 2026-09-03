/**
 * Doors and gates that open when you come to them.
 *
 * A door with a handle on it is furniture. A door that swings back as you walk
 * up is the school letting you in, and for a three-year-old that is the whole
 * story of arriving somewhere — which is why this exists at all rather than the
 * child being told to press something.
 *
 * ## Why it is a separate component
 *
 * `door` knows how to be a door and `gate` knows how to be a gate. Neither
 * should know about the camera, and both want the same behaviour. So the rule
 * lives here, and the contract between them is one method:
 *
 *     setOpen(fraction)   // 0 shut, 1 fully open
 *
 * Anything on the same entity that implements it gets proximity opening for
 * free. Nothing here knows what shape it is opening.
 *
 * ## Two ways in
 *
 * **Walking up to it** is the main one, and the only one the teacher on a
 * laptop will ever use.
 *
 * **Looking at it** matters more. The child in the headset is seated and never
 * moves — the PRD forbids moving them, because motion the body has not asked
 * for is what makes small children sick. A door that only opens when you walk
 * to it would never open for the one person the lesson is for. So a gaze or a
 * tap holds it open too.
 */

const cameraPosition = new THREE.Vector3();
const selfPosition = new THREE.Vector3();

AFRAME.registerComponent('auto-open', {
  schema: {
    /** Open once the viewer is closer than this, in metres. */
    range: { type: 'number', default: 5.5 },

    /**
     * Shut again once they are further than this.
     *
     * Deliberately wider than `range`. One threshold for both means a viewer
     * standing at exactly that distance sets the door flapping, because their
     * own head movement crosses the line several times a second.
     */
    release: { type: 'number', default: 7.5 },

    /** Full swing takes 1/speed seconds. */
    speed: { type: 'number', default: 1.4 },

    /** How long a look or a tap holds it open, in milliseconds. */
    hold: { type: 'number', default: 10000 },
  },

  init() {
    this.target = 0;
    this.held = 0;

    // A look or a tap counts as wanting in. Both the gaze cursor and the
    // teacher's pointer raise `click`, so this needs no second code path.
    this.onClick = () => { this.held = this.data.hold; };
    this.el.addEventListener('click', this.onClick);
  },

  remove() {
    this.el.removeEventListener('click', this.onClick);
  },

  tick(time, delta) {
    const swinging = this.swinging();
    if (!swinging) return;

    const camera = this.el.sceneEl.camera;
    if (!camera) return;

    camera.getWorldPosition(cameraPosition);
    this.el.object3D.getWorldPosition(selfPosition);

    // Flat distance. A door does not care that the viewer's eyes are a metre
    // above its threshold, and counting that height would push everyone
    // standing right at it back outside its own range.
    cameraPosition.y = selfPosition.y;
    const distance = cameraPosition.distanceTo(selfPosition);

    this.held = Math.max(0, this.held - delta);

    if (this.held > 0 || distance < this.data.range) this.target = 1;
    else if (distance > this.data.release) this.target = 0;

    // Eased towards the target rather than snapped to it. A door that jumps
    // between shut and open reads as a glitch; half a second of swing reads as
    // a door.
    const step = (delta / 1000) * this.data.speed;
    const openness = swinging.openness ?? 0;

    if (Math.abs(this.target - openness) < 0.001) return;
    swinging.setOpen(THREE.MathUtils.clamp(
      openness + Math.sign(this.target - openness) * step,
      0,
      1
    ));
  },

  /** Whichever component on this entity knows how to swing. */
  swinging() {
    if (this.host?.setOpen) return this.host;

    this.host = Object.values(this.el.components).find((c) => typeof c.setOpen === 'function');
    return this.host;
  },
});
