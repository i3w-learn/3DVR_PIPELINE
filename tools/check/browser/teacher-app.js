#!/usr/bin/env node
/**
 * The teacher's app, end to end.
 *
 * Opens the teacher's app (class.html) and real headset pages in the laptop's
 * Chrome, all joined through a meeting point, and goes through a whole class
 * the way a teacher would: sign in, choose a lesson, pair, play, pause, jump,
 * lose a headset, stop, rest, and do it again. Each line printed is one thing
 * that has to be true in a classroom.
 *
 * It needs a meeting point and the lessons served over HTTP. Either:
 *
 *   npm run classroom                 a stand-in for both, on this laptop
 *   npm run content:teacher
 *
 * or the real tablet app, in an emulator or plugged in over USB, serving its
 * own packed copy of the lessons:
 *
 *   adb forward tcp:18080 tcp:8080    the app's lessons server
 *   adb forward tcp:19001 tcp:9001    the app's meeting point
 *   BASE=http://localhost:18080/ HUB=ws://localhost:19001 npm run content:teacher
 *
 * Waiting eight minutes for the "running long" warning would make this check
 * useless, so the teacher's page is given a clock that can be pushed forward
 * (`__skip`). Only its own clock: the lesson and the headsets run in real time.
 */

import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://localhost:4500/app/';
const HUB = process.env.HUB ?? 'ws://localhost:9001';
const LESSON = 'eng-nur-letters-a-e'; // three and a half minutes, 35 steps

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (ok, label) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed += 1; };
const section = (title) => console.log(`\n${title}`);
const errors = [];

/** A browser profile of its own, recording every frame from the meeting point. */
async function profile() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    window.__frames = [];
    const Real = window.WebSocket;
    window.WebSocket = class extends Real {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', (e) => window.__frames.push(JSON.parse(e.data)));
      }
    };
    // The teacher's page only, never the lesson framed inside it.
    if (window.top === window) {
      const real = Date.now.bind(Date);
      let skipped = 0;
      Date.now = () => real() + skipped;
      window.__skip = (ms) => { skipped += ms; };
    }
  });
  return context;
}

function watch(page, label) {
  page.on('pageerror', (e) => { errors.push(`${label}: ${e.message}`); console.log(`  page error [${label}]: ${e.message}`); });
  if (process.env.LOGS) page.on('console', (m) => { if (/^(classroom|lesson|teacher|headset)/.test(m.text()) && !/status/.test(m.text())) console.log(`    [${label}] ${m.text()}`); });
}

