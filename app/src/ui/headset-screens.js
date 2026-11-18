/**
 * What a child sees in the headset when no lesson is playing.
 *
 * A lesson fills the whole view and has nothing drawn over it. Everything
 * else a headset can be doing is said here, on one panel that floats about
 * two metres in front of the child, under a calm night sky:
 *
 *   splash      the mark, for the first moments
 *   searching   "Looking for the classroom…"       no tablet heard yet
 *   waiting     "Waiting for the teacher's tablet"  still none after a while
 *   connecting  "Connecting…"                       the tablet has just answered
 *   ready       "Ready!"                            connected, no lesson on
 *   done        "Well done!"                        a lesson has just ended
 *   moment      "One moment…"                       lost the tablet mid-lesson
 *   back        "Welcome back!"                     headset put back on mid-lesson
 *
 * The words are for the grown-up helping; the picture and the colour are for
 * a child who cannot read yet. Nothing here can be pressed by a child except
 * Connect, which only an adult setting up would look at, and which does
 * nothing a headset is not already doing by itself.
 *
 * The panel is drawn as a flat picture (a canvas) and shown on one plane.
 * That is what lets it use ordinary text in any script, rounded corners and
 * the colours of the teacher's app, none of which A-Frame's own text can do.
 * It sits on the rig, not on the camera, so it stays put in the room while
 * the child looks around: nothing is ever stuck to their face.
 *
 * The design is the Figma file "VR learning system", headset screens H01–H09.
 */

/** The mark alone, before anything is said. */
const SPLASH_MS = 2500;
/** Searching this long with no tablet: say we are waiting for it. */
const WAITING_AFTER_MS = 20000;
/** How long "Connecting…" is shown once the tablet answers. */
const CONNECTING_MS = 1200;
/** A gap this short mid-lesson is not worth mentioning. */
const LOST_AFTER_MS = 2000;
/** How long "Welcome back!" is shown. */
const WELCOME_MS = 2500;

/** The panel, in metres, and the picture drawn on it, in pixels. */
const WIDTH = 1.4;
const HEIGHT = 1.05;
const PX = 1024;
const PY = 768;

const NAVY = '#15143c';
const AMBER = '#f6a623';
const GREEN = '#2f9e6c';
const CREAM = '#f3e6cf';

const WORDS = {
  en: {
    searching: 'Looking for the classroom…',
    waiting: "Waiting for the teacher's tablet",
    waitingText: 'Your teacher will start the lesson soon.',
    connect: 'Connect',
    connecting: 'Connecting…',
    ready: 'Ready!',
    readyText: 'Connected. The lesson will begin when your teacher starts it.',
    done: 'Well done!',
    doneText: 'You can take the headset off now.',
    moment: 'One moment…',
    back: 'Welcome back!',
    backText: 'Catching up with your class…',
    steps: ['Searching', 'Connecting', 'Connected'],
  },
  // A first draft, not yet read by a native speaker.
  mr: {
    searching: 'वर्ग शोधत आहे…',
    waiting: 'शिक्षकांच्या टॅबलेटची वाट पाहत आहे',
    waitingText: 'तुमचे शिक्षक लवकरच धडा सुरू करतील.',
    connect: 'जोडा',
    connecting: 'जोडत आहे…',
    ready: 'तयार!',
    readyText: 'जोडले. शिक्षक सुरू करतील तेव्हा धडा सुरू होईल.',
    done: 'शाब्बास!',
    doneText: 'आता तुम्ही हेडसेट काढू शकता.',
    moment: 'एक क्षण…',
    back: 'पुन्हा स्वागत!',
    backText: 'तुमच्या वर्गाबरोबर येत आहे…',
    steps: ['शोधत आहे', 'जोडत आहे', 'जोडले'],
  },
};

/** Devanagari, from the file the lessons already carry: a headset has no such font of its own. */
const FONT = '"Baloo 2", "Baloo Bhai 2", "Headset Devanagari", system-ui, sans-serif';
let fontRequest = null;
function loadFont() {
  fontRequest ??= new FontFace('Headset Devanagari', 'url(lib/fonts/NotoSansDevanagari-Regular.ttf)')
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {});
  return fontRequest;
}

/**
 * @param {{scene: Element, voice: Element, sfx: Element}} elements
 * @param {import('../core/transport.js').Transport} transport
 * @param {import('../core/session.js').Session} session read for the language
 */
