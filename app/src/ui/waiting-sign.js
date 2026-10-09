/**
 * What a child sees before the teacher starts.
 *
 * A headset that comes up before the tablet has said anything shows an empty
 * stage, and an empty stage looks broken: the child takes the headset off and
 * the teacher gets up to see what is wrong. So the headset says what it is
 * doing — waiting — in the scene itself, where a child in VR can read it, and
 * says in smaller letters whether it can hear the tablet at all, which is the
 * one fact a teacher needs when a headset is not following.
 *
 * It sits on the rig, so it stays in front of the child whichever way they
 * turn, and it is removed the moment the first state message arrives.
 */

/** The same atlas the glyph cards use. Vendored; see glyph.js. */
const FONT = 'lib/fonts/noto-msdf.json';

/**
 * @param {{scene: Element}} elements
 * @param {import('../core/transport.js').Transport} transport
 */
export function waitingSign(elements, transport) {
  const sign = document.createElement('a-entity');
  sign.setAttribute('id', 'waiting');
  // A little below a grown-up's eye line and about where a child's is: in
  // front, at reading distance, and not in the way of anything that arrives.
  sign.setAttribute('position', '0 1.2 -2.2');

  const card = document.createElement('a-plane');
  card.setAttribute('width', 1.6);
  card.setAttribute('height', 0.5);
  card.setAttribute('material', { color: '#22303c', shader: 'flat' });
  sign.appendChild(card);

  const title = line('Waiting for the teacher', 0.09, 0.08);
  const status = line('', -0.1, 0.045);
  sign.appendChild(title);
  sign.appendChild(status);

  document.querySelector('#rig').appendChild(sign);

  // Only the classroom transport knows whether the tablet can hear us. On a
  // laptop there is no tablet to look for, and the line stays empty.
  const timer = 'connected' in transport
    ? setInterval(() => {
        status.setAttribute('text', 'value', transport.connected ? 'Connected to the tablet' : 'Looking for the tablet…');
      }, 500)
    : null;

  return {
    /** Safe to call on every state message; only the first one does anything. */
    remove() {
      if (!sign.parentNode) return;
      console.log('headset ✓ the teacher has started');
      clearInterval(timer);
      sign.parentNode.removeChild(sign);
    },
  };
}

function line(value, y, height) {
  const el = document.createElement('a-entity');
  el.setAttribute('position', `0 ${y} 0.01`);
  el.setAttribute('text', {
    value,
    font: FONT,
    color: '#fbf7ee',
    align: 'center',
    anchor: 'center',
    baseline: 'center',
    width: 1.5,
    wrapCount: height > 0.06 ? 24 : 40,
    // See glyph.js: the vendored atlas stores coverage the other way round
    // from A-Frame's own fonts, and clips thin strokes at the default test.
    negate: false,
    alphaTest: 0.2,
  });
  return el;
}
