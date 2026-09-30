#!/usr/bin/env node
/**
 * Letter outlines for the 3D letter, from the same Noto TTFs as the atlases.
 *
 * ## Why a second font file
 *
 * The MSDF atlas draws a letter as a flat card: right for a name card over an
 * apple, wrong for the letter lesson, where the letter is the thing being
 * taught and floats in the sky the size of a child. A flat card seen from the
 * side is a line. A letter with depth is a thing, throws a shadow on the sand,
 * and reads from wherever the child turns.
 *
 * Extruding needs the glyph's outline, which the atlas has thrown away. So the
 * outlines are read out of the TTF at build time and vendored as one small
 * JSON, the way the atlases are — offline is the deployment, not a preference.
 *
 * ## What is in it
 *
 * Every character the curriculum teaches as a letter: A–Z, a–z, the swar and
 * the vyanjan. And the ten digits — a numeral is taught on the table, but
 * "Z for Zero" wants a zero standing on the sand like any other thing. Matras
 * are not here: a matra on its own is not a letter, and composing one
 * with a consonant needs shaping this path does not do.
 *
 * Path commands are opentype's, scaled to units-per-em so the runtime works in
 * em and the size comes from the lesson. Run by `npm run content:letters`,
 * and as part of `content:fonts`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import opentype from 'opentype.js';

import { FONTS_DIR, ROOT, relative } from '../lib/paths.js';

const SRC = path.join(ROOT, 'tools', 'fonts', 'src');
const OUT = path.join(FONTS_DIR, 'letters-3d.json');

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SWAR = 'अआइईउऊऋएऐओऔ';
const VYANJAN = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';

const FACES = [
  { file: 'NotoSans-Regular.ttf', chars: LATIN + DIGITS },
  { file: 'NotoSansDevanagari-Regular.ttf', chars: SWAR + VYANJAN },
];

/** One glyph: its advance and its outline, both in font units. */
function outline(font, char) {
  const glyph = font.charToGlyph(char);
  const commands = glyph.getPath(0, 0, font.unitsPerEm).commands.map((c) => {
    switch (c.type) {
      case 'M': return ['M', c.x, c.y];
      case 'L': return ['L', c.x, c.y];
      case 'Q': return ['Q', c.x1, c.y1, c.x, c.y];
      case 'C': return ['C', c.x1, c.y1, c.x2, c.y2, c.x, c.y];
      case 'Z': return ['Z'];
      default: throw new Error(`Unknown path command ${c.type} in ${char}`);
    }
  });
  const box = glyph.getBoundingBox();
  return { advance: glyph.advanceWidth, commands, box: [box.x1, box.y1, box.x2, box.y2] };
}

const glyphs = {};
let unitsPerEm = null;

for (const { file, chars } of FACES) {
  const font = opentype.parse((await fs.readFile(path.join(SRC, file))).buffer);
  unitsPerEm ??= font.unitsPerEm;
  if (font.unitsPerEm !== unitsPerEm) throw new Error(`${file}: units per em differ; the runtime assumes one scale.`);
  for (const char of chars) glyphs[char] = outline(font, char);
}

await fs.mkdir(FONTS_DIR, { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ unitsPerEm, glyphs }));

const bytes = (await fs.stat(OUT)).size;
console.log(`  ✓ ${relative(OUT)}  ${Object.keys(glyphs).length} letters  ${Math.round(bytes / 1024)} KB`);
