/**
 * Walking around the scene — teacher role only.
 *
 * The PRD is unambiguous and it is right: the child does not move. Free
 * locomotion is a v1 non-goal, the camera never moves on its own, and motion
 * the child's body has not asked for is the main cause of nausea at ages 3–6.
 * None of that changes.
 *
 * But the person *reviewing* a lesson has the opposite problem. Standing in
 * one spot on a tablet, you cannot tell whether the goat is the right size,
 * whether the hen is standing in the fence, or what the yard looks like from
 * where the elephant is. Every one of those was found here by walking over and
 * looking, and each would otherwise have reached a headset.
 *
 * So this exists, and it is bound to the teacher role only. In the headset it
 * is never attached at all — not disabled, not present.
 */

/** The only keys this component claims. Everything else passes through. */
/** Zoom limits. Below 25° the view feels like a telescope; above 90° it fisheyes. */
const MIN_FOV = 25;
const MAX_FOV = 90;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** World up. Taken from the world, not the camera, so looking up cannot tilt the walk. */
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Which key means which direction.
 *
 * Matched on `event.code` first — the physical key, so WASD stays WASD on a
 * French keyboard — and on `event.key` as a fallback, because not every source
 * of key events fills `code` in. Remote input and some on-screen keyboards
 * send only `key`, and a component that ignores those looks broken for reasons
 * nobody can see.
 */
const DIRECTIONS = {
  KeyW: 'forward', ArrowUp: 'forward', w: 'forward',
  KeyS: 'back', ArrowDown: 'back', s: 'back',
  KeyA: 'left', ArrowLeft: 'left', a: 'left',
  KeyD: 'right', ArrowRight: 'right', d: 'right',
};

/** The direction a key event asks for, or null if it asks for nothing. */
const directionOf = (event) =>
  DIRECTIONS[event.code] ?? DIRECTIONS[(event.key ?? '').toLowerCase()] ?? null;

/**
 * True when a key belongs to a text field rather than to the scene.
 *
 * BUTTON is deliberately NOT in this list, and that is the whole point. A
 * button keeps focus after it is clicked, so blocking keys for a focused
 * button means: the teacher presses Next, then tries to walk, and nothing
 * happens — with no way to tell why. A button accepts no text, so no key
 * pressed while it is focused was meant for it.
 */
const isTyping = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

AFRAME.registerComponent('preview-move', {
  schema: {
    speed: { type: 'number', default: 4 },       // metres per second, while held
    tapDistance: { type: 'number', default: 0.4 }, // metres, per press
    eyeHeight: { type: 'number', default: 1.2 },  // the child's, so sizes read true
  },

  init() {
    this.keys = new Set();
    this.direction = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();

    this.onKeyDown = (event) => {
      // Never swallow a key the teacher meant for a control.
      //
      // Testing for `target === document.body` looks equivalent and is not:
      // clicking the scene moves focus to the canvas, and after that every
      // key would be ignored. What actually matters is whether a form control
      // is focused.
      if (isTyping(event.target)) return;

      const direction = directionOf(event);
      if (!direction) return;

      event.preventDefault(); // arrow keys otherwise scroll the page behind the canvas
      this.keys.add(direction);

      // One step per press, as well as continuous movement while held.
      // Holding a key is the natural way to cross a yard; a short tap is the
      // natural way to nudge, and without this a tap shorter than a frame does
      // nothing at all.
      this.move(this.data.tapDistance);
    };
    this.onKeyUp = (event) => {
      const direction = directionOf(event);
      if (direction) this.keys.delete(direction);
    };
    this.onBlur = () => this.keys.clear(); // or a held key sticks when focus leaves

    // Scroll to zoom. Walking gets you to an animal; zoom lets you look at one
    // across the yard without leaving where you are — useful when checking
    // that two animals are the right size relative to each other.
    this.onWheel = (event) => {
      const camera = this.el.getObject3D('camera');
      if (!camera) return;

      event.preventDefault();
      camera.fov = clamp(camera.fov + Math.sign(event.deltaY) * 3, MIN_FOV, MAX_FOV);
      camera.updateProjectionMatrix();
    };

    this.el.sceneEl.canvas?.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.el.object3D.position.y = this.data.eyeHeight;
  },

  tick(time, delta) {
    if (!this.keys.size || !delta) return;
    this.move((this.data.speed * delta) / 1000);
  },

  /** Move `distance` metres along whichever keys are currently down. */
  move(distance) {
    if (!this.keys.size) return;

    const rig = this.el.object3D;

    // Direction comes from the CAMERA, not from the entity that holds it.
    // `<a-camera>`'s object3D is a group; look-controls rotates the camera
    // inside it, so asking the group which way it faces answers with the
    // world's -Z rather than the viewer's — and W walks backwards.
    const camera = this.el.getObject3D('camera') ?? rig;
    camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.crossVectors(this.forward, UP).normalize();

    this.direction.set(0, 0, 0);
    if (this.keys.has('forward')) this.direction.add(this.forward);
    if (this.keys.has('back')) this.direction.sub(this.forward);
    if (this.keys.has('right')) this.direction.add(this.right);
    if (this.keys.has('left')) this.direction.sub(this.right);

    if (!this.direction.lengthSq()) return;

    rig.position.addScaledVector(this.direction.normalize(), distance);

    // Height is fixed. There is no jumping and no flying: the point is to see
    // the scene from where a child would, not from a drone.
    rig.position.y = this.data.eyeHeight;
  },

  remove() {
    this.el.sceneEl.canvas?.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  },
});
