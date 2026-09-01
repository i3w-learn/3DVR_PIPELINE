/**
 * Reading Radiance .hdr files.
 *
 * An HDRI is the only asset in the pipeline that is not already an ordinary
 * image, and three.js cannot read one without `RGBELoader` from its examples —
 * a module the A-Frame build does not ship. Rather than vendor a loader into
 * the app and ask a headset to decode 4 MB of floats at start-up, the format is
 * decoded here, at build time, and what ships is a plain JPEG.
 *
 * The format is small and well specified: a text header, a resolution line,
 * then RGBE scanlines — four bytes per pixel, where the fourth is a shared
 * exponent. Run-length encoding is per channel, per scanline.
 */

import fs from 'node:fs/promises';

export class HdrError extends Error {
  constructor(message) {
    super(message);
    this.code = 'HDR_DECODE';
  }
}

/**
 * @param {string} file
 * @returns {Promise<{width: number, height: number, data: Float32Array}>}
 *          `data` is linear RGB, three floats per pixel, unbounded above 1.
 */
export async function readHdr(file) {
  const buffer = await fs.readFile(file);

  const { width, height, offset } = readHeader(buffer);
  const data = new Float32Array(width * height * 3);

  let cursor = offset;
  const scanline = new Uint8Array(width * 4);

  for (let y = 0; y < height; y += 1) {
    cursor = readScanline(buffer, cursor, scanline, width);

    for (let x = 0; x < width; x += 1) {
      const exponent = scanline[x * 4 + 3];
      // A zero exponent means the pixel is black; the mantissas are ignored.
      const scale = exponent === 0 ? 0 : 2 ** (exponent - 136);
      const target = (y * width + x) * 3;

      data[target] = scanline[x * 4] * scale;
      data[target + 1] = scanline[x * 4 + 1] * scale;
      data[target + 2] = scanline[x * 4 + 2] * scale;
    }
  }

  return { width, height, data };
}

function readHeader(buffer) {
  let cursor = 0;
  let line = '';
  let sawResolution = false;
  let width = 0;
  let height = 0;

  while (cursor < buffer.length) {
    const byte = buffer[cursor];
    cursor += 1;

    if (byte !== 0x0a) {
      line += String.fromCharCode(byte);
      continue;
    }

    // The resolution line ends the header. Only the standard orientation
    // (-Y rows top-down, +X columns left-to-right) is produced in practice.
    const match = line.match(/^-Y (\d+) \+X (\d+)$/);
    if (match) {
      height = Number(match[1]);
      width = Number(match[2]);
      sawResolution = true;
      break;
    }

    line = '';
  }

  if (!sawResolution) throw new HdrError('No "-Y height +X width" line — not a Radiance HDR.');

  return { width, height, offset: cursor };
}

/** One scanline into `out`, returning the new cursor. */
function readScanline(buffer, cursor, out, width) {
  const isRle =
    buffer[cursor] === 2 && buffer[cursor + 1] === 2 && ((buffer[cursor + 2] << 8) | buffer[cursor + 3]) === width;

  if (!isRle) {
    // Flat RGBE quadruples, no compression.
    for (let i = 0; i < width * 4; i += 1) out[i] = buffer[cursor + i];
    return cursor + width * 4;
  }

  cursor += 4;

  // RLE stores all the reds, then all the greens, and so on — not pixel by
  // pixel — so the four channels are filled in four passes.
  for (let channel = 0; channel < 4; channel += 1) {
    let x = 0;

    while (x < width) {
      const count = buffer[cursor];
      cursor += 1;

      if (count > 128) {
        const value = buffer[cursor];
        cursor += 1;
        for (let i = 0; i < count - 128; i += 1, x += 1) out[x * 4 + channel] = value;
      } else {
        for (let i = 0; i < count; i += 1, x += 1, cursor += 1) out[x * 4 + channel] = buffer[cursor];
      }
    }
  }

  return cursor;
}

/**
 * Linear HDR → 8-bit sRGB, via ACES.
 *
 * A captured sky holds a sun thousands of times brighter than the clouds
 * around it. Clipping that range gives a white disc on a near-black sky — the
 * naive conversion. ACES rolls the top end off instead, so the sun stays a sun
 * and the sky keeps its blue.
 *
 * It is the same curve the renderer applies at runtime, which is the point:
 * the baked sky and the live scene are then graded identically.
 */
export function toneMap(data, { exposure = 1 } = {}) {
  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += 1) {
    out[i] = Math.round(linearToSrgb(aces(data[i] * exposure)) * 255);
  }

  return out;
}

/** Narkowicz's fit of the ACES filmic curve — one multiply-add per channel. */
function aces(x) {
  const v = Math.max(x, 0);
  return clamp((v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14));
}

const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (v) => Math.min(Math.max(v, 0), 1);