export function headsetScreens(elements, transport, session) {
  const { scene } = elements;
  const rig = document.querySelector('#rig');
  const started = Date.now();

  let lesson = false; // a lesson is on
  let finished = false; // one has ended since the tablet was last heard
  let searchingSince = 0;
  let connectedSince = 0;
  let lostSince = 0;
  let takenOff = false;
  let welcomeUntil = 0;
  let shown = null; // `${screen}/${lang}` last drawn

  const night = buildNight();
  const dim = buildDim();
  const { holder, panel, button, draw } = buildPanel(() => {
    // An adult asked for another try. The headset never stopped trying, so
    // all there is to do is say so again.
    console.log('headset ✓ Connect pressed: looking for the classroom again');
    searchingSince = Date.now();
  });
  rig.append(night, dim, holder);

  // Taking the headset off mid-lesson mutes it; putting it back on says
  // "welcome back" while the next step arrives. The child's only control.
  scene.addEventListener('exit-vr', () => {
    if (!lesson) return;
    takenOff = true;
    for (const channel of [elements.voice, elements.sfx]) channel?.components?.sound?.stopSound();
  });
  scene.addEventListener('enter-vr', () => {
    if (lesson && takenOff) welcomeUntil = Date.now() + WELCOME_MS;
    takenOff = false;
  });

  function decide() {
    const now = Date.now();
    // Only the classroom transport knows whether the tablet can hear us. On
    // a laptop, with everything in one page, there is nothing to look for.
    const connected = !('connected' in transport) || transport.connected;

    if (lesson) {
      if (connected) lostSince = 0;
      else lostSince ||= now;
      if (lostSince && now - lostSince > LOST_AFTER_MS) return 'moment';
      if (now < welcomeUntil) return 'back';
      return 'playing';
    }
    if (now - started < SPLASH_MS) return 'splash';
    if (!connected) {
      connectedSince = 0;
      finished = false;
      searchingSince ||= now;
      return now - searchingSince > WAITING_AFTER_MS ? 'waiting' : 'searching';
    }
    searchingSince = 0;
    connectedSince ||= now;
    if (now - connectedSince < CONNECTING_MS) return 'connecting';
    return finished ? 'done' : 'ready';
  }

  function refresh() {
    const screen = decide();
    const lang = WORDS[session.lang] ? session.lang : 'en';

    // Eye level, whether the rig is carrying the height (a flat screen) or
    // the headset is (VR). See viewer-rig.
    holder.object3D.position.y = 1.2 - rig.object3D.position.y;
    dim.object3D.position.y = holder.object3D.position.y;
    // And the night's floor on the real floor, for the same reason.
    night.object3D.position.y = -rig.object3D.position.y;

    const key = `${screen}/${lang}`;
    if (key === shown) return;
    shown = key;
    console.log(`headset · screen: ${screen}`);

    const overLesson = screen === 'moment' || screen === 'back';
    night.object3D.visible = screen !== 'playing' && !overLesson;
    dim.object3D.visible = overLesson;
    holder.object3D.visible = screen !== 'playing';
    // The checks, and anything else that asks "is this headset waiting?",
    // look for this name. It is only there when no lesson is on.
    if (lesson) holder.removeAttribute('id');
    else holder.setAttribute('id', 'waiting');
    holder.dataset.screen = screen;

    button.classList.toggle('clickable', screen === 'waiting');
    button.object3D.visible = screen === 'waiting';
    if (screen !== 'playing') loadFont().then(() => { if (shown === key) draw(screen, WORDS[lang]); });
    if (screen !== 'playing') draw(screen, WORDS[lang]);
  }

  const timer = setInterval(refresh, 250);
  panel.addEventListener('loaded', refresh);

  return {
    /** The tablet said where the class is: on a lesson, or nowhere. */
    lesson(on) {
      if (lesson && !on) finished = true;
      if (on) finished = false;
      lesson = on;
      if (!on) { takenOff = false; welcomeUntil = 0; lostSince = 0; }
      refresh();
    },
    stop() {
      clearInterval(timer);
    },
  };
}

/**
 * Show a flat colour as the colour it was given.
 *
 * The lessons are drawn through a film-like filter that makes sunlight look
 * right and shifts every colour a little on the way. These screens are not
 * lit scenes; their navy and amber are the teacher's app's own, and have to
 * come out the same.
 */
function trueColour(el) {
  const apply = () => {
    const material = el.getObject3D('mesh')?.material;
    if (!material) return;
    material.toneMapped = false;
    material.needsUpdate = true;
  };
  el.addEventListener('object3dset', apply);
  el.addEventListener('loaded', apply);
  return el;
}

