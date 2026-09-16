/**
 * The thing the viewer stands on.
 *
 * Until now the camera *was* the viewer: `<a-camera position="0 1.2 0">`, and
 * everything that moved somebody moved the camera. That works perfectly on a
 * flat screen and breaks in two ways the moment a headset is involved.
 *
 * **Height doubles.** In VR the headset reports where the head actually is,
 * measured from the floor. A-Frame does not remove a position you put on the
 * camera yourself — it adds the headset's pose to it. So a 1.2 m offset plus a
 * seated child's real 1.1 m puts the eyes at 2.3 m, and the whole world reads
 * as a model seen from a stepladder.
 *
 * **Hands end up in the wrong place.** Controllers are tracked in the same
 * floor-relative space as the head. Put them at the scene root while the
 * camera carries its own offset and the hands appear at the viewer's feet,
 * lagging behind whenever they walk.
 *
 * Both are the same mistake: the offset belongs to the *person*, not to their
 * eyes. So there is now a rig. The rig is where the viewer is standing; the
 * camera sits at zero inside it and the headset moves it; the controllers are
 * siblings of the camera and are carried along.
 *
 * On a flat screen there is no headset to supply a height, so the rig carries
 * the eye height itself. In VR it drops to zero and lets the headset do it.
 * That is the whole component.
 */

AFRAME.registerComponent('viewer-rig', {
  schema: {
    /**
     * How high the eyes sit on a flat screen, in metres.
     *
     * 1.2 is a seated child, not A-Frame's 1.6 m adult default.
     */
    eyeHeight: { type: 'number', default: 1.2 },
  },

  init() {
    this.onModeChange = () => this.applyHeight();

    const scene = this.el.sceneEl;
    scene.addEventListener('enter-vr', this.onModeChange);
    scene.addEventListener('exit-vr', this.onModeChange);

    // The renderer's own events too, because `enter-vr` fires for things that
    // are not VR at all — see `immersive`.
    const xr = scene.renderer?.xr;
    xr?.addEventListener('sessionstart', this.onModeChange);
    xr?.addEventListener('sessionend', this.onModeChange);

    this.applyHeight();
  },

  remove() {
    const scene = this.el.sceneEl;
    scene.removeEventListener('enter-vr', this.onModeChange);
    scene.removeEventListener('exit-vr', this.onModeChange);

    const xr = scene.renderer?.xr;
    xr?.removeEventListener('sessionstart', this.onModeChange);
    xr?.removeEventListener('sessionend', this.onModeChange);
  },

  /**
   * True once the headset is supplying its own floor-relative head pose.
   *
   * A method, not a getter, and that is not a style choice. A-Frame builds a
   * component's prototype by reading every key off the definition object — and
   * reading a getter *calls* it, with `this` still the plain object literal.
   * `this.el` is undefined at that moment, so it throws during
   * `registerComponent`, which fails the module, which fails everything that
   * imports it. The whole app went dark and the only symptom was a rig with no
   * components on it.
   */
  immersive() {
    // `sceneEl.is('vr-mode')` is the obvious test and it is wrong. A-Frame
    // raises vr-mode for **fullscreen** as well, and for the phone-in-a-holder
    // magic window — neither of which has a headset reporting a head position.
    // Trusting it meant that clicking fullscreen on a laptop dropped the rig
    // to zero, and the whole scene was viewed from ground level with the
    // horizon at the viewer's ankles.
    //
    // `xr.isPresenting` is true only inside a real immersive session, which is
    // the only case where something else is supplying the height.
    return Boolean(this.el.sceneEl.renderer?.xr?.isPresenting);
  },

  applyHeight() {
    this.el.object3D.position.y = this.immersive() ? 0 : this.data.eyeHeight;
  },

  /**
   * Put the viewer somewhere.
   *
   * The one way anything should move a person: portals arriving, a land
   * declaring where it starts, walking. The `y` a caller passes is an eye
   * height, which is meaningful on a screen and meaningless in a headset — so
   * it is used on one and ignored on the other, and no caller has to know
   * which it is talking to.
   */
  moveTo(x, y, z) {
    this.el.object3D.position.set(
      x,
      this.immersive() ? 0 : (y ?? this.data.eyeHeight),
      z
    );
  },
});