async function openHeadset(id) {
  const page = await (await profile()).newPage();
  watch(page, `headset ${id}`);
  await page.goto(`${BASE}?role=headset&classroom=${HUB}&id=${id}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('a-scene')?.hasLoaded, null, { timeout: 60000 });
  return page;
}

const states = (page) => page.evaluate(() => window.__frames.filter((f) => f.topic === 'class/state').map((f) => f.payload));
const commands = (page) => page.evaluate(() => window.__frames.filter((f) => f.topic === 'class/command').map((f) => f.payload));
const lastState = async (page) => (await states(page)).at(-1) ?? null;
const waiting = (page) => page.evaluate(() => !!document.querySelector('#waiting'));
const built = (page) => page.evaluate(() => document.querySelector('#stage').children.length > 0);

async function until(test, label, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const value = await test();
    if (value) return value;
    await sleep(200);
  }
  console.log(`  (gave up waiting: ${label})`);
  return null;
}

const centre = await (await fetch(`${BASE}centre.json`)).json();
const { lands } = await (await fetch(`${BASE}lands.json`)).json();

const teacherProfile = await profile();
const app = await teacherProfile.newPage();
watch(app, 'teacher app');

const screen = () => app.evaluate(() => document.querySelector('#app').dataset.screen);
const onScreen = (name, ms = 15000) => app.waitForSelector(`#app[data-screen="${name}"]`, { timeout: ms }).then(() => true, () => false);
const tap = (selector) => app.locator(selector).first().click();
const text = (selector) => app.locator(selector).first().innerText();
const info = () => app.evaluate(() => document.getElementById('lesson')?.contentWindow?.teacher?.info() ?? null);
const lessonReady = () => app.waitForFunction(() => document.getElementById('lesson')?.contentWindow?.teacher, null, { timeout: 60000 });
const rows = () => app.evaluate(() => [...document.querySelectorAll('#rows .row')].map((r) => `${r.querySelector('b').textContent}: ${r.dataset.state}`));

/* ───────────────────────────── signing in ──────────────────────────────── */

section('Signing in');
await app.goto(`${BASE}class.html?classroom=${HUB}`, { waitUntil: 'load' });
check(await onScreen('splash', 3000), 'the app opens on the splash screen');
check(await onScreen('signin'), 'a tablet that has never signed in is asked to');

await app.fill('input[name="id"]', centre.id);
await app.fill('input[name="password"]', 'not the password');
await tap('form button.primary');
check(await app.locator('.banner[data-kind="error"]').isVisible(), 'wrong details: the screen says they do not match');
check((await app.inputValue('input[name="id"]')) === centre.id, 'what the teacher typed is kept, so only the mistake is fixed');
check((await screen()) === 'signin', 'and she is not let in');

await app.fill('input[name="id"]', centre.id.toLowerCase());
await app.fill('input[name="password"]', centre.password);
await tap('form button.primary');
check((await screen()) === 'signin', 'the centre ID in small letters is refused: capital letters matter');

await app.fill('input[name="id"]', centre.id);
await app.fill('input[name="password"]', centre.password);
await tap('[data-action="peek"]');
check((await app.getAttribute('input[name="password"]', 'type')) === 'text', 'the eye button shows the password');
await app.press('input[name="password"]', 'Enter');
check(await onScreen('confirm'), 'right details and Enter on the keyboard: "Logged in as Teacher"');
check((await text('.where')).includes(centre.name) && (await text('.where')).includes(centre.village), `it names the centre: "${await text('.where')}"`);
check((await app.getAttribute(`.lang button[data-lang="${centre.lang}"]`, 'aria-pressed')) === 'true', `the app switched to the centre's language (${centre.lang})`);
await tap('[data-action="confirmed"]');
check(await onScreen('home'), 'OK goes to the home screen');

await app.reload({ waitUntil: 'load' });
check(await onScreen('home'), 'opened again: straight to home, no second sign-in');

/* ───────────────────────── home, guide and library ─────────────────────── */

section('Home, language, guide and library');
await tap('.lang button[data-lang="en"]');
check((await text('[data-action="pair"]')) === 'Start pairing', 'English: the button reads "Start pairing"');
await tap('.lang button[data-lang="mr"]');
check((await text('[data-action="pair"]')) === 'जोडणी सुरू करा', 'Marathi: the same button reads "जोडणी सुरू करा"');
await tap('.lang button[data-lang="en"]');
check(await app.locator('.empty-slot').isVisible(), 'no lesson chosen yet: the empty slot says so');

await tap('[data-action="guide"]');
check((await screen()) === 'guide' && (await app.locator('.tip').count()) === 4, 'Help opens the teacher guide, four cards');
await tap('[data-action="close"]');
check((await screen()) === 'home', 'Close comes back to home');

await tap('[data-action="library"]');
const usable = lands.filter((l) => l.group !== 'unused');
const locked = usable.filter((l) => l.review === true);
check((await app.locator('.library .lesson').count()) === usable.length, `the library shows every land that has a lesson (${usable.length})`);
check((await app.locator('.library .lesson:disabled').count()) === locked.length, `the ${locked.length} lessons waiting for sign-off cannot be chosen`);
const broken = await app.evaluate(async () => {
  const images = [...document.querySelectorAll('.library img')];
  await Promise.all(images.map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); }));
  return images.filter((i) => !i.naturalWidth).length;
});
check(broken === 0, 'every lesson has its picture');
check(/^\d+ min$/.test(await text(`[data-lesson="${LESSON}"] .caption span`)), `each says how long it runs: "${await text(`[data-lesson="${LESSON}"] .caption span`)}"`);
await tap(`[data-lesson="${LESSON}"]`);
check((await screen()) === 'home' && (await text('.ready-line')).startsWith('Ready to show'), `picking one comes back to home: "${await text('.ready-line')}"`);
await app.reload({ waitUntil: 'load' });
await onScreen('home');
check(await app.locator('.home .lesson.picked').isVisible(), 'opened again: the chosen lesson is remembered');

/* ──────────────────────────────── pairing ──────────────────────────────── */

section('Pairing');
await tap('[data-action="pair"]');
check((await text('#count')) === `0 of ${centre.headsets} headsets ready`, `no headset on yet: "${await text('#count')}"`);
check(await app.locator('#paired').isDisabled(), 'Done cannot be tapped with no headset');
check((await app.locator('.tile[data-state="looking"]').count()) === centre.headsets, `one "Looking for…" slot for each of the kit's ${centre.headsets} headsets`);

