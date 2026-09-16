/**
 * The highlight ring.
 *
 * This is the entire teaching mechanic. The audience cannot read, so a lesson
 * cannot label the thing it is naming — it points at it. A pulsing yellow ring
 * on the ground under an object says "this one" in every language at once, and
 * costs one torus to draw.
 *
 * It is a component and not a template's private detail because every template
 * needs it: identify points at one object, count points at each in turn, match
 * points at a pair.
 *
 * ## When the entity is not where the thing is
 *
 * The ring hangs off the entity, which for almost everything is also where the
 * object stands. A planet is the exception: its entity sits at the centre of
 * the solar system and the planet itself is somewhere out on an orbit, moving.
 * Ringing the entity put the ring round the Sun no matter which planet was
 * being named.
 *
 * So a component may implement `highlightAnchor()`, returning the object the
 * ring should follow and how big it should be. Nothing else has to know.
 */

const position = new THREE.Vector3();
const facing = new THREE.Quaternion();
const inverse = new THREE.Quaternion();

AFRAME.registerComponent('highlight', {
  schema: {
    radius: { type: 'number', default: 0.9 },
    color: { type: 'color', default: '#ffe14d' },
  },

  init() {
    const ring = document.createElement('a-torus');

    ring.setAttribute('radius', this.data.radius);
    ring.setAttribute('radius-tubular', 0.04);
    ring.setAttribute('segments-tubular', 24);
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', '0 0.02 0');
    ring.setAttribute('color', this.data.color);
    // Flat shading: the ring is a symbol, not an object in the world, and it
    // must read the same wherever the light happens to fall.
    ring.setAttribute('material', 'shader: flat');
    ring.setAttribute('animation', {
      property: 'scale',
      to: '1.15 1.15 1.15',
      dir: 'alternate',
      loop: true,
      dur: 900,
      easing: 'easeInOutSine',
    });

    this.ring = ring;
    this.el.appendChild(ring);

    // If something on this entity knows better, follow that instead.
    const host = Object.values(this.el.components).find(
      (c) => typeof c.highlightAnchor === 'function'
    );
    this.anchor = host?.highlightAnchor() ?? null;

    if (this.anchor?.radius) {
      ring.setAttribute('radius', this.anchor.radius);
      // Thin, and see-through if asked. On the ground a fat opaque ring is
      // right — it is a mark on the floor. Around a planet it is a hoop in
      // mid-air in front of the thing it is pointing at, and a fat one hides
      // what it was drawing attention to.
      ring.setAttribute('radius-tubular', this.anchor.radius * (this.anchor.thickness ?? 0.05));
      if (this.anchor.opacity != null) {
        ring.setAttribute('material', `shader: flat; opacity: ${this.anchor.opacity}; transparent: true`);
      }
    }
  },

  /**
   * Follow the anchor, if there is one.
   *
   * Re-parenting the ring into the moving group would be tidier and is not
   * possible: the ring is an A-Frame entity and its object3D belongs to this
   * entity's own graph. Copying the world position each frame is three lines
   * and works for something that moves as well as for something that does not.
   */
  tick() {
    if (!this.anchor?.object3D || !this.ring) return;

    const world = this.anchor.object3D.getWorldPosition(position);
    this.el.object3D.worldToLocal(world);
    this.ring.object3D.position.copy(world);

    if (!this.anchor.billboard) return;

    // Turned to face the viewer.
    //
    // A ring lying flat is right on the ground — it is a mark on the floor
    // under the thing. Around a planet there is no floor, and a flat ring
    // reads as one more orbit: an ellipse near the Sun, which is exactly what
    // it must not look like. Facing the camera it is unmistakably a circle
    // drawn round something.
    const camera = this.el.sceneEl.camera;
    if (!camera) return;

    camera.getWorldQuaternion(facing);
    this.el.object3D.getWorldQuaternion(inverse).invert();
    this.ring.object3D.quaternion.copy(inverse).multiply(facing);
  },

  remove() {
    if (this.ring?.parentNode) this.ring.parentNode.removeChild(this.ring);
    this.ring = null;
  },
});
