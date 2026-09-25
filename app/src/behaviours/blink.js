/**
 * Eyes that blink.
 *
 * An animal that never blinks is the last thing that gives a model away, and
 * the first thing a child stares at. Two kinds of rig can do it:
 *
 * - `lids`: eyelid bones. Upper lids swing down, lower lids swing up, for a
 *   fraction of a second, every few seconds. The T-rex and the pteranodon
 *   came with these.
 * - `eyes`: eyeball bones and no lids. The eye squashes flat for a moment,
 *   which from more than a metre away reads as a blink.
 *
 * The blink is laid on top of whatever pose the animation clip has set this
 * frame, so it works on an animal that is walking, eating or standing still,
 * and it never accumulates.
 */

/**
 * three.js renames nodes as it loads a glTF: spaces become underscores and
 * anything that is not a word character or a dash is dropped, so a bone the
 * file calls "Eye.R_010" is "EyeR_010" in the scene. A lesson names bones as
 * the file does; this looks them up the way the loader left them.
 */
function findBone(root, name) {
  const asIs = name.trim();
  return (
    root.getObjectByName(asIs) ??
    root.getObjectByName(asIs.replace(/\s/g, '_').replace(/[^\w-]/g, '')) ??
    null
  );
}

AFRAME.registerComponent('blink', {
  schema: {
    /** Eyelid bones. Names containing "lower" swing the other way. */
    lids: { type: 'array', default: [] },
    /** Eyeball bones, for a rig with no lids. */
    eyes: { type: 'array', default: [] },
    /** How far a lid swings, in degrees. */
    angle: { type: 'number', default: 28 },
    /** Seconds between blinks, least and most. */
    least: { type: 'number', default: 2.5 },
    most: { type: 'number', default: 6.5 },
    /** How long one blink takes, in seconds. */
    duration: { type: 'number', default: 0.18 },
  },

  init() {
    this.bones = null;
    this.side = new THREE.Vector3(1, 0, 0);
    this.q = new THREE.Quaternion();
    this.pInv = new THREE.Quaternion();
    this.pWorld = new THREE.Quaternion();
    this.at = 0; // seconds into the current blink, or -1 between blinks
    this.wait = this.gap();
    const bind = () => this.bind();
    this.el.addEventListener('model-loaded', bind);
    if (this.el.getObject3D('mesh')) bind();
  },

  gap() {
    const { least, most } = this.data;
    return least + Math.random() * (most - least);
  },

  bind() {
    const root = this.el.object3D;
    const find = (n) => findBone(root, n);
    this.bones = {
      lids: this.data.lids.map((n) => ({ bone: find(n), lower: /lower/i.test(n) })).filter((l) => l.bone),
      eyes: this.data.eyes.map((n) => find(n)).filter(Boolean).map((bone) => ({ bone, scale: bone.scale.clone() })),
    };
    const missing = [...this.data.lids, ...this.data.eyes].filter((n) => !find(n));
    if (missing.length) console.warn('[blink] bones not found:', missing.join(', '));
  },

  tick(_, delta) {
    if (!this.bones) return;
    const dt = delta / 1000;
    this.wait -= dt;
    if (this.wait > 0) return; // eyes open, nothing to touch
    this.at += dt;
    const { duration, angle } = this.data;
    // Closed at the middle, open at both ends.
    const p = Math.sin(Math.min(1, this.at / duration) * Math.PI);
    for (const { bone, lower } of this.bones.lids) {
      bone.parent.getWorldQuaternion(this.pWorld);
      this.pInv.copy(this.pWorld).invert();
      this.q.setFromAxisAngle(this.side, THREE.MathUtils.degToRad((lower ? -angle : angle) * p));
      // On top of this frame's animated pose, not a stored rest pose.
      bone.quaternion.premultiply(this.pWorld).premultiply(this.q).premultiply(this.pInv);
    }
    for (const { bone, scale } of this.bones.eyes) {
      bone.scale.set(scale.x, scale.y * (1 - 0.85 * p), scale.z);
    }
    if (this.at >= duration) {
      this.at = 0;
      this.wait = this.gap();
      for (const { bone, scale } of this.bones.eyes) bone.scale.copy(scale);
    }
  },

  remove() {
    if (!this.bones) return;
    for (const { bone, scale } of this.bones.eyes) bone.scale.copy(scale);
  },
});
