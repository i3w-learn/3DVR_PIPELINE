/**
 * A letter, a numeral or a Devanagari character, standing on the table.
 *
 * Roughly forty of the 109 curriculum topics teach symbols: A–Z, 0–100, swar,
 * vyanjan, matra, `+`, `×`, `>`. None of them can be downloaded and none of
 * them should be. A letter is a shape the computer already knows how to draw,
 * and drawing it costs no bytes, no licence and no intake pass.
 *
 * The card is deliberately a card and not floating text. A three-year-old
 * reaching for a letter needs something with edges and a place on the table;
 * text hanging in mid-air has neither, and reads as an overlay rather than as
 * an object in the room.
 *
 * ## Two ways to draw, one interface
 *
 * A lesson always says the same thing — `build: "glyph"`, `params.char` — and
 * never chooses a renderer. This component chooses, because the right answer
 * depends on the characters themselves and a content author should not have to
 * know that.
 *
 * **MSDF** (`a-text` with a vendored atlas) is the normal path: sharp at any
 * distance, one draw call, and the atlas is already in the bundle. It works
 * for every single character — every Latin letter, every digit, every swar and
 * vyanjan, and a matra shown on its own.
 *
 * **Canvas** is the exception path. A-Frame's text layout walks codepoints
 * left to right and there is no shaping engine in the bundle, so `कि` comes
 * out as क followed by ि — and correct Hindi puts that matra to the *left* of
 * the consonant. Rendering wrong Hindi in a lesson about Hindi is not a
 * cosmetic bug. The browser's own canvas text does have a shaper, so anything
 * that needs reordering or a conjunct is drawn there instead and used as a
 * texture.
 *
 * The cost is one 512px texture per shaped card, which is why it is not the
 * default. The benefit is that no lesson has to know any of this.
 */

/** Vendored by `npm run content:fonts`. Never a CDN — see tools/build/fonts.js. */
const ATLAS = {
  latin: 'lib/fonts/noto-msdf.json',
  devanagari: 'lib/fonts/notodev-msdf.json',
};

/**
 * Faces for the canvas path — Devanagari only, deliberately.
 *
 * Only a script with combining marks ever reaches that path, and Latin has
 * none: no English string needs reordering, so no English string is ever drawn
 * on a canvas. Shipping the Latin face too would have put 600 KB in the bundle
 * for a code path it can never enter. If a Latin string somehow gets there,
 * the canvas falls back to the system sans stack rather than failing.
 */
const WEBFONT = {
  devanagari: { family: 'GlyphDevanagari', url: 'lib/fonts/NotoSansDevanagari-Regular.ttf' },
};

/** Devanagari block. Anything outside it is treated as Latin. */
const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Marks that must be positioned relative to a letter rather than after it:
 * the dependent matras, the virama, and the nukta.
 *
 * A string containing one of these *and* something else needs a shaper.
 * A string that is only one of them does not — that is a matra being taught
 * on its own, and drawing it alone is the point.
 */
const COMBINING = /[ऺ-ॏॕ-ॗॢॣ़]/;

AFRAME.registerComponent('glyph', {
  schema: {
    /** What to draw. Usually one character; may be a short word. */
    char: { type: 'string', default: 'A' },

    /** Height of the card in metres. A tabletop card is about a hand's width. */
    height: { type: 'number', default: 0.22 },

    /** Width follows the height unless a longer string needs more room. */
    width: { type: 'number', default: 0 },

    ink: { type: 'color', default: '#22303c' },
    card: { type: 'color', default: '#fbf7ee' },

    /** A bare glyph with no card behind it — for operators like + and =. */
    bare: { type: 'boolean', default: false },

    /** Lie flat on the table instead of standing up. */
    flat: { type: 'boolean', default: false },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { char, height, ink, card, bare, flat } = this.data;
    const width = this.data.width || cardWidth(char, height);

    // Standing on the table, origin at the base — the same contract every
    // downloaded model honours, so a card and a cow are placed the same way.
    const lift = flat ? 0.006 : height / 2;
    const face = flat ? '-90 0 0' : '0 0 0';

    if (!bare) {
      const back = document.createElement('a-box');
      back.setAttribute('width', width);
      back.setAttribute('height', height);
      back.setAttribute('depth', 0.016);
      back.setAttribute('position', `0 ${lift} 0`);
      back.setAttribute('rotation', face);
      back.setAttribute('material', { color: card, roughness: 0.9, metalness: 0 });
      this.el.appendChild(back);
    }

    const front = bare ? 0 : 0.009;
    const glyph = this.render(char, height, ink);

    glyph.setAttribute('position', flat ? `0 ${lift + front} 0` : `0 ${lift} ${front}`);
    glyph.setAttribute('rotation', face);
    // Text and canvas planes are not boxes, so they must never be baked.
    glyph.dataset.keep = '';

    this.el.appendChild(glyph);

    this.size = { width, height };
  },

  /** MSDF where it is correct, canvas where it is not. */
  render(char, height, ink) {
    const script = DEVANAGARI.test(char) ? 'devanagari' : 'latin';

    return needsShaping(char)
      ? canvasGlyph(char, height, ink, script)
      : msdfGlyph(char, height, ink, script);
  },

  /**
   * Where the ring goes.
   *
   * The default 0.9 m ring is sized for a cow in a field. Round a 20 cm card
   * on a table it is a hoop the width of the table, pointing at everything at
   * once. See `behaviours/highlight.js`.
   */
  highlightAnchor() {
    const reach = Math.max(this.size?.width ?? 0.2, this.size?.height ?? 0.2);

    return {
      object3D: this.el.object3D,
      radius: reach * 0.8,
      thickness: 0.07,
    };
  },
});