const headsetA = await openHeadset(1);
check(await until(async () => (await text('#count')).startsWith('1 of'), 'headset 1 ready', 6000) !== null, 'headset 1 switched on: it is Ready on the tablet within seconds');
check((await text('#paired')) === 'Start with 1', 'the button now reads "Start with 1"');
check(await waiting(headsetA), 'headset 1 shows "Waiting for the teacher"');
check((await lastState(headsetA))?.lesson === null, 'the app, on opening, told the room no lesson is on: nothing left over from last time');
const headsetB = await openHeadset(2);
await until(async () => (await text('#count')).startsWith('2 of'), 'headset 2 ready', 6000);
check((await app.locator('.tile[data-state="ready"]').count()) === 2, 'headset 2 joins: two green tiles');

/* ───────────────────────────────── player ──────────────────────────────── */

section('Player: ready, play, jump, pause');
await tap('#paired');
await onScreen('player');
await lessonReady();
await sleep(1000);
check((await states(headsetA)).every((s) => s.lesson === null) && (await waiting(headsetA)), 'the lesson is loaded on the tablet and nothing has been sent: headsets still wait');
check((await text('#toggle')) === 'Play for everyone', 'the big button reads "Play for everyone"');
check(await app.locator('#poster').isVisible(), 'the picture is the still poster until Play');
check(await app.locator('[data-action="seek"]').first().isDisabled(), 'the 10-second buttons are off until the lesson is on');

await tap('#toggle');
const first = await until(() => lastState(headsetA), 'state on headset 1');
check(first?.lesson === LESSON && first.step === 0, `Play: headset 1 is told "${first?.lesson}, step ${first?.step}"`);
check((await until(() => built(headsetA), 'headset 1 built', 60000)) === true, 'headset 1 builds the lesson');
check(!(await waiting(headsetA)), 'its waiting sign is gone');
check((await lastState(headsetB))?.seq === first?.seq, 'headset 2 got the very same message: they start together');
check((await commands(headsetA)).some((c) => c.cmd === 'volume'), 'the volume was sent along with it');
check((await text('#toggle')) === 'Pause for everyone', 'the big button now reads "Pause for everyone"');
check(await app.locator('#poster').isHidden(), 'the poster gives way to the live lesson');
const early = (await info()).position;
await sleep(2000);
check((await info()).position > early, `the time is moving: ${await text('#at')} of ${await text('#total')}`);
check((await rows()).every((r) => r.endsWith('removed')), `test headsets are not on a head, so the tablet says so: ${(await rows()).join(', ')}`);
check((await app.locator('#play-banner').getAttribute('data-kind')) === 'warn', 'and shows the "a child took off the headset" banner');

const stepBefore = (await lastState(headsetA)).step;
await tap('[data-by="10000"]');
const forward = await until(async () => { const s = await lastState(headsetA); return s.step > stepBefore ? s : null; }, 'forward');
check(forward !== null, `10 s forward: the class jumps on, step ${stepBefore} → ${forward?.step}`);
await tap('[data-by="-10000"]');
const back = await until(async () => { const s = await lastState(headsetA); return s.seq > forward.seq && s.step < forward.step ? s : null; }, 'back');
check(back !== null, `10 s back: the class jumps back, step ${forward?.step} → ${back?.step}`);

await tap('#toggle');
const held = (await info()).position;
const stateAtPause = await lastState(headsetA);
await sleep(8000); // longer than any one step
check((await info()).position === held, 'Pause: the time stops');
check((await lastState(headsetA)).seq === stateAtPause.seq, 'and no headset is moved on while paused');
check((await app.locator('#play-banner').getAttribute('data-kind')) !== null && (await text('#toggle')) === 'Resume for everyone', 'the button reads "Resume for everyone"');
await tap('#toggle');
await sleep(1500);
check((await info()).position > held, 'Resume: the time carries on from the same moment');

section('Player: language, volume, a late headset, a lost headset');
const beforeToggle = await info();
await tap('.lang button[data-lang="mr"]');
check((await text('#toggle')) === 'सर्वांसाठी थांबवा', 'switching to Marathi mid-lesson changes the buttons');
check((await info()).started && (await info()).position >= beforeToggle.position, 'and does not restart the lesson');
await tap('.lang button[data-lang="en"]');

