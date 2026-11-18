#!/usr/bin/env node
/**
 * The headset's own screens, one after another.
 *
 * What a child sees when no lesson is playing: the mark, looking for the
 * classroom, waiting for the tablet, connecting, ready, well done; and the
 * two that sit over a lesson, "one moment" and "welcome back". Each line
 * printed is one screen coming up when it should, and going when it should.
 *
 * It starts a meeting point of its own, on port 9002, because one of the
 * things checked is what a headset does when the meeting point goes away,
 * and the only way to check that is to switch one off.
 *
 * Needs the lessons served over HTTP:
 *
 *   npm run serve               (or npm run classroom, which serves them too)
 *   npm run content:headset
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import { WebSocket } from 'ws';

const BASE = process.env.BASE ?? 'http://localhost:4500/app/';
const HUB_PORT = 9002;
const HUB = `ws://localhost:${HUB_PORT}`;
const NOWHERE = 'ws://localhost:9003'; // nothing listens here
const LESSON = 'eng-nur-letters-a-e';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (ok, label) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed += 1; };
const errors = [];

const here = path.dirname(fileURLToPath(import.meta.url));
// Its lessons server is sent to a spare port: the real one is already up.
const hub = spawn(process.execPath, [path.join(here, '../../classroom.js')], {
  env: { ...process.env, HUB_PORT: String(HUB_PORT), PORT: '4599' },
  stdio: 'ignore',
});
process.on('exit', () => hub.kill());
await sleep(1500);

/** Say something to the room, as the teacher's tablet would. */
let seq = Date.now();
const say = (payload) => new Promise((done) => {
  const socket = new WebSocket(HUB);
  socket.on('open', () => {
    socket.send(JSON.stringify({ topic: 'class/state', payload: { seq: (seq += 1), step: 0, ...payload }, retain: true }));
    socket.close();
  });
  socket.on('close', done);
  socket.on('error', done);
});

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

async function openHeadset(hubAddress, label) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => { errors.push(`${label}: ${e.message}`); console.log(`  page error [${label}]: ${e.message}`); });
  await page.goto(`${BASE}?role=headset&classroom=${hubAddress}&id=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, null, { timeout: 60000 });
  return page;
}

const screen = (page) => page.evaluate(() => document.querySelector('#rig > a-entity[data-screen]')?.dataset.screen ?? null);
const becomes = (page, name, ms = 15000) =>
  page.waitForFunction((n) => document.querySelector(`#rig > a-entity[data-screen="${n}"]`), name, { timeout: ms }).then(() => true, () => false);
const visible = (page, selector) => page.evaluate((s) => document.querySelector(s)?.object3D.visible === true, selector);
const panelShown = (page) => page.evaluate(() => document.querySelector('#rig > a-entity[data-screen]').object3D.visible);
const waiting = (page) => page.evaluate(() => !!document.querySelector('#waiting'));
/** Something has really been painted on the panel: its middle is not empty. */
const painted = (page) => page.evaluate(() => {
  const map = document.querySelector('#rig > a-entity[data-screen] a-plane').getObject3D('mesh')?.material.map;
  if (!map?.image) return false;
  const pixels = map.image.getContext('2d').getImageData(0, 0, map.image.width, map.image.height).data;
  let filled = 0;
  for (let i = 3; i < pixels.length; i += 4 * 97) if (pixels[i] > 0) filled += 1;
  return filled > 200;
});

/* ───────────────────────── a headset with no tablet ────────────────────── */

console.log('\nNo tablet in the room');
const alone = await openHeadset(NOWHERE, 'headset alone');
check((await screen(alone)) === 'splash', 'switched on: the mark, and nothing to read');
check(await visible(alone, '#night'), 'under the night sky');
check(await becomes(alone, 'searching', 6000), 'then "Looking for the classroom…", by itself');
check(await painted(alone), 'the panel has its picture and words drawn on it');
check(await waiting(alone), 'and counts as a headset that is waiting');
check(await alone.evaluate(() => !document.querySelector('#rig a-plane.clickable')), 'nothing on it can be pressed while it is searching');

/* ───────────────────────── a headset that finds one ────────────────────── */

console.log('\nThe tablet is there');
await say({ lesson: null });
const headset = await openHeadset(HUB, 'headset');
check(await becomes(headset, 'connecting', 8000), 'the tablet answers: "Connecting…"');
check(await becomes(headset, 'ready', 6000), 'then "Ready!": connected, waiting for the teacher');
check(await visible(headset, '#night'), 'still under the night sky');

console.log('\nA lesson');
await say({ lesson: LESSON, lang: 'en' });
check(await becomes(headset, 'playing', 20000), 'the teacher starts: the screens get out of the way');
await headset.waitForFunction(() => document.querySelector('#stage').children.length > 0, null, { timeout: 60000 });
check(!(await panelShown(headset)) && !(await visible(headset, '#night')), 'nothing is drawn over the lesson: no panel, no night sky');
check(!(await waiting(headset)), 'and it no longer counts as waiting');

console.log('\nThe headset is taken off and put back on');
await headset.evaluate(() => document.querySelector('a-scene').emit('exit-vr'));
await sleep(400);
check((await screen(headset)) === 'playing', 'taken off: nothing changes for the others, nothing to show');
await headset.evaluate(() => document.querySelector('a-scene').emit('enter-vr'));
check(await becomes(headset, 'back', 3000), 'put back on: "Welcome back!"');
check((await panelShown(headset)) && !(await visible(headset, '#night')), 'over the lesson, which is still there behind it');
check(await becomes(headset, 'playing', 6000), 'and after a moment the lesson has the view again');

console.log('\nThe lesson ends');
await say({ lesson: null, lang: 'en' });
check(await becomes(headset, 'done', 6000), 'the teacher stops, or the lesson finishes: "Well done!"');
check((await visible(headset, '#night')) && (await waiting(headset)), 'back under the night sky, waiting');
check((await headset.evaluate(() => document.querySelector('#stage').children.length)) === 0, 'the lesson is cleared away');
await say({ lesson: null, lang: 'mr' });
await sleep(1200);
check((await screen(headset)) === 'done' && (await painted(headset)), 'the tablet is in Marathi: the same screen is drawn again in Marathi');

console.log('\nThe tablet goes away in the middle of a lesson');
await say({ lesson: LESSON, lang: 'en' });
await becomes(headset, 'playing', 20000);
await headset.waitForFunction(() => document.querySelector('#stage').children.length > 0, null, { timeout: 60000 });
hub.kill();
check(await becomes(headset, 'moment', 8000), 'within a few seconds: "One moment…"');
check((await headset.evaluate(() => document.querySelector('#stage').children.length)) > 0, 'the lesson stays behind it: the child is not left in the dark');

console.log('\nStill no tablet after twenty seconds');
check(await becomes(alone, 'waiting', 30000), '"Waiting for the teacher\'s tablet", with a Connect button');
const pressed = await alone.evaluate(async () => {
  const button = document.querySelector('#rig a-plane.clickable');
  if (!button) return 'there is no button';
  button.emit('click');
  await new Promise((r) => setTimeout(r, 600));
  return document.querySelector('#rig > a-entity[data-screen]').dataset.screen;
});
check(pressed === 'searching', `Connect, looked at or pointed at: back to "Looking for the classroom…" (${pressed})`);

console.log('\nFaults');
check(errors.length === 0, errors.length ? `pages reported errors: ${errors.join(' | ')}` : 'no page reported an error');

await browser.close();
hub.kill();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
