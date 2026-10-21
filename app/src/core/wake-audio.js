/**
 * Wake the browser's sound engine on the first touch.
 *
 * Browsers start the sound engine asleep and only let a page wake it once the
 * person has touched the page — a tap, a key, a controller press. Nothing in
 * A-Frame does the waking: its sound component hands each clip to a sleeping
 * engine and reports it as playing. On a laptop that meant the narrator was
 * never heard; on a headset, where no one taps before the lesson starts,
 * the same.
 *
 * There is one engine for the whole scene — every sound component shares the
 * scene's one listener and its context — so waking it once is enough. It is
 * tried on every kind of first touch, including the controller press inside
 * VR, and it is harmless when the engine is already awake.
 */

/** @param {Element} scene the `<a-scene>` */
export function wakeAudioOnFirstTouch(scene) {
  // The listener does not exist until the first clip is named; the shared
  // context behind it can be reached (and made, asleep or awake) regardless.
  const context = () => scene.audioListener?.context ?? AFRAME.THREE.AudioContext.getContext();

  // A tap arrives as several events at once (pointerdown, then click); one
  // request to wake is enough, and one line in the log.
  let waking = false;
  const wake = () => {
    const engine = context();
    if (waking || engine.state !== 'suspended') return;
    waking = true;
    engine.resume().then(
      () => console.log('audio ✓ sound engine awake'),
      (error) => console.warn('audio: the sound engine would not wake yet', error)
    ).finally(() => { waking = false; });
  };

  for (const type of ['pointerdown', 'touchend', 'keydown', 'click']) {
    window.addEventListener(type, wake, { capture: true, passive: true });
  }

  // Inside VR the taps are controller presses, which never reach the window.
  scene.addEventListener('enter-vr', () => {
    wake();
    const session = scene.renderer?.xr?.getSession?.();
    session?.addEventListener('selectstart', wake);
    session?.addEventListener('squeezestart', wake);
  });
}