await app.locator('#volume').fill('40');
const quiet = await until(async () => (await commands(headsetA)).find((c) => c.cmd === 'volume' && c.level === 0.5), 'volume 0.5');
check(quiet !== null, 'volume halved on the tablet: headsets are told 0.5');
await app.locator('#volume').fill('100');
check((await app.inputValue('#volume')) === '80', 'the slider will not go past "Safe max"');

const headsetC = await openHeadset(3);
const late = await until(() => lastState(headsetC), 'state on late headset');
check(late?.lesson === LESSON, `headset 3 joins mid-lesson and is handed the current step at once (step ${late?.step})`);
check((await until(async () => (await rows()).length === 3, 'third row', 5000)) !== null, 'it appears in the tablet\'s list');

await headsetC.close();
check((await until(async () => (await rows()).some((r) => r === 'Headset 03: reconnecting'), 'reconnecting', 6000)) !== null, 'headset 3 switched off: "Reconnecting" within seconds');
check((await until(async () => (await rows()).some((r) => r === 'Headset 03: disconnected'), 'disconnected', 14000)) !== null, 'still gone after ten seconds: "Disconnected"');
check((await app.locator('#play-banner').getAttribute('data-kind')) === 'error' && (await text('#play-banner b')).includes('Headset 03'), `the banner says which one: "${await text('#play-banner b')}"`);
const during = (await lastState(headsetA)).seq;
await sleep(6000);
check((await lastState(headsetA)).seq > during, 'the lesson carries on for everyone else');

/* ───────────────────────────── stop and rest ───────────────────────────── */

section('Stop all, and the rest break');
await tap('[data-action="stop"]');
check(await onScreen('rest'), 'Stop all: the tablet goes to the rest screen');
const stopped = await until(async () => { const s = await lastState(headsetA); return s.lesson === null ? s : null; }, 'stop on headset 1');
check(stopped !== null, 'every headset is told the lesson is over');
check((await until(() => waiting(headsetA), 'waiting sign back', 5000)) === true && !(await built(headsetA)), 'headset 1 is back on "Waiting for the teacher", the lesson cleared away');
const headsetD = await openHeadset(4);
await sleep(2000);
check((await waiting(headsetD)) && !(await built(headsetD)), 'a headset switched on now waits too: it is not handed the old lesson');
check(await app.locator('#next').isDisabled(), `the next lesson is locked: "${await text('#next')}"`);
const left = await text('#left');
await sleep(1500);
check((await text('#left')) !== left, `the rest clock counts down: ${left} → ${await text('#left')}`);
await app.evaluate(() => window.__skip(5 * 60 * 1000));
check((await until(async () => !(await app.locator('#next').isDisabled()), 'rest over', 3000)) !== null, `after five minutes it unlocks: "${await text('#next')}"`);
await tap('[data-action="skip"]');
check((await screen()) === 'home', '"Skip rest" goes home');

section('The same lesson again');
await tap('[data-action="pair"]');
await until(async () => !(await app.locator('#paired').isDisabled()), 'headsets still there', 6000);
// Pushing the teacher's clock on five minutes made every headset look long
// gone for a moment; each is back with its next heartbeat, a second later.
await until(async () => (await text('#count')).startsWith('3 of'), 'three headsets back', 6000);
check((await text('#count')) === `3 of ${centre.headsets} headsets ready`, `pairing again: "${await text('#count')}" (headsets 1, 2 and 4)`);
check((await text('.tile:nth-child(3)')).startsWith('Looking for Headset 03'), 'headset 3, switched off earlier, is back to "Looking for…", not stuck on "Connecting"');
await tap('#paired');
await onScreen('player');
await lessonReady();
await tap('#toggle');
const again = await until(async () => { const s = await lastState(headsetA); return s.lesson === LESSON && s.seq > stopped.seq ? s : null; }, 'second run');
check(again?.step === 0, 'played again: headset 1 takes the new "step 0" and is not stuck on the old one');
check((await until(() => built(headsetA), 'rebuilt', 60000)) === true && !(await waiting(headsetA)), 'and builds the lesson again');

/* ─────────────────────────── the eye-rest limits ───────────────────────── */

