#!/usr/bin/env node
/**
 * The things around the lessons: the list of lands, the lobby, the four
 * languages, the clock and the teacher's buttons, the alphabet running from A
 * to Z, and the child's view.
 *
 * `content:browse` walks every lesson. This presses what a teacher presses —
 * and it is how the "enter VR" button was found sitting on top of Blackout.
 *
 * Usage:
 *   npm run content:around                                 the live site
 *   BASE=http://localhost:4500/app/ npm run content:around  this laptop
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { ROOT } from '../../lib/paths.js';

const BASE = process.env.BASE ?? 'https://i3wvr.web.app/';
/** The short links (/lands, /vr, /beach) are the live site's; a laptop has none. */
const LIVE = !/localhost/.test(BASE);
const PROJECT = ROOT;
const OUT = path.join(ROOT, '.work', 'browse', 'around');
await fs.mkdir(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

function watch(page, log) {
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) log.push(`console error: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => log.push(`page error: ${String(e.message).slice(0, 200)}`));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) log.push(`${r.status()}: ${r.url()}`); });
}
const say = (ok, what, detail = '') => console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`);

// 1. The land list: every card is there and leads somewhere that opens.
{
  const page = await context.newPage(); const log = []; watch(page, log);
  await page.goto(LIVE ? `${BASE}lands` : `${BASE}lands.html`, { waitUntil: 'networkidle' });
  const lands = JSON.parse(await fs.readFile(`${PROJECT}/app/lands.json`, 'utf8')).lands;
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 40), img: a.querySelector('img')?.naturalWidth ?? null })));
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src')));
  await page.screenshot({ path: path.join(OUT, 'lands.jpg'), type: 'jpeg', quality: 70, fullPage: true });
  say(links.length >= lands.length && !broken.length && !log.length, `land list page: ${links.length} links for ${lands.length} lands, ${broken.length} broken pictures`, [...log, ...broken].join('; '));
  await page.close();
}

// 2. The lobby inside VR (flat here): the ring of cards builds.
{
  const page = await context.newPage(); const log = []; watch(page, log);
  await page.goto(LIVE ? `${BASE}vr` : `${BASE}?lesson=lobby&role=teacher`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#position')?.textContent || document.querySelector('#error')?.textContent, null, { timeout: 45000 });
  await sleep(6000);
  const cards = await page.evaluate(() => document.querySelectorAll('#stage .clickable').length);
  await page.screenshot({ path: path.join(OUT, 'lobby.jpg'), type: 'jpeg', quality: 70 });
  // pick the first card the way a finger would: its click handler
  const before = await page.evaluate(() => document.querySelector('#script-line')?.textContent ?? '');
  await page.evaluate(() => document.querySelector('#stage .clickable')?.dispatchEvent(new CustomEvent('click')));
  await sleep(6000);
  const after = await page.evaluate(() => ({ line: document.querySelector('#script-line')?.textContent ?? '', pos: document.querySelector('#position')?.textContent ?? '', err: document.querySelector('#error')?.textContent ?? '' }));
  await page.screenshot({ path: path.join(OUT, 'lobby-picked.jpg'), type: 'jpeg', quality: 70 });
  say(cards > 0 && !log.length && !after.err, `lobby: ${cards} cards; picking the first one went to "${after.line.slice(0, 50)}" (${after.pos})`, [...log, after.err].filter(Boolean).join('; '));
  // and back with the Lands button
  await page.click('[data-action="lands"]'); await sleep(5000);
  const home = await page.evaluate(() => document.querySelectorAll('#stage .clickable').length);
  say(home > 0, `Lands button goes back to the lobby (${home} cards)`);
  await page.close();
}

// 3. Languages: the words on the bar and the clip that is asked for.
for (const lang of ['en', 'hi', 'mr', 'or']) {
  const page = await context.newPage(); const log = []; watch(page, log); const clips = [];
  page.on('response', (r) => { if (/\.mp3/.test(r.url())) clips.push(`${r.status()} ${r.url().split('/assets/')[1]}`); });
  const lesson = JSON.parse(await fs.readFile(`${PROJECT}/app/lessons/eng-nur-fruits.json`, 'utf8'));
  await page.goto(`${BASE}?role=teacher&lesson=eng-nur-fruits&lang=${lang}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#position')?.textContent, null, { timeout: 45000 });
  await sleep(3000);
  const line = await page.evaluate(() => document.querySelector('#script-line')?.textContent ?? '');
  const right = line === lesson.steps[0].script[lang];
  const fromFolder = clips.some((c) => c.startsWith(`200 audio/${lang}/`) || c.startsWith(`206 audio/${lang}/`));
  say(right && fromFolder && !log.length, `language ${lang}: bar says "${line}", clip ${clips[0] ?? 'NOT asked for'}`, log.join('; '));
  await page.close();
}

// 4. The clock: left alone, a lesson moves on by itself.
{
  const page = await context.newPage(); const log = []; watch(page, log);
  await page.goto(`${BASE}?role=teacher&lesson=math-nur-in-out`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#position')?.textContent, null, { timeout: 45000 });
  const first = await page.evaluate(() => document.querySelector('#position').textContent);
  const lesson = JSON.parse(await fs.readFile(`${PROJECT}/app/lessons/math-nur-in-out.json`, 'utf8'));
  await sleep(lesson.steps[0].duration + 2500);
  const second = await page.evaluate(() => document.querySelector('#position').textContent);
  say(first.startsWith('1 /') && second.startsWith('2 /'), `the clock moves a lesson on by itself (${first} → ${second})`, log.join('; '));
  // Back, Pause, Blackout
  await page.click('[data-action="pause"]'); await page.click('[data-action="back"]'); await sleep(400);
  const back = await page.evaluate(() => document.querySelector('#position').textContent);
  await sleep(lesson.steps[0].duration + 1500);
  const held = await page.evaluate(() => document.querySelector('#position').textContent);
  say(back.startsWith('1 /') && held.startsWith('1 /'), `Back goes back, and Pause holds the step (${back}, still ${held} after waiting)`);
  // Is each button the thing a finger would actually hit at its middle?
  for (const size of [[1512, 806], [1280, 720], [1024, 768], [820, 1180]]) {
    await page.setViewportSize({ width: size[0], height: size[1] }); await sleep(300);
    const covered = await page.evaluate(() => [...document.querySelectorAll('#controls button')].filter((b) => {
      const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== b && !b.contains(hit);
    }).map((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${b.dataset.action} is under <${hit?.className || hit?.tagName}>`; }));
    say(!covered.length, `buttons at ${size[0]}×${size[1]}: every one can be pressed`, covered.join('; '));
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.querySelector('[data-action="blackout"]').click()); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'blackout.jpg'), type: 'jpeg', quality: 60 });
  await page.evaluate(() => document.querySelector('[data-action="blackout"]').click()); await sleep(1200);
  await page.screenshot({ path: path.join(OUT, 'blackout-off.jpg'), type: 'jpeg', quality: 60 });
  await page.close();
}