/* ─────────────────────────────── the night ─────────────────────────────── */

/**
 * A dome of night sky, a moon, a few stars and two low hills. It covers
 * whatever land the last lesson left behind, so a headset that is waiting
 * always looks the same.
 */
function buildNight() {
  const night = document.createElement('a-entity');
  night.setAttribute('id', 'night');
  const add = (tag, attributes) => {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
    night.appendChild(el);
    return trueColour(el);
  };
  const flat = (color) => ({ shader: 'flat', color, fog: false, side: 'double' });

  add('a-sphere', { radius: 60, 'segments-width': 24, 'segments-height': 12, material: { ...flat('#16163f'), side: 'back' } });
  add('a-circle', { radius: 60, rotation: '-90 0 0', position: '0 0.02 0', material: flat('#25256a') });
  add('a-circle', { radius: 2.6, position: '14 12 -34', material: flat(CREAM) });
  // Hills: wide, flattened balls beyond the panel.
  add('a-sphere', { radius: 30, scale: '1 0.16 1', position: '-18 -1.6 -42', material: flat('#2b2b72') });
  add('a-sphere', { radius: 34, scale: '1 0.13 1', position: '22 -1.8 -46', material: flat('#3a3a8c') });
  for (const [x, y, z] of [[-20, 16, -40], [-8, 22, -44], [6, 18, -46], [24, 20, -38], [-30, 10, -30], [32, 8, -30], [-14, 30, -34], [16, 28, -40]]) {
    add('a-circle', { radius: 0.12, position: `${x} ${y} ${z}`, material: flat('#aab0ff') });
  }
  return night;
}

/** A soft dark veil over a lesson that has been interrupted, so it is not lost to black. */
function buildDim() {
  const dim = document.createElement('a-sphere');
  dim.setAttribute('radius', 3);
  dim.setAttribute('material', { shader: 'flat', color: '#0b0a26', opacity: 0.55, transparent: true, side: 'back', fog: false, depthTest: false });
  dim.object3D.visible = false;
  return trueColour(dim);
}

/* ─────────────────────────────── the panel ─────────────────────────────── */

function buildPanel(onConnect) {
  const holder = document.createElement('a-entity');
  holder.setAttribute('position', '0 1.2 -2.1');

  const canvas = document.createElement('canvas');
  canvas.width = PX;
  canvas.height = PY;
  const ctx = canvas.getContext('2d');

  const panel = document.createElement('a-plane');
  panel.setAttribute('width', WIDTH);
  panel.setAttribute('height', HEIGHT);
  panel.setAttribute('material', { shader: 'flat', transparent: true, fog: false, depthTest: false });
  holder.appendChild(trueColour(panel));

  // Nothing to see: the place on the panel where the Connect button is
  // drawn, so that looking at it (or pointing at it) presses it.
  const button = document.createElement('a-plane');
  button.setAttribute('material', { shader: 'flat', opacity: 0, transparent: true });
  button.addEventListener('click', onConnect);
  holder.appendChild(button);

  let texture = null;
  function draw(screen, words) {
    const pressable = paint(ctx, screen, words);
    const mesh = panel.getObject3D('mesh');
    if (!mesh) return;
    if (!texture) {
      texture = new AFRAME.THREE.CanvasTexture(canvas);
      texture.colorSpace = AFRAME.THREE.SRGBColorSpace;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    }
    texture.needsUpdate = true;
    mesh.renderOrder = 10;

    if (pressable) {
      const metre = WIDTH / PX;
      button.setAttribute('width', pressable.w * metre);
      button.setAttribute('height', pressable.h * metre);
      button.object3D.position.set((pressable.x + pressable.w / 2 - PX / 2) * metre, (PY / 2 - pressable.y - pressable.h / 2) * metre, 0.01);
    }
  }

  return { holder, panel, button, draw };
}

/**
 * Draw one screen. Returns where the Connect button is, when there is one.
 * Everything is laid out from the middle: the picture, the big words, the
 * small words, then the steps or the button, centred as a block.
 */
