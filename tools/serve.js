#!/usr/bin/env node
/**
 * The development server.
 *
 * `python3 -m http.server` sends no cache headers at all, so a browser caches
 * everything indefinitely and guesses when to revalidate. The result is the
 * worst kind of bug: you edit a lesson or a component, reload, and see the old
 * one — so you go looking for a fault in code that is already correct. That
 * cost real time here before it was diagnosed.
 *
 * This sends `Cache-Control: no-cache` on everything: the browser may keep its
 * copy, but it must ask before using it. Editing a file and reloading shows
 * the edit. That is the whole feature.
 *
 * It also prints the LAN address, because testing on a headset means opening
 * this from another device and the address is never the one you remember.
 *
 * Usage: npm run serve
 */

import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';

import { ROOT } from './lib/paths.js';

const PORT = Number(process.env.PORT ?? 4500);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.hdr': 'image/vnd.radiance',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let file = path.join(ROOT, decodeURIComponent(url.pathname));

  // Refuse anything that climbs out of the project. A dev server is still a
  // server, and this one is deliberately reachable from the LAN.
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(file);
    if (stats.isDirectory()) file = path.join(file, 'index.html');

    const body = await fs.readFile(file);

    response.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      // Keep the copy, but always ask first.
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

  console.log(`
  VR Learning — dev server

  Teacher   http://localhost:${PORT}/app/?role=teacher
  Headset   http://localhost:${PORT}/app/?role=headset
  Library   http://localhost:${PORT}/tools/library.html
${lan ? `
  On a Quest or phone, same Wi-Fi:
            http://${lan}:${PORT}/app/?role=headset
` : ''}
  Ctrl-C to stop.
`);
});
