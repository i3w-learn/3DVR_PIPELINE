#!/usr/bin/env node
/**
 * Open every lesson in a real browser and walk it, step by step.
 *
 * `content:check` answers what can be known from the files: the model exists,
 * the clip exists, the scene fits the budget. It cannot see a card that drew
 * blank, a button another button is sitting on, or a dark pool under a table
 * of insects. The first time this ran, every lesson passed `content:check` and
 * nine things were wrong.
 *
 * For each lesson: open the teacher's view, hold the clock, press Next through
 * every step. Written down as a problem: a console error, a file that did not
 * load, a line on the bar that is not the lesson's line, a model with no mesh,
 * a card whose words did not draw, a bar button that cannot be pressed. A
 * picture of the first and the last step is kept — run `content:sheets` and
 * LOOK at them; most of what was wrong was only visible there.
 *
 * Usage:
 *   npm run serve                       (in another terminal)
 *   npm run content:browse              every lesson, on this laptop
 *   npm run content:browse -- eng-nur-fruits hin-ukg-swar
 *   BASE=https://i3wvr.web.app/ npm run content:browse      the live site
 *   PATIENCE=180000 WORKERS=1 BASE=… npm run content:browse  …on a slow line
 *
 * "model did not load" with a "still loading" note and no failed file is a
 * slow connection, not a fault: a lesson is 15-20 MB, and the check looks
 * after PATIENCE milliseconds whether it has all arrived or not.
 *
 * The live site is published from a clean copy of `main`, and is not this
 * laptop: run it there too after a deploy.
 *
 * Uses the Chrome that is installed, without a window. About 25 minutes for
 * 130 lessons. Results and pictures land in `.work/browse/`, which git ignores.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { LESSONS_DIR, ROOT } from '../../lib/paths.js';

const BASE = process.env.BASE ?? 'http://localhost:4500/app/';
const OUT = path.join(ROOT, '.work', 'browse');
const SHOTS = path.join(OUT, 'shots');
const WORKERS = Number(process.env.WORKERS ?? 4);
/** How long to wait for a step's files before looking anyway. Raise it on a slow line. */
const PATIENCE = Number(process.env.PATIENCE ?? 25000);

const index = JSON.parse(await fs.readFile(path.join(LESSONS_DIR, 'index.json'), 'utf8')).lessons;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(index).sort();
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function quiet(page, pending, max = PATIENCE) {
  // wait until nothing has been in flight for a second
  const start = Date.now();
  let calm = Date.now();
  while (Date.now() - start < max) {
    if (pending.size) calm = Date.now();
    if (Date.now() - calm > 1000) return true;
    await sleep(150);
  }
  return false;
}

