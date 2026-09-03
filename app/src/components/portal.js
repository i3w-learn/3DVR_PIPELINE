/**
 * Walking from one land into another.
 *
 * ## Why a land and not a room
 *
 * "Going inside the school" cannot be a door you walk through into the same
 * scene. An interior needs its own floor, its own walls, no sky and its own
 * light; an exterior at noon and a corridor under a tube light are two
 * different lightings, and one scene cannot hold both without lighting each
 * badly. So indoor and outdoor are separate lands — that is the PRD's design,
 * not a shortcut.
 *
 * What was missing was the join. The child could be *put* inside, by the
 * teacher choosing the classroom lesson; they could not *walk* in. This is the
 * join: a spot on the floor that, when somebody walks onto it, moves the whole
 * class to the land on the other side.
 *
 * ## Who it fires for
 *
 * The teacher, and only the teacher. She is the one who walks; the child in
 * the headset is seated and never moves, because moving them is what makes
 * three-year-olds sick. She steps through the door and the class arrives with
 * her — the transport already carries "everybody is now in this lesson", so
 * nothing new is published and no second code path exists.
 *
 * ## Where you come out
 *
 * Every land is its own coordinate system, so a portal has to say where on the
 * far side you land and which way you are looking. Dropping everybody at the
 * origin was the first version and it was wrong in the way that matters: you
 * walked out of the school's front door and found yourself at the front gate,
 * twenty metres away, with your back to the building. You had gone outside and
 * the school was not there.
 *
 * So `arrive` is the spot and `facing` is the direction, both given by the
 * portal, both in the destination's own coordinates.
 */

const cameraPosition = new THREE.Vector3();
const selfPosition = new THREE.Vector3();

/**
 * True from the moment any portal fires until the next land has been built.
 *
 * It has to be shared, not per-portal, because of what firing does: it moves
 * the camera. The other portals in the land the teacher is leaving are still
 * ticking, they see the camera at its new spot, and they fire too.
 *
 * That is not theoretical. Walking into the hallway's classroom door landed
 * the class in the office: the classroom portal fired and put the camera at
 * the classroom's entrance, which in the hallway's own coordinates was inside
 * the hallway's exit; that fired and put the camera outside the front door,
 * which was inside the office doorway; and that fired last, so that is where
 * everybody ended up. Three doors opened in one step, and the last one won.
 *
 * Once one has fired, the land is on its way out and nothing left in it may
 * act again. The next land's portals clear this when they initialise.
 */
let travelling = false;

/**
 * Turn the camera to face a given direction.
 *
 * Setting the entity's rotation alone does nothing that lasts: `look-controls`
 * keeps its own yaw and pitch and writes them back over ours on the next tick.
 * Its two objects have to be set as well, or the teacher is turned for exactly
 * one frame.
 */
function aim(cameraEl, degrees) {
  const yaw = THREE.MathUtils.degToRad(degrees);

  cameraEl.object3D.rotation.set(0, yaw, 0);

  const look = cameraEl.components['look-controls'];
  if (!look) return;

  look.yawObject.rotation.y = yaw;
  look.pitchObject.rotation.x = 0;
}

AFRAME.registerComponent('portal', {
  schema: {
    /** The lesson on the other side. */
    to: { type: 'string' },

    /** How close you have to be to step through, in metres. */
    radius: { type: 'number', default: 1.3 },

    /** Where you stand on the far side, in the destination's coordinates. */
    arrive: { type: 'vec3', default: { x: 0, y: 1.2, z: 0 } },

    /** Which way you look on arrival, in degrees. 0 looks down -Z. */
    facing: { type: 'number', default: 0 },
  },

  init() {
    this.crossed = false;

    /**
     * A portal will not fire until the viewer has first stood clear of it.
     *
     * Every land starts the camera at the origin, and a room's way out is
     * near the origin by definition — so the office threw you straight back
     * into the corridor before its first frame was drawn. Tuning the
     * distances would have hidden that until the next room was placed
     * slightly differently; refusing to fire on a doorway you are already
     * standing in fixes it for every room there will ever be.
     */
    this.armed = false;

    // A new land's portals are new components. Their existence is the signal
    // that the last move finished.
    travelling = false;
  },

  tick() {
    if (travelling || this.crossed || !this.data.to) return;

    const camera = this.el.sceneEl.camera;
    if (!camera) return;

    camera.getWorldPosition(cameraPosition);
    this.el.object3D.getWorldPosition(selfPosition);

    // Flat distance. The threshold is on the floor and the teacher's eyes are
    // a metre and a half above it; counting that height would mean she could
    // never reach it.
    cameraPosition.y = selfPosition.y;

    if (cameraPosition.distanceTo(selfPosition) > this.data.radius) {
      this.armed = true;
      return;
    }

    if (!this.armed) return;

    // Once. The lesson takes a moment to load, and a portal that keeps firing
    // during that moment publishes the same move a dozen times.
    this.crossed = true;
    travelling = true;

    // Tell the next land that somebody walked in, so it leaves the camera
    // where this portal put it rather than moving them to its own start.
    this.el.sceneEl.dataset.arrived = '1';

    const { arrive, facing } = this.data;
    camera.el.object3D.position.set(arrive.x, arrive.y, arrive.z);
    aim(camera.el, facing);

    this.el.sceneEl.emit('portal-enter', { to: this.data.to });
  },
});
