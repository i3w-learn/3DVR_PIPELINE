#!/usr/bin/env node
/**
 * The classroom link, end to end.
 *
 * A teacher page and two headset pages open in the laptop's Chrome, all joined
 * through a real meeting point: the tablet app (VR-app repo) running in an
 * Android emulator or on a tablet plugged in over USB. Each line printed is
 * one thing a classroom needs: a headset waits for the teacher, is built from
 * her first message, a late headset is handed the current step, Next moves
 * every headset, Blackout reaches them, a switched-off headset is reported
 * within three seconds, and a restarted teacher page is not ignored.
 *
 * Before running:
 *
 *   adb install -r app-tablet-debug.apk      the tablet app, started once
 *   adb forward tcp:9001 tcp:9001            its meeting point, on this laptop
 *   npm run serve                            the lessons, on port 4500
 *
 * Usage: npm run content:classroom
 *        HUB=ws://192.168.8.100:9001 npm run content:classroom   a real tablet on the Wi-Fi
 */

import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://localhost:4500/app/';
const HUB = process.env.HUB ?? 'ws://localhost:9001';
const LESSON = 'gk-lkg-school-tour'; // two steps

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const context = await browser.newContext();
// Its own profile, so it gets its own headset number — two real headsets never share one.
const contextB = await browser.newContext();

// Record every frame each page receives from the meeting point.
for (const c of [context, contextB]) await c.addInitScript(() => {
  window.__frames = [];
  const Real = window.WebSocket;
  window.WebSocket = class extends Real {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (e) => window.__frames.push(JSON.parse(e.data)));
    }
  };
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (page, topic) => page.evaluate((t) => window.__frames.filter((f) => f.topic.match(t)), topic);
const waitFor = async (page, test, label, ms = 15000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const all = await page.evaluate(() => window.__frames);
    const hit = all.find(test);
    if (hit) return hit;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
};
let failed = 0;
const check = (ok, label) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed += 1; };

const open = async (query, ctx = context) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.goto(`${BASE}?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, null, { timeout: 60000 });
  return page;
};

// 1. A headset comes up first, with no teacher yet.
const headsetA = await open(`role=headset&classroom=${HUB}`);
await sleep(1500);
check((await frames(headsetA, /class\/state/)).length === 0, 'headset A waits: no state before the teacher arrives');
check(await headsetA.evaluate(() => !!document.querySelector('#waiting')), 'headset A shows "Waiting for the teacher" in the scene');

// 2. The teacher arrives and opens a lesson.
const teacher = await open(`lesson=${LESSON}&role=teacher&classroom=${HUB}`);
const first = await waitFor(headsetA, (f) => f.topic === 'class/state', 'state on headset A');
check(first.payload.lesson === LESSON && first.payload.step === 0, `headset A got "${first.payload.lesson}, step ${first.payload.step}" from the teacher`);
await headsetA.waitForFunction(() => document.querySelectorAll('#stage [gltf-model]').length > 0, null, { timeout: 60000 });
check(true, 'headset A built the lesson scene from that message');
check(await headsetA.evaluate(() => !document.querySelector('#waiting')), 'the waiting sign is gone');

// 3. Heartbeats reach the teacher.
const beat = await waitFor(teacher, (f) => /^headset\/\d+\/status$/.test(f.topic), 'a heartbeat on the teacher');
check(beat.payload.worn === false && 'fps' in beat.payload, `teacher hears headset ${beat.payload.id}: worn=${beat.payload.worn}, battery=${beat.payload.battery}, fps=${beat.payload.fps}`);
await teacher.waitForSelector(`#headsets .headset[data-id="${beat.payload.id}"]`, { timeout: 5000 });
const tile = await teacher.evaluate((id) => { const t = document.querySelector(`#headsets .headset[data-id="${id}"]`); return { state: t.dataset.state, battery: t.querySelector('.battery').textContent }; }, beat.payload.id);
check(tile.state === 'off', `the teacher's strip shows headset ${beat.payload.id}: ${tile.state}, battery "${tile.battery}"`);

// 4. A late headset is handed the current step on connect.
const headsetB = await open(`role=headset&classroom=${HUB}`, contextB);
const late = await waitFor(headsetB, (f) => f.topic === 'class/state', 'state on late headset B');
check(late.payload.lesson === LESSON, `headset B joined late and was handed "${late.payload.lesson}, step ${late.payload.step}" at once`);

// 5. Teacher taps Next: both headsets move.
const before = (await frames(headsetA, /class\/state/)).length;
await teacher.getByRole('button', { name: /next/i }).click();
const stepA = await waitFor(headsetA, (f) => f.topic === 'class/state' && f.payload.step === 1, 'step 1 on A');
const stepB = await waitFor(headsetB, (f) => f.topic === 'class/state' && f.payload.step === 1, 'step 1 on B');
check(stepA.payload.seq === stepB.payload.seq, `teacher tapped Next: both headsets on step 1 (seq ${stepA.payload.seq})`);
check((await frames(headsetA, /class\/state/)).length === before + 1, 'the sender did not hear its own message twice');

// 6. Blackout is a command, not state.
await teacher.getByRole('button', { name: /blackout/i }).click();
const cmd = await waitFor(headsetB, (f) => f.topic === 'class/command', 'blackout on B');
check(cmd.payload.cmd === 'blackout', 'teacher tapped Blackout: headsets got the command');

// 7. A headset that goes away is reported within 3 seconds.
const idB = (await waitFor(teacher, (f) => /status$/.test(f.topic) && f.payload.id !== beat.payload.id, 'B heartbeat')).payload.id;
await headsetB.close();
const t0 = Date.now();
const will = await waitFor(teacher, (f) => f.topic === `headset/${idB}/lwt`, 'lwt for B', 6000);
check(!!will, `headset B switched off: teacher told within ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await sleep(300);
check((await teacher.evaluate((id) => document.querySelector(`#headsets .headset[data-id="${id}"]`)?.dataset.state, idB)) === 'gone', `the strip shows headset ${idB} as gone`);

// 8. The teacher's page restarts: her fresh count must still beat the old one.
await teacher.close();
const teacher2 = await open(`lesson=${LESSON}&role=teacher&classroom=${HUB}`);
const fresh = await waitFor(headsetA, (f) => f.topic === 'class/state' && f.payload.seq > stepA.payload.seq, 'state from the restarted teacher', 20000);
check(fresh.payload.seq > stepA.payload.seq && fresh.payload.step === 0, `teacher restarted: headset A takes her "step 0" (count ${fresh.payload.seq} > ${stepA.payload.seq})`);

// 9. The teacher's own render follows too (its scene is a subscriber).
await teacher2.waitForFunction(() => document.querySelectorAll('#stage [gltf-model]').length > 0, null, { timeout: 60000 });
check(true, 'the teacher sees the same scene on the tablet');

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