// 5. The alphabet runs from A to Z on its own buttons.
{
  const page = await context.newPage(); const log = []; watch(page, log);
  await page.goto(LIVE ? `${BASE}beach` : `${BASE}?lesson=eng-nur-letters-a-e&role=teacher`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#position')?.textContent, null, { timeout: 45000 });
  await page.click('[data-action="pause"]');
  const seen = []; let last = null;
  const read = () => page.evaluate(() => ({ line: document.querySelector('#script-line')?.textContent ?? '', pos: document.querySelector('#position')?.textContent ?? '' }));
  let doubled = '';
  for (let i = 0; i < 700; i++) {
    const { line, pos } = await read();
    if (line !== last) { const m = /^This is (capital|small) (\w)\.$/.exec(line); if (m) seen.push(m[2]); last = line; }
    if (line === 'Z. Zebra, Zebu.') break;
    if (line === 'E. Elephant, Eagle, Egg.') {
      // a hurried teacher: two presses at the end of a part
      await page.click('[data-action="next"]'); await page.click('[data-action="next"]'); await sleep(2500);
      const a = await read(); await page.click('[data-action="next"]'); await sleep(300); await page.click('[data-action="next"]'); await sleep(2500);
      const b = await read(); doubled = `${a.pos} → ${b.pos}`;
      if (!seen.includes('F')) seen.push('F'); if (!seen.includes('f')) seen.push('f'); last = b.line;
      continue;
    }
    await page.click('[data-action="next"]'); await sleep(110);
  }
  await sleep(3000);
  const end = await page.evaluate(() => ({ line: document.querySelector('#script-line')?.textContent ?? '', pos: document.querySelector('#position')?.textContent ?? '', err: document.querySelector('#error')?.textContent ?? '' }));
  await page.screenshot({ path: path.join(OUT, 'alphabet-end.jpg'), type: 'jpeg', quality: 70 });
  const letters = seen.join('');
  say(letters === 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz' && !end.err && !log.length, `alphabet from /beach: letters met in order "${letters}", ends on "${end.line}" (${end.pos})`, [...log, end.err].filter(Boolean).join('; '));
  const [from, to] = doubled.split(' → ').map((p) => Number(p.split(' / ')[0]));
  say(doubled.includes('/ 33') && to === from + 2, `two quick presses of Next at the end of A–E go on into F–J and are not put back to the start (${doubled}, then two more presses)`);
  await page.close();
}

// 6. The child's view: opens clean, and waits for a teacher.
{
  const page = await context.newPage(); const log = []; watch(page, log);
  await page.goto(`${BASE}?role=headset`, { waitUntil: 'load' });
  await sleep(6000);
  const state = await page.evaluate(() => ({ bar: !!document.querySelector('#controls')?.textContent.trim(), things: document.querySelector('#stage')?.children.length ?? -1, err: document.querySelector('#error')?.textContent ?? '', vrButton: !!document.querySelector('.a-enter-vr, .a-enter-vr-button'), xr: 'xr' in navigator }));
  await page.screenshot({ path: path.join(OUT, 'headset.jpg'), type: 'jpeg', quality: 70 });
  say(!log.length && !state.err, `child's view (?role=headset): no teacher bar=${!state.bar}, things on stage=${state.things}, VR button on page=${state.vrButton}`, [...log, state.err].filter(Boolean).join('; '));
  await page.close();
}

await browser.close();
