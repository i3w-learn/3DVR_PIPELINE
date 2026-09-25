/**
 * A walk for a four-legged animal whose pack came without one.
 *
 * The Apatosaurus scan has a full skeleton and a single "animation" that
 * moves nothing. Sliding it across the grass would be worse than leaving it
 * still. So the legs are swung here: hips forward and back in the diagonal
 * pairs a real quadruped uses, knees lifting on the swing, the body rising
 * a little on each stride. It runs only while `wander` says the animal is
 * moving, and eases back to the rest pose when it stops.
 *
 * It is not motion capture. It is a sine wave per joint, which at a
 * sauropod's pace, seen from a child's height, reads as a big animal
 * walking. The bones are named in the lesson because this rig's names are
 * hexadecimal and nobody should have to read them twice.
 */
AFRAME.registerComponent('legwalk', {
  schema: {
    /** Four hip bones: front-left, front-right, back-left, back-right. */
    hips: { type: 'array', default: [] },
    /** Four knee bones, same order. */
    knees: { type: 'array', default: [] },
    /** The bone the whole body hangs from, for the stride bob. */
    root: { type: 'string', default: '' },
    /** Hip swing, in degrees each way. */
    swing: { type: 'number', default: 14 },
    /** Knee lift on the forward swing, in degrees. */
    lift: { type: 'number', default: 12 },
    /** Metres travelled per full stride cycle. Sets the leg speed. */
    stride: { type: 'number', default: 2.6 },
    /** Body rise per stride, in metres. */
    bob: { type: 'number', default: 0.06 },
    /** Neck bones from the shoulders to the head, in order. */
    neck: { type: 'array', default: [] },
    /** Tail bones from the hips to the tip, in order. */
    tail: { type: 'array', default: [] },
    /** The lower jaw. */
    jaw: { type: 'string', default: '' },
    /** How far the head roams: degrees per neck bone, summed along the neck. */
    neckSway: { type: 'number', default: 1.6 },
    tailSway: { type: 'number', default: 2.2 },
    /** How wide the mouth opens when it chews, in degrees. */
    jawOpen: { type: 'number', default: 6 },
  },

  init() {
    this.phase = 0;
    this.blend = 0; // 0 still … 1 walking, eased
    this.bones = null;
    this.side = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this.life = Math.random() * 100; // the slow clock for neck, tail and jaw
    this.q = new THREE.Quaternion();
    this.pInv = new THREE.Quaternion();
    this.pWorld = new THREE.Quaternion();
    const bind = () => this.bind();
    this.el.addEventListener('model-loaded', bind);
    if (this.el.getObject3D('mesh')) bind();
  },

  bind() {
    const root = this.el.object3D;
    const find = (name) => root.getObjectByName(name) ?? null;
    const grab = (names) => names.map((n) => {
      const bone = find(n.trim());
      return bone ? { bone, rest: bone.quaternion.clone() } : null;
    });
    this.bones = {
      hips: grab(this.data.hips),
      knees: grab(this.data.knees),
      root: this.data.root ? find(this.data.root) : null,
      neck: grab(this.data.neck),
      tail: grab(this.data.tail),
      jaw: this.data.jaw ? grab([this.data.jaw])[0] : null,
    };
    this.rootY = this.bones.root ? this.bones.root.position.y : 0;
    const missing = [...this.data.hips, ...this.data.knees, ...this.data.neck, ...this.data.tail].filter((n) => !find(n.trim()));
    if (missing.length) console.warn('[legwalk] bones not found:', missing.join(', '));
  },

  /**
   * Rotate a bone about a world axis, on top of its rest pose. Two angles:
   * about the sideways axis (nod, swing) and about the up axis (turn, sway).
   */
  swingBone(entry, degrees, turnDegrees = 0) {
    if (!entry) return;
    const { bone, rest } = entry;
    const parent = bone.parent;
    parent.getWorldQuaternion(this.pWorld);
    this.pInv.copy(this.pWorld).invert();
    this.q.setFromAxisAngle(this.side, THREE.MathUtils.degToRad(degrees));
    if (turnDegrees) {
      this.q2 ??= new THREE.Quaternion();
      this.q2.setFromAxisAngle(this.up, THREE.MathUtils.degToRad(turnDegrees));
      this.q.multiply(this.q2);
    }
    // local = parentInv · worldRotation · parentWorld · rest
    bone.quaternion.copy(this.pInv).multiply(this.q).multiply(this.pWorld).multiply(rest);
  },

  tick(_, delta) {
    if (!this.bones) return;
    const dt = delta / 1000;
    const wander = this.el.components.wander;
    const moving = wander?.moving === true;
    const speed = moving ? wander.currentSpeed() : 0;

    // Ease in and out, so a stop is a settle and not a freeze.
    this.blend += ((moving ? 1 : 0) - this.blend) * Math.min(1, dt * 3);
    if (moving) this.phase += (speed / this.data.stride) * Math.PI * 2 * dt;
    // Once stopped, let the legs finish the half-stride they were on.
    else if (this.blend > 0.01) this.phase += (this.data.stride * 0.15 / this.data.stride) * Math.PI * 2 * dt;

    const { swing, lift, bob } = this.data;
    const b = this.blend;
    // Diagonal gait: front-left with back-right, front-right with back-left.
    const offsets = [0, Math.PI, Math.PI, 0];
    this.bones.hips.forEach((hip, i) => {
      const s = Math.sin(this.phase + offsets[i]);
      this.swingBone(hip, swing * s * b);
      // Knee bends as the leg comes forward, straight as it bears weight.
      const forward = Math.max(0, Math.cos(this.phase + offsets[i]));
      this.swingBone(this.bones.knees[i], -lift * forward * b);
    });
    if (this.bones.root) {
      this.bones.root.position.y = this.rootY + bob * Math.abs(Math.sin(this.phase * 2)) * b;
    }

    // The slow life of the rest of the animal: a neck that roams, a tail that
    // sways, a mouth that chews now and then. These run whether it walks or
    // stands, because a still animal that breathes is alive and one that
    // does not is a statue.
    this.life += dt;
    const t = this.life;
    const { neckSway, tailSway, jawOpen } = this.data;
    const n = this.bones.neck.length;
    this.bones.neck.forEach((entry, i) => {
      const along = i / Math.max(1, n - 1);
      // Head dips toward the ground and rises, and looks left and right.
      const nod = neckSway * (Math.sin(t * 0.45 + along * 1.2) * 0.9 + Math.sin(t * 0.17) * 0.6);
      const turn = neckSway * 0.8 * Math.sin(t * 0.3 + along * 0.8);
      this.swingBone(entry, nod, turn);
    });
    const m = this.bones.tail.length;
    this.bones.tail.forEach((entry, i) => {
      const along = i / Math.max(1, m - 1);
      const sway = tailSway * (0.5 + 0.5 * along) * Math.sin(t * 1.1 - along * 1.6 + this.phase * 0.5);
      this.swingBone(entry, 0, sway);
    });
    if (this.bones.jaw) {
      // Chews for a few seconds, then rests, on a slow cycle.
      const chewing = Math.sin(t * 0.35) > 0.2 ? 1 : 0;
      const open = jawOpen * chewing * Math.max(0, Math.sin(t * 2.4));
      this.swingBone(this.bones.jaw, open);
    }
  },

  remove() {
    if (!this.bones) return;
    for (const entry of [...this.bones.hips, ...this.bones.knees, ...this.bones.neck, ...this.bones.tail, this.bones.jaw]) if (entry) entry.bone.quaternion.copy(entry.rest);
    if (this.bones.root) this.bones.root.position.y = this.rootY;
  },
});