function paint(ctx, screen, words) {
  ctx.clearRect(0, 0, PX, PY);
  const cx = PX / 2;

  if (screen === 'splash') {
    tile(ctx, cx - 110, PY / 2 - 110, 220);
    return null;
  }

  const title = words[screen];
  const text = words[`${screen}Text`];
  const steps = { searching: 0, connecting: 1, ready: 3 }[screen];

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 68px ${FONT}`;
  const titleLines = wrap(ctx, title, 800);
  ctx.font = `400 34px ${FONT}`;
  const textLines = text ? wrap(ctx, text, 760) : [];

  const emblem = 190;
  const height = emblem + 36 + titleLines.length * 80 + (textLines.length ? 20 + textLines.length * 46 : 0)
    + (steps !== undefined ? 96 : 0) + (screen === 'waiting' ? 126 : 0);
  // The two that sit over a lesson are small badges; the rest are full cards.
  const small = screen === 'moment' || screen === 'back';
  const cardW = small ? 640 : 940;
  const cardH = Math.min(PY - 24, height + 110);
  const top = (PY - cardH) / 2;

  round(ctx, cx - cardW / 2, top, cardW, cardH, 56);
  ctx.fillStyle = 'rgba(42, 42, 104, 0.94)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(120, 120, 220, 0.7)';
  ctx.stroke();

  let y = top + (cardH - height) / 2;
  EMBLEMS[screen]?.(ctx, cx, y + emblem / 2);
  y += emblem + 36;

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 68px ${FONT}`;
  for (const line of titleLines) { ctx.fillText(line, cx, y + 40); y += 80; }

  if (textLines.length) {
    y += 20;
    ctx.font = `400 34px ${FONT}`;
    ctx.fillStyle = '#e4e4fa';
    for (const line of textLines) { ctx.fillText(line, cx, y + 23); y += 46; }
  }

  if (steps !== undefined) {
    y += 32;
    ctx.font = `600 30px ${FONT}`;
    const widths = words.steps.map((word) => ctx.measureText(word).width + 56);
    let x = cx - (widths.reduce((a, b) => a + b, 0) + 20 * 2) / 2;
    words.steps.forEach((word, i) => {
      round(ctx, x, y, widths[i], 64, 32);
      ctx.fillStyle = i < steps ? GREEN : i === steps ? AMBER : '#4a4aa8';
      ctx.fill();
      ctx.fillStyle = i === steps ? NAVY : '#ffffff';
      ctx.fillText(word, x + widths[i] / 2, y + 34);
      x += widths[i] + 20;
    });
    return null;
  }

  if (screen === 'waiting') {
    y += 36;
    ctx.font = `600 36px ${FONT}`;
    const w = ctx.measureText(words.connect).width + 150;
    const x = cx - w / 2;
    round(ctx, x, y + 8, w, 82, 22);
    ctx.fillStyle = '#d6870b';
    ctx.fill();
    round(ctx, x, y, w, 82, 22);
    ctx.fillStyle = AMBER;
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.fillText(words.connect, cx + 26, y + 43);
    waves(ctx, x + 50, y + 54, NAVY);
    return { x, y, w, h: 90 };
  }
  return null;
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Break a line into as many as it takes to fit `width`. */
function wrap(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

/* ───────────────────────── the pictures on the panel ───────────────────── */

/** The product's mark: an amber tile with a headset on it. */
function tile(ctx, x, y, size) {
  round(ctx, x, y, size, size, size * 0.24);
  ctx.fillStyle = AMBER;
  ctx.fill();
  const w = size * 0.42;
  const h = size * 0.26;
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = NAVY;
  ctx.lineJoin = 'round';
  round(ctx, x + (size - w) / 2, y + (size - h) / 2, w, h, h * 0.3);
  ctx.stroke();
  // The gap for the nose.
  ctx.fillStyle = AMBER;
  ctx.fillRect(x + size / 2 - w * 0.13, y + (size + h) / 2 - ctx.lineWidth, w * 0.26, ctx.lineWidth * 2);
  ctx.beginPath();
  ctx.arc(x + size / 2, y + (size + h) / 2, w * 0.13, Math.PI, 0);
  ctx.stroke();
}

/** A dark rounded patch of sky that every picture sits on. */
function patch(ctx, cx, cy, w = 210, h = 170) {
  round(ctx, cx - w / 2, cy - h / 2, w, h, 44);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.fillStyle = '#8f95ff';
  for (const [dx, dy] of [[-70, -50], [62, -44], [-48, 40], [78, 30], [10, -66]]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function star(ctx, cx, cy, r, color = AMBER) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function smile(ctx, cx, cy, size, color = NAVY) {
  ctx.fillStyle = color;
  for (const dx of [-size, size]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - size * 0.4, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = size * 0.22;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

/** Three arcs, the sign for "looking for a signal". */
function waves(ctx, cx, cy, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const r of [10, 20, 30]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 1.25 * Math.PI, 1.75 * Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** A tablet with a friendly face: the thing the headset is waiting for. */
function tablet(ctx, cx, cy, tilt = 0.25) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  round(ctx, -42, -60, 84, 120, 14);
  ctx.fillStyle = '#5a5ac8';
  ctx.fill();
  round(ctx, -32, -50, 64, 92, 8);
  ctx.fillStyle = '#fbeed6';
  ctx.fill();
  smile(ctx, 0, 0, 14);
  ctx.restore();
}

const EMBLEMS = {
  waiting(ctx, cx, cy) {
    patch(ctx, cx, cy);
    tablet(ctx, cx, cy);
    star(ctx, cx - 62, cy - 30, 12, '#7f86ff');
    star(ctx, cx + 60, cy + 36, 11);
    star(ctx, cx - 30, cy - 58, 9);
  },
  searching(ctx, cx, cy) {
    patch(ctx, cx, cy, 240);
    // A hill with a lit house on it, and the signal reaching out to find it.
    ctx.save();
    round(ctx, cx - 120, cy - 85, 240, 170, 44);
    ctx.clip();
    ctx.fillStyle = '#3a3a8c';
    ctx.beginPath();
    ctx.ellipse(cx - 40, cy + 100, 170, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.ellipse(cx + 60, cy + 100, 130, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#e8743a';
    ctx.fillRect(cx + 44, cy + 22, 34, 24);
    ctx.beginPath();
    ctx.moveTo(cx + 38, cy + 24);
    ctx.lineTo(cx + 61, cy + 4);
    ctx.lineTo(cx + 84, cy + 24);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(cx + 55, cy + 30, 10, 10);
    ctx.save();
    ctx.translate(cx - 40, cy + 6);
    ctx.scale(1.5, 1.5);
    waves(ctx, 0, 0, AMBER);
    ctx.restore();
  },
  connecting(ctx, cx, cy) {
    patch(ctx, cx, cy, 240);
    tablet(ctx, cx - 44, cy + 4, -0.2);
    // Two links of a chain, joining the tablet to the headset.
    ctx.lineWidth = 9;
    ctx.strokeStyle = AMBER;
    round(ctx, cx + 14, cy - 14, 50, 28, 14);
    ctx.stroke();
    round(ctx, cx + 46, cy - 14, 50, 28, 14);
    ctx.stroke();
  },
  ready(ctx, cx, cy) {
    // A sun coming up over the hill.
    ctx.save();
    round(ctx, cx - 95, cy - 85, 190, 170, 80);
    ctx.clip();
    ctx.fillStyle = '#5a5ac8';
    ctx.fillRect(cx - 95, cy - 85, 190, 170);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(cx, cy + 14, 52, 0, Math.PI * 2);
    ctx.fill();
    smile(ctx, cx, cy + 2, 14, '#8a4a00');
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 96, 150, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    star(ctx, cx - 60, cy - 50, 9, '#ffffff');
    star(ctx, cx + 54, cy - 56, 11, '#ffffff');
  },
  done(ctx, cx, cy) {
    patch(ctx, cx, cy);
    star(ctx, cx, cy, 52);
    smile(ctx, cx, cy + 4, 10, '#8a4a00');
    star(ctx, cx - 64, cy + 34, 20);
    star(ctx, cx + 62, cy + 30, 18);
  },
  moment(ctx, cx, cy) {
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(cx, cy, 84, 0, Math.PI * 2);
    ctx.fill();
    // A ring of stars turning round a crescent moon.
    ctx.strokeStyle = '#6f76e8';
    ctx.lineWidth = 6;
    ctx.setLineDash([4, 14]);
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 8, 26, 0, Math.PI * 2);
    ctx.fill();
  },
  back(ctx, cx, cy) {
    // A doorway with the night sky through it: the way back in.
    round(ctx, cx - 62, cy - 84, 124, 168, [62, 62, 8, 8]);
    ctx.fillStyle = '#e8743a';
    ctx.fill();
    round(ctx, cx - 42, cy - 62, 84, 146, [42, 42, 0, 0]);
    ctx.fillStyle = NAVY;
    ctx.fill();
    star(ctx, cx - 12, cy - 24, 9, '#ffffff');
    star(ctx, cx + 16, cy + 6, 7, '#ffffff');
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(cx + 10, cy - 34, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 86, 100, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};
