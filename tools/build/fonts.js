/**
 * MSDF font atlases, generated from the Noto TTFs in tools/fonts/src.
 *
 * ## Why this file has to exist
 *
 * A-Frame's `text` component ships with no font. It fetches one from
 * `https://cdn.aframe.io/` the first time a lesson draws a letter — which in a
 * classroom with no internet is a blank plane where the letter should be. The
 * offline rule in the pipeline doc is not a preference; it is the whole
 * deployment. So the atlas is generated here, at build time, and vendored.
 *
 * ## Why MSDF and not a picture of a letter
 *
 * A multi-channel signed distance field stores the *shape* of each glyph
 * rather than its pixels, so one 1024px atlas draws an A crisply at arm's
 * length and at the back of a room. A PNG per glyph would need one file per
 * size, and ~120 files in a 40 MB budget.
 *
 * ## What the shader selection depends on
 *
 * A-Frame decides between its `sdf` and `msdf` shaders by looking for the
 * substring `msdf.` in the font path — nothing else. That is why the output
 * files are named `*-msdf.json` and why renaming them breaks rendering in a
 * way that looks like a content bug. Do not rename them.
 *
 * ## The limit this tool cannot fix
 *
 * The atlas is per-codepoint, and A-Frame's text layout walks codepoints left
 * to right with no shaping engine — there is no HarfBuzz in the bundle. For
 * Latin and for standalone Devanagari letters that is correct. For Devanagari
 * matras and conjuncts it is not: `कि` is stored as क then ि, and correct
 * Hindi draws that matra to the *left* of the consonant.
 *
 * Two things follow, and both are load-bearing:
 *
 * 1. Hindi word lists in lessons stay matra-free and conjunct-free — नल, कमल,
 *    नमक, not कि or क्षमा. That is also the order Hindi is taught in, so it
 *    costs the curriculum nothing.
 * 2. Anything that genuinely must compose — the matra lesson itself — is drawn
 *    by the canvas path in `builders/glyph.js`, where the browser's own shaper
 *    places the mark correctly.
 *
 * The isolated matra glyphs below are still generated, because teaching a
 * matra on its own — "this hook is the i-matra" — is what that lesson shows
 * first, and a lone codepoint needs no shaping.
 *
 *   npm run content:fonts
 */

import { createRequire } from 'node:module';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// msdf-bmfont-xml is CommonJS and this package is ESM.
const require = createRequire(import.meta.url);
const generateBMFont = require('msdf-bmfont-xml');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(root, 'tools', 'fonts', 'src');
const OUT = join(root, 'app', 'lib', 'fonts');

/**
 * Latin, digits and the maths operators the UKG arithmetic lessons need.
 *
 * `×` and `÷` are the real operators, not `x` and `/`. A child learning
 * multiplication should not meet the letter x doing a second job.
 */
const LATIN =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789' +
  '+-−×÷=<>?.,!\'"()[]:;/ ';

/**
 * Devanagari, grouped the way the curriculum teaches it.
 *
 * Swar and vyanjan are standalone letters and render correctly. The matras and
 * the virama are here so the matra lesson can show one on its own; they are
 * never composed with a consonant through this path.
 */
const SWAR = 'अआइईउऊऋएऐओऔ';
const ANUSVARA = 'ंः';
const VYANJAN = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';
const MATRA = 'ािीुूृेैोौ';
const VIRAMA = '्';
const DEV_DIGITS = '०१२३४५६७८९';
const DANDA = '।';

const DEVANAGARI = SWAR + ANUSVARA + VYANJAN + MATRA + VIRAMA + DEV_DIGITS + DANDA + ' ';

/**
 * One atlas per script, not one atlas for both.
 *
 * Merging them would put ~60 Devanagari glyphs into every Latin lesson's
 * texture and vice versa. Split, a maths lesson downloads letters it uses.
 */
const FONTS = [
  { name: 'noto-msdf', file: 'NotoSans-Regular.ttf', charset: LATIN },
  { name: 'notodev-msdf', file: 'NotoSansDevanagari-Regular.ttf', charset: DEVANAGARI },
];

/**
 * Faces shipped whole, not as an atlas.
 *
 * `builders/glyph.js` draws matras and conjuncts on a canvas so the browser's
 * own shaper can place them, and a canvas needs a real font file rather than a
 * distance-field atlas. Only Devanagari needs it: no Latin string requires
 * reordering, so the Latin face never has to ship.
 *
 * Copied here rather than by hand, because a hand copy is a step that works on
 * the machine that did it and nowhere else.
 */
const SHIPPED_FACES = ['NotoSansDevanagari-Regular.ttf'];

/**
 * Atlas settings.
 *
 * `fontSize` is the rasterisation size, not the display size — MSDF scales
 * freely, so this only decides how much shape detail is captured. 42 is the
 * size A-Frame's own Roboto atlas uses.
 *
 * `textureSize` is capped at 1024 because the model contract caps every
 * shipped texture at 1024 on the long edge, and a font atlas is a texture.
 */
const SETTINGS = {
  fieldType: 'msdf',
  outputType: 'json',
  fontSize: 42,
  distanceRange: 4,
  textureSize: [1024, 1024],
  texturePadding: 2,
  border: 1,
  smartSize: true,
};

async function build({ name, file, charset }) {
  // Duplicates in a charset silently produce duplicate atlas entries.
  const chars = [...new Set([...charset])].join('');

  const { font, textures } = await generate(join(SRC, file), { ...SETTINGS, charset: chars });

  if (textures.length !== 1) {
    // More than one page means the glyphs did not fit. A-Frame's text
    // component reads pages[0] and quietly drops the rest, so a second page
    // shows up as a handful of letters that never render.
    throw new Error(
      `${name}: glyphs spilled onto ${textures.length} pages. ` +
        `Raise textureSize or lower fontSize — a multi-page atlas loses glyphs silently.`
    );
  }

  await mkdir(OUT, { recursive: true });

  // The JSON's `pages[0]` is resolved relative to the JSON's own URL, so the
  // png must sit beside it and carry exactly this name.
  const png = `${name}.png`;
  const data = JSON.parse(font.data);
  data.pages = [png];

  await writeFile(join(OUT, png), textures[0].texture);
  await writeFile(join(OUT, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);

  return { name, glyphs: data.chars.length, bytes: textures[0].texture.length };
}

/** The generator is callback-style; everything else here is promises. */
function generate(fontPath, options) {
  return new Promise((resolve, reject) => {
    generateBMFont(fontPath, options, (error, textures, font) => {
      if (error) reject(error);
      else resolve({ textures, font });
    });
  });
}

const results = [];
for (const font of FONTS) results.push(await build(font));

for (const { name, glyphs, bytes } of results) {
  console.log(`✓ ${name}  ${glyphs} glyphs  ${(bytes / 1024).toFixed(0)} KB`);
}

for (const face of SHIPPED_FACES) {
  await copyFile(join(SRC, face), join(OUT, face));
  console.log(`✓ ${face}  (whole face, for the canvas path)`);
}