async function audit(context, id) {
  const lesson = JSON.parse(await fs.readFile(path.join(LESSONS_DIR, index[id]), 'utf8'));
  const page = await context.newPage();
  const result = { id, stage: lesson.stage, template: lesson.template, steps: lesson.steps.length, problems: [], notes: [] };
  const pending = new Set();
  const audio = new Set();

  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error') { if (!/^Failed to load resource/.test(text)) result.problems.push(`console error: ${text.slice(0, 220)}`); } // a failed file is reported by address below
    else if (m.type() === 'warning' && !/THREE\.WebGLRenderer|deprecated|GPU stall|WebXR|powerPreference|Automatic fallback/i.test(text)) result.notes.push(`warning: ${text.slice(0, 200)}`);
  });
  page.on('pageerror', (e) => result.problems.push(`page error: ${String(e.message).slice(0, 220)}`));
  page.on('request', (r) => pending.add(r));
  const done = (r) => pending.delete(r);
  page.on('requestfinished', done);
  page.on('requestfailed', (r) => {
    done(r);
    const why = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(why)) result.problems.push(`request failed: ${r.url().replace(BASE, '')} ${why}`);
  });
  page.on('response', (r) => {
    const url = r.url();
    if (/\.mp3(\?|$)/.test(url)) audio.add(url.replace(BASE, ''));
    if (r.status() >= 400) result.problems.push(`${r.status()}: ${url.replace(BASE, '')}`);
  });

  try {
    await page.goto(`${BASE}?role=teacher&lesson=${id}&review=1`, { waitUntil: 'load', timeout: Math.max(45000, PATIENCE) });
    await page.waitForFunction(() => document.querySelector('#position')?.textContent || document.querySelector('#error')?.textContent, null, { timeout: Math.max(45000, PATIENCE) });

    const error = await page.evaluate(() => document.querySelector('#error')?.textContent ?? '');
    if (error) result.problems.push(`error on screen: ${error.slice(0, 220)}`);

    // hold the clock, so the steps are ours to take
    await page.click('[data-action="pause"]').catch(() => {});
    if (!(await quiet(page, pending))) result.notes.push(`still loading after ${PATIENCE / 1000} s at the first step`);
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, `${id}--a.jpg`), type: 'jpeg', quality: 70 });

    const total = await page.evaluate(() => Number((document.querySelector('#position')?.textContent ?? '').split('/')[1]) || 0);
    if (total !== lesson.steps.length) result.problems.push(`bar says ${total} steps, the lesson file has ${lesson.steps.length}`);

    // a card or a name card whose words did not draw
    const blankText = () => page.evaluate(() => [...document.querySelectorAll('#stage [text]')].filter((t) => {
      let shown = true; for (let n = t; n && n.id !== 'stage'; n = n.parentNode) if (n.object3D && !n.object3D.visible) shown = false;
      const value = (t.getAttribute('text')?.value ?? '').trim(); const mesh = t.getObject3D('text');
      return shown && value && !(mesh?.geometry?.attributes?.position?.count > 0);
    }).map((t) => t.getAttribute('text').value));
    const blanks = new Map();
    const lookForBlanks = async (where) => {
      if (!(await blankText()).length) return;
      await sleep(700); // a font still arriving is not a blank card
      for (const v of await blankText()) if (!blanks.has(v)) blanks.set(v, `"${v}" (first at ${where})`);
    };
    await lookForBlanks('step 1');

    // walk every step; the script line must match the file each time
    let mismatched = 0;
    for (let i = 1; i < lesson.steps.length; i++) {
      await page.click('[data-action="next"]');
      await sleep(120);
      const line = await page.evaluate(() => document.querySelector('#script-line')?.textContent ?? '');
      const want = lesson.steps[i].script?.en ?? '';
      if (line !== want) mismatched += 1;
      await lookForBlanks(`step ${i + 1}`);
    }
    for (const b of blanks.values()) result.problems.push(`blank card: ${b}`);
    if (mismatched) result.problems.push(`${mismatched} step(s) showed a different line from the lesson file`);

    const at = await page.evaluate(() => document.querySelector('#position')?.textContent ?? '');
    if (lesson.steps.length > 1 && !at.startsWith(`${lesson.steps.length} /`) && !lesson.next) result.problems.push(`did not reach the last step (bar says "${at}")`);

    if (!(await quiet(page, pending))) result.notes.push(`still loading after ${PATIENCE / 1000} s at the last step`);
    await sleep(3500); // arrivals

    // what is actually in the scene
    const scene = await page.evaluate(() => {
      const out = { models: 0, missing: [], odd: [], fps: null, objects: 0, visible: 0 };
      const stage = document.querySelector('#stage');
      const box = new THREE.Box3();
      const size = new THREE.Vector3();
      for (const el of stage.querySelectorAll('[gltf-model]')) {
        out.models += 1;
        if (!el.getObject3D('mesh')) out.missing.push(el.id || el.getAttribute('gltf-model'));
      }
      for (const el of stage.children) {
        if (el.classList.contains('prop')) continue;
        out.objects += 1;
        if (!el.object3D.visible) continue;
        out.visible += 1;
        box.setFromObject(el.object3D);
        if (box.isEmpty()) { out.odd.push(`${el.id}: nothing to draw`); continue; }
        box.getSize(size);
        const nums = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
        if (nums.some((n) => !Number.isFinite(n))) out.odd.push(`${el.id}: position is not a number`);
        else if (box.max.y < -0.3) out.odd.push(`${el.id}: wholly under the ground (top at ${box.max.y.toFixed(2)} m)`);
      }
      // a dark patch far wider than a child's table is a pool, not a contact shadow
      for (const el of stage.querySelectorAll('[contact-shadow]')) {
        let shown = true; for (let n = el; n && n.id !== 'stage'; n = n.parentNode) if (n.object3D && !n.object3D.visible) shown = false;
        const patch = el.components['contact-shadow']?.patch; if (!shown || !patch) continue;
        const across = patch.getWorldScale(new THREE.Vector3()).x;
        if (across > 6) out.pools = (out.pools ?? []).concat(`${el.id || el.getAttribute('gltf-model')}: dark patch ${across.toFixed(1)} m across`);
      }
      // can each button be pressed at its middle?
      out.covered = [...document.querySelectorAll('#controls button')].filter((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit !== b && !b.contains(hit); }).map((b) => b.dataset.action);
      const err = document.querySelector('#error')?.textContent ?? '';
      if (err) out.error = err;
      return out;
    });
    if (scene.error) result.problems.push(`error on screen: ${scene.error.slice(0, 220)}`);
    for (const m of scene.missing) result.problems.push(`model did not load: ${m}`);
    for (const o of scene.odd) result.problems.push(o);
    for (const c of scene.covered) result.problems.push(`the ${c} button is covered by something else`);
    for (const o of scene.pools ?? []) result.notes.push(o);
    result.models = scene.models;
    result.visibleAtEnd = `${scene.visible} of ${scene.objects}`;
    result.audioAsked = audio.size;

    await page.screenshot({ path: path.join(SHOTS, `${id}--b.jpg`), type: 'jpeg', quality: 70 });
  } catch (e) {
    result.problems.push(`audit could not finish: ${String(e.message).split('\n')[0].slice(0, 200)}`);
    await page.screenshot({ path: path.join(SHOTS, `${id}--b.jpg`), type: 'jpeg', quality: 70 }).catch(() => {});
  }

  await page.close();
  result.problems = [...new Set(result.problems)];
  result.notes = [...new Set(result.notes)];
  return result;
}

const results = [];
const queue = [...ids];
await Promise.all(Array.from({ length: WORKERS }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  while (queue.length) {
    const id = queue.shift();
    const r = await audit(context, id);
    results.push(r);
    console.log(`${r.problems.length ? '✗' : '✓'} ${id}  (${r.steps} steps, ${r.models ?? '?'} models)${r.problems.length ? '\n    ' + r.problems.join('\n    ') : ''}`);
  }
  await context.close();
}));

await browser.close();
results.sort((a, b) => a.id.localeCompare(b.id));
const file = path.join(OUT, process.env.RESULTS ?? 'results.json');
await fs.writeFile(file, JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.problems.length);
console.log(`\n${results.length} lessons opened: ${results.length - bad.length} clean, ${bad.length} with problems. → ${file}`);
