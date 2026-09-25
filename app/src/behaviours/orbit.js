/**
 * Something that flies round in a slow circle overhead.
 *
 * A bird playing its flap cycle at one spot in the sky is a kite. Moving it
 * round a wide circle, nose first, at the height the lesson placed it, is a
 * bird. The circle is centred on where the lesson put the object, so a
 * content author positions it the way they position everything else and
 * adds `orbit` to say "and it flies".
 *
 * Nothing about this is physics. A circle at a steady pace, banked a little
 * into the turn, is what the eye expects of a soaring animal and is all a
 * three-year-old will look at.
 */
AFRAME.registerComponent('orbit', {
  schema: {
    /** Radius of the circle, in metres. */
    radius: { type: 'number', default: 12 },
    /** Seconds for one full circle. */
    period: { type: 'number', default: 40 },
    /** Clockwise seen from above, or the other way. */
    clockwise: { type: 'boolean', default: true },
    /** How much it leans into the turn, in degrees. */
    bank: { type: 'number', default: 12 },
    /** Gentle rise and fall over the circle, in metres. */
    bob: { type: 'number', default: 1.2 },
  },

  init() {
    this.centre = this.el.object3D.position.clone();
    this.phase = Math.random() * Math.PI * 2;
    this.time = 0;
  },

  tick(_, delta) {
    const { radius, period, clockwise, bank, bob } = this.data;
    this.time += delta / 1000;
    const a = this.phase + ((clockwise ? -1 : 1) * this.time * Math.PI * 2) / period;
    const o = this.el.object3D;
    o.position.set(
      this.centre.x + Math.cos(a) * radius,
      this.centre.y + Math.sin(this.time * 0.7) * bob,
      this.centre.z + Math.sin(a) * radius
    );
    // Nose along the tangent, leaning into the turn.
    const heading = a + (clockwise ? -Math.PI / 2 : Math.PI / 2);
    o.rotation.set(0, -heading + Math.PI / 2, 0);
    o.rotateZ(THREE.MathUtils.degToRad(clockwise ? bank : -bank));
  },
});
