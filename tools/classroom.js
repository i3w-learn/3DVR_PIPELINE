#!/usr/bin/env node
/**
 * A classroom on the laptop, with nothing installed.
 *
 * The real meeting point lives inside the tablet app (ClassroomServer, in the
 * VR-app repo). This is a stand-in for it, so that the whole link can be tried
 * from a browser before anything goes onto a device: the teacher's page on a
 * phone, a headset's page in a laptop window, both joined through this.
 *
 * It keeps the same rules as the real one, in the same order:
 *
 *   - a retained message is kept, one per topic, and handed to every
 *     connection the moment it opens
 *   - every message is passed on to everyone but its sender
 *   - a headset that has not been heard from for three seconds, or that
 *     disconnects, is reported once as `headset/<id>/lwt`
 *
 * One rule is left out on purpose: the real one only lets the tablet's own
 * page move the class. Here the teacher's page is on a phone, which is not
 * "its own", so anyone may. This is a laptop tool, not a classroom.
 *
 * It also starts the lessons server (tools/serve.js), so one command is the
 * whole classroom. Usage: npm run classroom
 */

import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.HUB_PORT ?? 9001);
const LESSONS_PORT = Number(process.env.PORT ?? 4500);
const SILENCE_MS = 3000;

const retained = new Map(); // topic → frame text
const peers = new Map(); // socket → { headset, lastHeard, reportedGone }

const server = new WebSocketServer({ port: PORT });

server.on('connection', (socket, request) => {
  const peer = { headset: null, lastHeard: 0, reportedGone: false };
  peers.set(socket, peer);
  log(`joined: ${request.socket.remoteAddress}, ${peers.size} connected`);

  for (const text of retained.values()) socket.send(text);

  socket.on('message', (data) => {
    const text = data.toString();
    let frame;
    try {
      frame = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof frame?.topic !== 'string') return;

    const status = frame.topic.match(/^headset\/([^/]+)\/status$/);
    if (status) {
      peer.headset = status[1];
      peer.lastHeard = Date.now();
      peer.reportedGone = false;
    }

    if (frame.retain === true) retained.set(frame.topic, text);
    log(`${peer.headset ? `headset ${peer.headset}` : request.socket.remoteAddress} ▶ ${frame.topic} ${JSON.stringify(frame.payload)}`);
    forward(text, socket);
  });

  socket.on('close', () => {
    peers.delete(socket);
    log(`left: ${request.socket.remoteAddress}${peer.headset ? ` (headset ${peer.headset})` : ''}, ${peers.size} connected`);
    if (peer.headset && !peer.reportedGone) reportGone(socket, peer.headset);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [socket, peer] of peers) {
    if (!peer.headset || peer.reportedGone || now - peer.lastHeard < SILENCE_MS) continue;
    peer.reportedGone = true;
    log(`headset ${peer.headset} has gone quiet`);
    reportGone(socket, peer.headset);
  }
}, 1000);

function forward(text, except) {
  for (const socket of peers.keys()) {
    if (socket !== except && socket.readyState === socket.OPEN) socket.send(text);
  }
}

function reportGone(socket, id) {
  const number = Number(id);
  forward(JSON.stringify({ topic: `headset/${id}/lwt`, payload: { id: Number.isNaN(number) ? id : number } }), socket);
}

function log(line) {
  console.log(`  classroom  ${line}`);
}

// The lessons server, in the same terminal, so one command is the classroom.
const serve = spawn(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'serve.js')], {
  stdio: 'ignore',
  env: { ...process.env, PORT: String(LESSONS_PORT) },
});
process.on('exit', () => serve.kill());

const lan = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
const host = lan ?? 'localhost';
const hub = `ws://${host}:${PORT}`;

console.log(`
  VR Learning — a classroom on this laptop

  Teacher, on a phone on the same Wi-Fi (or here):
    http://${host}:${LESSONS_PORT}/app/lands.html?classroom=${hub}

  A headset, in a browser window here (flat view, same behaviour):
    http://${host}:${LESSONS_PORT}/app/?role=headset&classroom=${hub}&id=1

  Open more headsets with other numbers: &id=2, &id=3 …
  Every message is logged below, and in each page's console as "classroom".
  Ctrl-C to stop.
`);
