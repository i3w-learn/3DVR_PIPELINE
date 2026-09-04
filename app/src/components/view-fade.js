/**
 * A fade to black, and back.
 *
 * Walking through a door swaps one land for another in a single frame. On a
 * laptop that is a jump cut. In a headset it is worse than that: the whole
 * world is replaced while the child's head is mid-turn, with no motion
 * connecting the two, and a hard cut is one of the reliable ways to make
 * somebody feel ill. Every VR title that moves you anywhere fades first, and
 * this is why.
 *
 * It also hides something honest: a lesson's models load after the lesson is
 * built, so the first frames of a new land are half-empty. Two hundred
 * milliseconds of black is enough for the geometry to arrive, and the child
 * never sees a school with no walls.
 *
 * ## Why it is geometry and not a black div
 *
 * A DOM overlay is not in the headset's view. Inside WebXR the page is not
 * being composited — the renderer is drawing two eye buffers, and nothing in
 * the document appears in either. So the fade has to be a thing in the scene:
 * a small black sphere around the head, drawn last, with depth testing off so
 * it covers everything regardless of what is between.
 */

AFRAME.registerComponent('view-fade', {
  schema: {
    /** How long a full fade takes, in milliseconds. */
    duration: { type: 'number', default: 220 },
  },

  init() {
    // Small, and inside-out. A sphere 40 cm across sits inside the near plane
    // of both eyes, so it covers the view without ever being visible as an
    // object; `BackSide` is what makes its inner surface the one drawn.
    const geometry = new THREE.SphereGeometry(0.4, 12, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      // Drawn last and against nothing: with depth testing on, any wall closer
      // than the sphere would punch a hole through the fade.
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 9999;
    this.mesh.visible = false;
    this.el.object3D.add(this.mesh);

    this.opacity = 0;
    this.target = 0;
    this.settled = null;
  },

  remove() {
    this.el.object3D.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  },

  /**
   * Fade to `value` — 1 for black, 0 for clear.
   *
   * Returns a promise that settles when it gets there, so a caller can write
   * the sequence as it reads: go dark, rebuild the world, come back.
   *
   * @returns {Promise<void>}
   */
  to(value) {
    this.target = value;
    if (this.opacity === value) return Promise.resolve();

    return new Promise((resolve) => {
      this.settled = resolve;
    });
  },

  tick(time, delta) {
    if (this.opacity === this.target) return;

    // A frame the renderer skipped can arrive as a very large delta. Capped,
    // or one stalled second snaps the fade instead of playing it.
    delta = Math.min(delta, 100);

    const step = delta / this.data.duration;
    const remaining = this.target - this.opacity;

    this.opacity = Math.abs(remaining) <= step
      ? this.target
      : this.opacity + Math.sign(remaining) * step;

    this.mesh.material.opacity = this.opacity;

    // Hidden rather than transparent when clear, so a fade that is not running
    // costs nothing at all.
    this.mesh.visible = this.opacity > 0;

    if (this.opacity !== this.target) return;

    const settled = this.settled;
    this.settled = null;
    settled?.();
  },
});