section('Running long');
check(await app.locator('#long').isHidden(), 'no warning at the start');
await app.evaluate(() => window.__skip(8 * 60 * 1000));
check((await until(() => app.locator('#long').isVisible(), 'long warning', 3000)) === true, 'after eight minutes of watching: "This lesson is running long"');
check((await app.locator('#lesson-time').getAttribute('data-long')) !== null, `the lesson timer changes colour: "${await text('#lesson-time')}"`);
check((await info()).started && !(await info()).over, 'the lesson keeps playing behind the warning');
await tap('[data-action="let-finish"]');
check(await app.locator('#long').isHidden(), '"Let it finish" closes the warning');
await app.evaluate(() => window.__skip(2 * 60 * 1000));
check(await onScreen('rest', 6000), 'at ten minutes the tablet stops the lesson by itself');
check((await until(async () => (await lastState(headsetA)).lesson === null, 'auto stop on headset', 5000)) === true, 'and the headsets go back to waiting');

/* ─────────────────── pairing first, and a lesson that ends ─────────────── */

section('Pair first, choose after; and a lesson that ends by itself');
await app.evaluate(() => localStorage.removeItem('class.lesson'));
await app.reload({ waitUntil: 'load' });
await onScreen('home');
check(await app.locator('.empty-slot').isVisible(), 'home with no lesson chosen');
await tap('[data-action="pair"]');
await until(async () => !(await app.locator('#paired').isDisabled()), 'headsets ready', 8000);
await tap('#paired');
check((await screen()) === 'library', 'paired with no lesson: the tablet asks for one');
// The shortest lesson there is, so its end comes soon.
const shortest = await app.evaluate(() => {
  const cards = [...document.querySelectorAll('.library .lesson:not(:disabled)')];
  cards.sort((a, b) => parseInt(a.querySelector('.caption span').textContent, 10) - parseInt(b.querySelector('.caption span').textContent, 10));
  return cards[0].dataset.lesson;
});
await tap(`[data-lesson="${shortest}"]`);
check(await onScreen('player'), `choosing "${shortest}" goes straight to the player`);
await lessonReady();
await tap('#toggle');
await until(async () => (await lastState(headsetA)).lesson === shortest, 'short lesson on headset');
check((await lastState(headsetA)).lesson === shortest, 'Play: the headsets move to the new lesson');
for (let i = 0; i < 60 && (await screen()) === 'player'; i += 1) {
  await app.locator('[data-by="10000"]').click({ timeout: 2000 }).catch(() => {});
  await sleep(250);
}
check(await onScreen('rest', 5000), 'the lesson reaches its end: the rest screen comes up by itself');
check((await until(async () => (await lastState(headsetA)).lesson === null, 'end on headset', 5000)) === true, 'and the headsets go back to waiting');
check((await text('.art h2')).startsWith('Lesson finished'), `"${await text('.art h2')}" ${await text('.art h2 + p')}`);

/* ─────────────────────── what was there before still works ─────────────── */

section('The reviewer\'s own lesson page, unchanged');
const review = await (await profile()).newPage();
watch(review, 'reviewer');
await review.goto(`${BASE}?lesson=gk-lkg-school-tour&role=teacher`, { waitUntil: 'load' });
await review.waitForFunction(() => window.teacher, null, { timeout: 60000 });
check((await review.evaluate(() => window.teacher.info().started)) === true, 'opened without the app, a lesson still starts by itself');
check(await review.locator('#controls [data-action="next"]').isVisible(), 'and still has its own bar of buttons');
await review.close();

section('Demo mode');
const demo = await (await profile()).newPage();
watch(demo, 'demo');
await demo.goto(`${BASE}class.html?demo`, { waitUntil: 'load' });
await demo.waitForSelector('#app[data-screen="signin"]', { timeout: 15000 });
await demo.fill('input[name="id"]', centre.id);
await demo.fill('input[name="password"]', centre.password);
await demo.locator('form button.primary').click();
await demo.locator('[data-action="confirmed"]').click();
await demo.locator('[data-action="pair"]').click();
const all = await demo.waitForFunction((n) => document.querySelectorAll('.tile[data-state="ready"]').length === n, centre.headsets, { timeout: 15000 }).then(() => true, () => false);
check(all, `?demo: ${centre.headsets} pretend headsets join by themselves`);
check((await demo.locator('.battery[data-low]').count()) === 1, 'one of them has a low battery, shown in red');
await demo.close();

section('Faults');
check(errors.length === 0, errors.length ? `pages reported errors: ${errors.join(' | ')}` : 'no page reported an error, from first screen to last');

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
