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
    /** Hip to hip, in metres. Sets how fast the feet step when it turns. */
    width: { type: 'number', default: 2.4 },
    /** Seconds between grazes, and how far the head goes down (degrees per neck bone). */
    grazeEvery: { type: 'number', default: 28 },
    grazeDip: { type: 'number', default: 3.4 },
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
    const find = (name) => findBone(root, name);
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
    this.rootRest = this.bones.root ? this.bones.root.quaternion.clone() : null;
    // The body's own forward axis (world +Z, the way every model faces),
    // taken into the root bone's frame so the roll is about the spine.
    this.along = new THREE.Vector3(0, 0, 1);
    if (this.bones.root) {
      const inv = this.bones.root.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.along.applyQuaternion(inv).normalize();
    }
    // Leg length, from the hip's height above the ground it stands on. The
    // stride the feet can take without sliding follows from it.
    const hip = this.bones.hips.find(Boolean);
    this.legLength = hip ? Math.max(0.5, hip.bone.getWorldPosition(new THREE.Vector3()).y - this.el.object3D.position.y) : 1;
    this.prevYaw = this.el.object3D.rotation.y;
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
    // The feet step for two reasons: the body going forward, and the body
    // turning on the spot, where the outer feet travel round the inner ones.
    // Both are paced from what actually happened this frame, so the feet
    // never march while the animal stands.
    const yaw = this.el.object3D.rotation.y;
    let dyaw = yaw - this.prevYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.prevYaw = yaw;
    const forwardSpeed = moving ? wander.currentSpeed() * (wander.aligned ?? 1) : 0;
    const turningSpeed = dt > 0 ? (Math.abs(dyaw) / dt) * this.data.width * 0.5 : 0;
    const speed = forwardSpeed + turningSpeed;
    const stepping = speed > 0.03;

    // The swing the feet can make without sliding: the body covers one
    // stride per cycle while each foot spends half the cycle planted, so the
    // hip sweeps through the angle whose chord is that distance.
    const { swing, lift, bob, width } = this.data;
    const theta = Math.min(swing, THREE.MathUtils.radToDeg(Math.asin(Math.min(0.9, this.data.stride / (2 * this.legLength)))));
    const effStride = 2 * this.legLength * Math.sin(THREE.MathUtils.degToRad(theta));

    // Ease in and out, so a stop is a settle and not a freeze.
    this.blend += ((stepping ? 1 : 0) - this.blend) * Math.min(1, dt * 3);
    if (stepping) this.phase += (speed / effStride) * Math.PI * 2 * dt;
    // Once stopped, let the legs finish the half-stride they were on.
    else if (this.blend > 0.01) this.phase += 0.15 * Math.PI * 2 * dt;

    const b = this.blend;
    // Lateral-sequence gait, the walk of every heavy four-legged animal:
    // back-left, front-left, back-right, front-right, a quarter cycle apart.
    // Order here is front-left, front-right, back-left, back-right.
    const offsets = [Math.PI / 2, (3 * Math.PI) / 2, 0, Math.PI];
    this.bones.hips.forEach((hip, i) => {
      const s = Math.sin(this.phase + offsets[i]);
      this.swingBone(hip, theta * s * b);
      // Knee bends as the leg comes forward, straight as it bears weight.
      const forward = Math.max(0, Math.cos(this.phase + offsets[i]));
      this.swingBone(this.bones.knees[i], -lift * forward * b);
    });
    if (this.bones.root) {
      // Rises a little twice a cycle, and rolls onto whichever side is
      // bearing the weight, so the body moves with the legs and not above them.
      this.bones.root.position.y = this.rootY + bob * Math.abs(Math.sin(this.phase * 2)) * b;
      this.roll = 2.2 * Math.sin(this.phase) * b;
    }

    // The slow life of the rest of the animal: a neck that roams, a tail that
    // sways, a mouth that chews now and then. These run whether it walks or
    // stands, because a still animal that breathes is alive and one that
    // does not is a statue.
    this.life += dt;
    const t = this.life;
    const { neckSway, tailSway, jawOpen } = this.data;
    const n = this.bones.neck.length;
    // Grazing: every so often, standing still, the head goes down to the
    // grass and stays a while, chewing. The single most sauropod thing it
    // can do, and the thing a child waits for.
    const { grazeEvery, grazeDip } = this.data;
    const g = Math.max(0, Math.sin((t * Math.PI * 2) / grazeEvery));
    const graze = g * g * (1 - b);
    this.bones.neck.forEach((entry, i) => {
      const along = i / Math.max(1, n - 1);
      // Head dips toward the ground and rises, and looks left and right.
      const roam = neckSway * (Math.sin(t * 0.45 + along * 1.2) * 0.9 + Math.sin(t * 0.17) * 0.6);
      const turn = neckSway * 0.8 * Math.sin(t * 0.3 + along * 0.8) * (1 - graze * 0.7);
      // Walking, the neck is held; grazing, it curves down bone by bone.
      const nod = roam * (1 - b * 0.6) + grazeDip * graze * (0.4 + 0.6 * along);
      this.swingBone(entry, nod, turn);
    });
    const m = this.bones.tail.length;
    this.bones.tail.forEach((entry, i) => {
      const along = i / Math.max(1, m - 1);
      const sway = tailSway * (0.5 + 0.5 * along) * Math.sin(t * 1.1 - along * 1.6 + this.phase * 0.5);
      this.swingBone(entry, 0, sway);
    });
    if (this.bones.jaw) {
      // Chews while the head is down in the grass, and now and then otherwise.
      const chewing = graze > 0.5 || Math.sin(t * 0.35) > 0.6 ? 1 : 0;
      const open = jawOpen * chewing * Math.max(0, Math.sin(t * 2.4));
      this.swingBone(this.bones.jaw, open);
    }
    // The roll goes on last, on the root, about the animal's own length.
    if (this.bones.root && this.rootRest) {
      const q = this.q.setFromAxisAngle(this.along, THREE.MathUtils.degToRad(this.roll ?? 0));
      this.bones.root.quaternion.copy(this.rootRest).multiply(q);
    }
  },

  remove() {
    if (!this.bones) return;
    for (const entry of [...this.bones.hips, ...this.bones.knees, ...this.bones.neck, ...this.bones.tail, this.bones.jaw]) if (entry) entry.bone.quaternion.copy(entry.rest);
    if (this.bones.root) { this.bones.root.position.y = this.rootY; if (this.rootRest) this.bones.root.quaternion.copy(this.rootRest); }
  },
});
