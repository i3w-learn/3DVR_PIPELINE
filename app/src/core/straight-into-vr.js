/**
 * Straight into VR, when a VR browser presses "enter VR" for us.
 *
 * The headset app opens this page in Wolvic and tells Wolvic to press
 * A-Frame's "enter VR" button itself, the moment the page has loaded (see
 * `openStraightIntoVr` in the VR-app repo). Wolvic adds
 * `wolvic-launchimmersive-targetElementXPath=…` to the address when it does.
 *
 * That press comes too soon. A-Frame asks the browser "can you do VR?" when
 * it starts, and the answer arrives a little later. Until it has arrived,
 * A-Frame treats a press on the button as "go fullscreen", not "enter VR",
 * and a fullscreen request with no real finger behind it is refused
 * (`Fullscreen request denied` in the app's log). Wolvic presses once and
 * never again, so the lesson stays a flat window inside Wolvic.
 *
 * So the press is held until A-Frame has its answer, and then made good. A
 * person's own press, on a laptop or in any browser that does not press for
 * us, is never held: that address has no such parameter.
 */

/** The parameter Wolvic adds to the address when it will press the button. */
export const PRESSED_BY_WOLVIC = 'wolvic-launchimmersive-targetElementXPath';

const BUTTON = '.a-enter-vr-button';

/** How often to look for A-Frame's answer, in ms. */
const EVERY = 100;

/** When to stop looking, in ms. Wolvic itself stops trying after 20 s. */
const GIVE_UP = 20_000;

export function holdEnterVrUntilReady(scene) {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const ready = () => AFRAME.utils.device.checkVRSupport();

  scene.addEventListener('enter-vr', () => console.log(`straight into VR ✓ after ${elapsed()} ms`));

  // On the document, in the capture phase: this runs before A-Frame's own
  // listener on the button, so a press that is too early can be stopped there.
  document.addEventListener(
    'click',
    (event) => {
      if (!event.target.closest?.(BUTTON)) return;
      if (ready()) return; // A-Frame will enter VR itself.

      event.stopImmediatePropagation();
      event.preventDefault();
      console.log(`straight into VR: pressed at ${elapsed()} ms, before VR support was known; holding`);

      const timer = setInterval(() => {
        if (ready()) {
          clearInterval(timer);
          console.log(`straight into VR: support known at ${elapsed()} ms, entering`);
          Promise.resolve(scene.enterVR()).catch((error) => console.error('straight into VR: enterVR failed', error));
        } else if (performance.now() - started > GIVE_UP) {
          clearInterval(timer);
          console.warn('straight into VR: VR support never reported; the button is left to the person');
        }
      }, EVERY);
    },
    true,
  );
}