/**
 * Does this string need a shaping engine to be correct?
 *
 * One character never does — including a lone matra, which is how the matra
 * lesson introduces it. Two or more characters do as soon as one of them is a
 * mark that attaches to another.
 */
function needsShaping(char) {
  return [...char].length > 1 && COMBINING.test(char);
}

/**
 * A card wide enough for what is on it, never narrower than it is tall.
 *
 * Wider than the text block inside it — a glyph that reaches the edge of its
 * own card reads as a crop rather than as a letter on a card.
 */
function cardWidth(char, height) {
  const glyphs = [...char].filter((c) => !COMBINING.test(c)).length || 1;
  return Math.max(height, height * 0.72 * glyphs + height * 0.28);
}

/**
 * The normal path: one draw call, sharp at any distance.
 *
 * `width` and `wrapCount` together are what set the glyph's size, and getting
 * this wrong is silent. A-Frame's text component has no font size: it fits
 * `wrapCount` characters across `width` metres and derives the size from that.
 * The default `wrapCount` is 40, so a 0.27 m card drew its letter at 7 mm —
 * present, correct, and far too small to see. One character per card means a
 * wrapCount of about one.
 */
function msdfGlyph(char, height, ink, script) {
  const el = document.createElement('a-entity');
  const glyphs = [...char].filter((c) => !COMBINING.test(c)).length || 1;

  el.setAttribute('text', {
    value: char,
    font: ATLAS[script],
    color: ink,
    align: 'center',
    anchor: 'center',
    baseline: 'center',
    width: height * 0.85 * glyphs,
    // A shade over the character count, so a glyph has a little air around it
    // rather than touching the edge of its own block.
    wrapCount: glyphs + 0.35,
    // MSDF atlases carry their own coverage; A-Frame's default alpha test
    // clips the thin parts of Devanagari strokes.
    alphaTest: 0.2,
    // The one setting that decides whether this reads as a letter or as a
    // dark rectangle. A-Frame's `negate` defaults to true, which suits the
    // SDF fonts it ships; an MSDF atlas from msdf-bmfont-xml stores coverage
    // the other way round, so leaving it on fills the block with ink and
    // punches the glyph out of it in white.
    negate: false,
  });

  return el;
}

/**
 * The exception path: let the browser shape it, then use the result.
 *
 * Canvas text goes through the browser's own text stack, which does have a
 * shaper — so matras land on the correct side and conjuncts form. The font is
 * loaded explicitly rather than trusted to be present, because a Quest browser
 * has no Devanagari face installed and would otherwise draw boxes.
 */
function canvasGlyph(char, height, ink, script) {
  const el = document.createElement('a-entity');
  const RESOLUTION = 512;

  const canvas = document.createElement('canvas');
  canvas.width = RESOLUTION;
  canvas.height = RESOLUTION;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(height * 1.5, height * 1.5),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );

  el.addEventListener('loaded', () => el.setObject3D('mesh', plane));

  loadFace(script).then(() => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, RESOLUTION, RESOLUTION);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${RESOLUTION * 0.62}px "${WEBFONT[script]?.family ?? 'sans-serif'}", sans-serif`;
    ctx.fillText(char, RESOLUTION / 2, RESOLUTION / 2);
    texture.needsUpdate = true;
  });

  return el;
}

/** Each face is fetched once and shared by every card that needs it. */
const faces = new Map();

function loadFace(script) {
  if (faces.has(script)) return faces.get(script);

  // No vendored face for this script — the system stack will do.
  if (!WEBFONT[script]) return Promise.resolve();

  const { family, url } = WEBFONT[script];
  const face = new FontFace(family, `url(${url})`);

  const ready = face
    .load()
    .then(() => {
      document.fonts.add(face);
    })
    .catch((error) => {
      // Loud, not silent: a missing face draws tofu boxes, and a lesson full
      // of empty rectangles is not obviously a font problem to whoever sees it.
      console.error(`[glyph] could not load ${family} from ${url}`, error);
    });

  faces.set(script, ready);
  return ready;
}
