#!/usr/bin/env node
/**
 * Lay the pictures from `content:browse` out on numbered sheets, twelve to a
 * sheet, each with its lesson's name — so a person can look at a hundred and
 * thirty lessons in eleven pictures.
 *
 * Usage:
 *   npm run content:sheets            the last step of every lesson
 *   npm run content:sheets -- a       the first step
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { ROOT } from '../../lib/paths.js';

const OUT = path.join(ROOT, '.work', 'browse');
const SHOTS = path.join(OUT, 'shots');
const SHEETS = path.join(OUT, 'sheets');
await fs.mkdir(SHEETS, { recursive: true });
const which = process.argv[2] ?? 'b';
const only = process.argv.slice(3);
let files = (await fs.readdir(SHOTS)).filter((f) => f.endsWith(`--${which}.jpg`)).sort();
if (only.length) files = files.filter((f) => only.includes(f.replace(/--[ab]\.jpg$/, '')));
const W = 480, H = 270, L = 26, COLS = 3, PER = 12;
for (let s = 0; s * PER < files.length; s++) {
  const part = files.slice(s * PER, (s + 1) * PER); const rows = Math.ceil(part.length / COLS);
  const tiles = await Promise.all(part.map(async (f, i) => {
    const name = f.replace(/--[ab]\.jpg$/, '');
    const img = await sharp(path.join(SHOTS, f)).resize(W, H).toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="${L}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="6" y="18" font-family="Helvetica" font-size="15" fill="#fff">${s * PER + i + 1}. ${name}</text></svg>`);
    return [{ input: img, left: (i % COLS) * W, top: Math.floor(i / COLS) * (H + L) + L }, { input: label, left: (i % COLS) * W, top: Math.floor(i / COLS) * (H + L) }];
  }));
  const file = path.join(SHEETS, `${which}-${String(s + 1).padStart(2, '0')}.jpg`);
  await sharp({ create: { width: W * COLS, height: rows * (H + L), channels: 3, background: '#000' } }).composite(tiles.flat()).jpeg({ quality: 72 }).toFile(file);
  console.log(file);
}
