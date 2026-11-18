/**
 * The teacher's app.
 *
 * Ten screens, one at a time, in the order a lesson happens:
 *
 *   splash → sign in → confirm → home ⇄ library
 *                                  └→ pairing → player → rest → home
 *
 * with the teacher guide reachable from Help. Each screen is a small object
 * with `html()` (what it looks like) and, where something on it changes by
 * itself, `update()` (called four times a second). Nothing is redrawn
 * wholesale while a lesson is on screen, because the lesson lives in a frame
 * inside the player and redrawing would restart it.
 *
 * The design is the Figma file "VR learning system", tablet screens T01–T20.
 */

import { icon } from './icons.js';
import { LOW_BATTERY, Room, sendEveryoneToWaiting } from './room.js';
import { LANGUAGE_NAMES, LANGUAGE_NAMES_IN, STRINGS } from './strings.js';

/** Children have watched this long: warn the teacher. */
const LONG_MS = 8 * 60 * 1000;
/** Children have watched this long: stop, whatever is on. */
const REST_AT_MS = 10 * 60 * 1000;
/** How long the rest between lessons is. */
const REST_MS = 5 * 60 * 1000;
/** The volume slider stops here; this point is the lessons' normal loudness. */
const SAFE_MAX = 80;

const params = new URLSearchParams(location.search);
/** What the tablet app put in the address, passed on to the lesson page. */
const carried = Object.fromEntries(['classroom', 'log'].filter((k) => params.has(k)).map((k) => [k, params.get(k)]));

const root = document.getElementById('app');

const state = {
  screen: 'splash',
  lang: remembered('class.lang') ?? 'en',
  centre: null,
  lessons: [],
  picked: null, // an entry of `lessons`
  room: null,
  wrong: false, // the last sign-in did not match
  typed: { id: '', password: '' },
  back: 'home', // where Close on the library or the guide returns to
  afterPick: 'home',
  play: null, // { watched, last, warned, leaving }
  rest: null, // { until, lesson, minutes, headsets }
  volume: SAFE_MAX,
};

function remembered(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function remember(key, value) {
  try { localStorage.setItem(key, value); } catch { /* a tablet that forgets asks again */ }
}

/** A line of text in the current language, with `{marks}` filled in. */
function t(key, values = {}) {
  const text = STRINGS[state.lang]?.[key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Minutes and seconds, the way a clock shows them: 3:12. */
function clock(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// A headset's number arrives over the Wi-Fi from whatever device sent it, so
// it is never trusted as markup.
const headsetName = (headset) => t('headset', { n: esc(String(headset.id).padStart(2, '0')) });
const lessonName = (lesson) => lesson?.name[state.lang] ?? lesson?.name.en ?? '';

// Every button but Sign in says `type="button"`. A button inside a form is
// otherwise a "submit" button, and the Enter key presses the first one it
// finds: Enter on the password would have switched the language instead.
function languageToggle() {
  return `<div class="lang" role="group">${Object.entries(LANGUAGE_NAMES)
    .map(([code, name]) => `<button type="button" data-action="lang" data-lang="${code}" aria-pressed="${code === state.lang}">${name}</button>`)
    .join('')}</div>`;
}

const logo = `<span class="logo">${icon('headset')}</span>`;

/* ───────────────────────────── the headset tiles ───────────────────────── */

const STATE_ICON = { ready: 'check', playing: 'play', connecting: 'link', reconnecting: 'refresh', disconnected: 'wifiOff', removed: 'eyeOff' };

function badge(kind) {
  const key = `state${kind[0].toUpperCase()}${kind.slice(1)}`;
  return `<span class="badge" data-state="${kind}">${icon(STATE_ICON[kind])}${t(key)}</span>`;
}

function battery(headset) {
  if (headset.battery === null) return '';
  return `<span class="battery"${headset.battery <= LOW_BATTERY ? ' data-low' : ''}>${icon('battery')}${headset.battery}%</span>`;
}

/** The big tiles on the pairing screen. */
function pairingTiles() {
  return state.room.headsets
    .map((headset) => {
      const kind = state.room.stateOf(headset, false);
      if (kind === 'looking') {
        return `<div class="tile" data-state="looking">${icon('search')}<span>${t('lookingFor', { headset: headsetName(headset) })}</span></div>`;
      }
      // Heard once and silent now: on this screen that is "still connecting".
      const shown = kind === 'ready' ? 'ready' : 'connecting';
      return `<div class="tile" data-state="${shown}"><span class="round">${icon('headset')}</span><b>${headsetName(headset)}</b>${badge(shown)}${battery(headset)}</div>`;
    })
    .join('');
}

/** The short rows beside the picture on the player screen. */
function playerRows(playing) {
  return state.room.headsets
    .filter((headset) => headset.seen)
    .map((headset) => {
      const kind = state.room.stateOf(headset, playing);
      return `<div class="row" data-state="${kind}">${icon('headset')}<b>${headsetName(headset)}</b>${badge(kind)}</div>`;
    })
    .join('');
}

/* ──────────────────────────────── the screens ──────────────────────────── */

const SCREENS = {
  splash: {
    html: () => `
      <div class="night">
        ${languageToggle()}
        <div class="moon"></div><div class="hill hill-a"></div><div class="hill hill-b"></div><div class="door"></div>
        <div class="splash-middle">
          <span class="logo logo-big">${icon('headset')}</span>
          <h1>${t('product')}</h1>
          <p class="programme">${esc(state.centre?.name ?? '')}</p>
          <div class="dots"><i></i><i></i><i></i></div>
        </div>
      </div>`,
  },

  signin: {
    html: () => `
      <div class="split">
        <div class="night art">
          ${logo}
          <h2>${t('tagline').replace('\n', '<br>')}</h2>
          <div class="moon sun"></div><div class="hill hill-a"></div><div class="hill hill-b"></div>
        </div>
        <form class="form" data-form="signin" novalidate>
          ${languageToggle()}
          <h1>${t('signInTitle')}</h1>
          <p class="lead">${t('signInHelp')}</p>
          ${state.wrong ? `<div class="banner" data-kind="error">${icon('wifiOff')}<div><b>${t('wrongTitle')}</b><span>${t('wrongHelp')}</span></div></div>` : ''}
          <label>${t('centreId')}
            <input name="id" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(state.typed.id)}"${state.wrong ? ' data-wrong' : ''}>
          </label>
          <label>${t('password')}
            <span class="field">
              <input name="password" type="password" autocomplete="off" placeholder="${t('passwordHint')}" value="${esc(state.typed.password)}"${state.wrong ? ' data-wrong' : ''}>
              <button type="button" class="peek" data-action="peek" aria-label="${t('password')}">${icon('eyeOff')}</button>
            </span>
          </label>
          <button class="button primary wide">${icon('chevron')}${t('signIn')}</button>
          <p class="foot">${icon('help')}${t('lostCard', { helpline: esc(state.centre.helpline) })}</p>
        </form>
      </div>`,
  },

  confirm: {
    html: () => `
      <div class="dim">
        ${languageToggle()}
        <div class="card dialog">
          <div class="house"><i></i></div>
          <h1>${t('loggedIn')}</h1>
          <p class="where">${esc(state.centre.name)}, ${esc(state.centre.village)} / ${esc(state.centre.district)}</p>
          <p class="pill">${icon('info')}${t('lessonsIn', { language: LANGUAGE_NAMES_IN[state.lang][state.centre.lang] ?? state.centre.lang })}</p>
          <button type="button" class="button primary wide" data-action="confirmed">${icon('check')}${t('okContinue')}</button>
        </div>
      </div>`,
  },

  home: {
    html: () => `
      <header class="bar">
        ${logo}
        <div class="title"><b>${esc(state.centre.name)}</b><small>${esc(state.centre.village)} · ${esc(state.centre.district)} · ${LANGUAGE_NAMES_IN[state.lang][state.lang]}</small></div>
        <button type="button" class="link" data-action="guide">${icon('help')}${t('help')}</button>
        <button type="button" class="button" data-action="library">${icon('grid')}${t(state.picked ? 'changeLesson' : 'chooseLesson')}</button>
        ${languageToggle()}
      </header>
      <main class="home">
        ${state.picked
          ? `<div class="lesson picked"><img src="${state.picked.picture}" alt=""><span class="tick">${icon('check')}</span>
               <div class="caption"><b>${esc(lessonName(state.picked))}</b><span>${icon('clock')}${t('minutes', { n: state.picked.minutes })}</span></div></div>
             <p class="ready-line">${t('readyToShow', { lesson: esc(lessonName(state.picked)) })}</p>`
          : `<div class="empty-slot"><div class="easel"></div><b>${t('noLesson')}</b><span>${t('noLessonHint')}</span></div>`}
        <button type="button" class="button primary big" data-action="pair">${icon('headset')}${t('startPairing')}</button>
        <p class="pill">${icon('info')}${t(state.picked ? 'switchOn' : 'pairFirst')}</p>
      </main>`,
  },

  library: {
    html: () => `
      <header class="bar">
        <div class="title"><b>${t('libraryTitle')}</b><small>${t('libraryHint')}</small></div>
        <button type="button" class="button" data-action="close">${icon('close')}${t('close')}</button>
        ${languageToggle()}
      </header>
      <main class="library">
        ${state.lessons
          .map((lesson) => `
            <button type="button" class="lesson${lesson === state.picked ? ' picked' : ''}" data-action="pick" data-lesson="${lesson.lesson}"${lesson.locked ? ' disabled' : ''}>
              <img src="${lesson.picture}" alt="" loading="lazy">
              ${lesson === state.picked ? `<span class="tick">${icon('check')}</span>` : ''}
              ${lesson.locked ? `<span class="tag">${t('needsSignOff')}</span>` : ''}
              <div class="caption"><b>${esc(lessonName(lesson))}</b><span>${icon('clock')}${t('minutes', { n: lesson.minutes })}</span></div>
            </button>`)
          .join('')}
      </main>`,
  },

  pairing: {
    html: () => `
      <header class="bar">
        <div class="title"><b>${t('pairingTitle')}</b><small>${esc(state.centre.name)} · ${state.picked ? t('lessonLine', { lesson: esc(lessonName(state.picked)) }) : t('noLessonLine')}</small></div>
        <span class="count" id="count"></span>
        <button type="button" class="button primary" data-action="paired" id="paired"></button>
        ${languageToggle()}
      </header>
      <main class="pairing">
        <div class="banner" id="pair-banner"></div>
        <div class="tiles" id="tiles"></div>
      </main>`,
    update() {
      const { room } = state;
      room.forgetLost();
      const ready = room.readyCount;
      const all = room.expectedCount;
      document.getElementById('count').innerHTML = `${icon('headset')}${t('readyCount', { ready, all })}`;

      const button = document.getElementById('paired');
      button.disabled = ready === 0;
      button.innerHTML = ready === 0
        ? `${icon('check')}${t('done')}`
        : ready < all ? `${icon('check')}${t('startWith', { n: ready })}` : `${icon('play')}${t('startWithAll', { n: ready })}`;

      const banner = document.getElementById('pair-banner');
      banner.dataset.kind = ready === 0 ? 'info' : 'good';
      banner.innerHTML = ready === 0
        ? `${icon('search')}<div><b>${t('searching')}</b></div>`
        : `${icon('check')}<div><b>${ready < all ? t('someReady', { ready, missing: all - ready }) : t('allReady', { ready })}</b></div>`;

      document.getElementById('tiles').innerHTML = pairingTiles();
    },
  },

  player: {
    html: () => `
      <header class="bar">
        <div class="title"><b>${esc(lessonName(state.picked))}</b><small>${esc(state.centre.name)}</small></div>
        <span class="chip" id="lesson-time"></span>
        <span class="grow"></span>
        <button type="button" class="button danger" data-action="stop">${icon('stop')}${t('stopAll')}</button>
        ${languageToggle()}
      </header>
      <main class="player">
        <section class="watch">
          <div class="banner" id="play-banner" hidden></div>
          <div class="stage">
            <iframe id="lesson" title="${esc(lessonName(state.picked))}" src="${lessonAddress()}"></iframe>
            <img id="poster" src="${state.picked.picture}" alt="">
            <span class="label" id="label"></span>
          </div>
          <div class="progress"><i id="bar"></i><b id="knob"></b></div>
          <div class="times"><span id="at">0:00</span><span id="total"></span></div>
          <div class="controls">
            <button type="button" class="button" data-action="seek" data-by="-10000">${icon('back')}${t('seconds', { n: 10 })}</button>
            <button type="button" class="button primary big" data-action="toggle" id="toggle"></button>
            <button type="button" class="button" data-action="seek" data-by="10000">${icon('forward')}${t('seconds', { n: 10 })}</button>
          </div>
          <label class="volume">${icon('volume')}<b>${t('volume')}</b>
            <input type="range" id="volume" min="0" max="100" value="${state.volume}">
            <span>${t('safeMax')}</span>
          </label>
        </section>
        <aside class="room">
          <span class="count" id="count"></span>
          <div id="rows"></div>
        </aside>
      </main>
      <div class="dim" id="long" hidden>
        <div class="card dialog">
          <div class="hourglass"></div>
          <h1>${t('longTitle')}</h1>
          <p class="lead">${t('longHelp', { n: LONG_MS / 60000, max: REST_AT_MS / 60000 })}</p>
          <div class="pair">
            <button type="button" class="button" data-action="let-finish">${icon('play')}${t('letFinish')}</button>
            <button type="button" class="button danger" data-action="stop">${icon('stop')}${t('stopNow')}</button>
          </div>
        </div>
      </div>`,
    update() {
      const play = state.play;
      const info = teacher()?.info();
      const now = Date.now();
      const playing = Boolean(info?.started && !info.paused && !info.over);
      if (playing) play.watched += now - play.last;
      play.last = now;

      // Finished, or stopped: the headsets are back on their waiting screens.
      // A moment's grace before the frame is thrown away, so the message that
      // says so has left the tablet.
      if (info?.over && !play.leaving) {
        play.leaving = true;
        setTimeout(() => startRest(info.total), 400);
      }
      if (playing && play.watched >= REST_AT_MS) teacher().stop();
      if (playing && play.watched >= LONG_MS && !play.warned) {
        play.warned = true;
        document.getElementById('long').hidden = false;
      }

      const chip = document.getElementById('lesson-time');
      chip.innerHTML = `${icon('clock')}${t('lessonTime', { time: clock(play.watched), rest: clock(REST_AT_MS) })}`;
      chip.toggleAttribute('data-long', play.watched >= LONG_MS);

      const total = info?.total ?? state.picked.ms;
      const at = info?.position ?? 0;
      const fraction = total ? Math.min(at / total, 1) : 0;
      document.getElementById('bar').style.width = `${fraction * 100}%`;
      document.getElementById('knob').style.left = `${fraction * 100}%`;
      document.getElementById('at').textContent = clock(at);
      document.getElementById('total').textContent = clock(total);

      const toggle = document.getElementById('toggle');
      toggle.disabled = !info || info.over;
      toggle.innerHTML = playing
        ? `${icon('pause')}${t('pauseAll')}`
        : `${icon('play')}${t(info?.started ? 'resumeAll' : 'playAll')}`;
      for (const button of document.querySelectorAll('[data-action="seek"]')) button.disabled = !info?.started || info.over;

      // The still picture until the lesson is really on; then the lesson
      // itself, drawn live, exactly as the children see it.
      document.getElementById('poster').hidden = Boolean(info?.started);

      const headsets = state.room.headsets.filter((h) => h.seen);
      const kinds = headsets.map((h) => state.room.stateOf(h, playing));
      const on = kinds.filter((k) => k === (playing ? 'playing' : 'ready')).length;
      const paused = Boolean(info?.started && info.paused);
      document.getElementById('count').innerHTML =
        `${icon('headset')}${t(playing ? 'countPlaying' : paused ? 'countPaused' : 'countReady', { ready: on, all: headsets.length })}`;
      document.getElementById('rows').innerHTML = playerRows(playing);

      document.getElementById('label').innerHTML = !info?.started
        ? `${icon('pause')}${t('posterReady')}`
        : paused ? `${icon('pause')}${t('posterPaused', { time: clock(at) })}`
        : `${icon('play')}${on === headsets.length ? t('posterPlaying') : t('posterPlayingSome', { n: on })}`;

      // One banner at a time, the most urgent first.
      const lost = headsets[kinds.indexOf('disconnected')];
      const removed = headsets[kinds.indexOf('removed')];
      const banner = document.getElementById('play-banner');
      banner.hidden = !(lost || removed || paused);
      if (lost) {
        banner.dataset.kind = 'error';
        banner.innerHTML = `${icon('wifiOff')}<div><b>${t('lostTitle', { headset: headsetName(lost) })}</b><span>${t('lostHelp')}</span></div>`;
      } else if (removed) {
        banner.dataset.kind = 'warn';
        banner.innerHTML = `${icon('alert')}<div><b>${t('removedTitle', { headset: headsetName(removed) })}</b><span>${t('removedHelp')}</span></div>`;
      } else if (paused) {
        banner.dataset.kind = 'info';
        banner.innerHTML = `${icon('info')}<div><b>${t('pausedTitle', { n: on, time: clock(at) })}</b><span>${t('pausedHelp')}</span></div>`;
      }

      const slider = document.getElementById('volume');
      slider.style.setProperty('--fill', `${slider.value}%`);
    },
  },

  rest: {
    html: () => `
      <div class="split">
        <div class="night art">
          <div class="moon"></div><div class="hill hill-a"></div><div class="hill hill-b"></div>
          <h2>${t('finishedTitle')}</h2>
          <p>${t('finishedLine', { lesson: esc(state.rest.lesson), minutes: t('minutes', { n: state.rest.minutes }), n: state.rest.headsets })}</p>
          <p class="pill dark">${icon('headset')}${t('backWaiting')}</p>
        </div>
        <div class="form rest">
          ${languageToggle()}
          <div class="ring" id="ring"><b id="left"></b></div>
          <h3>${t('restTime')}</h3>
          <p class="lead">${t('restHelp')}</p>
          <button type="button" class="button primary wide" data-action="library" id="next"></button>
          <button type="button" class="button wide" data-action="home">${icon('chevron')}${t('goHome')}</button>
          <button type="button" class="link" data-action="skip">${icon('chevron')}${t('skipRest')}</button>
        </div>
      </div>`,
    update() {
      const left = Math.max(0, state.rest.until - Date.now());
      document.getElementById('left').textContent = clock(left);
      document.getElementById('ring').style.setProperty('--left', left / REST_MS);
      const next = document.getElementById('next');
      next.disabled = left > 0;
      next.innerHTML = left > 0 ? `${icon('lock')}${t('nextIn', { time: clock(left) })}` : `${icon('chevron')}${t('nextLesson')}`;
    },
  },

  guide: {
    html: () => `
      <header class="bar">
        <div class="title"><b>${t('guideTitle')}</b><small>${t('guideHint')}</small></div>
        <button type="button" class="button" data-action="close">${icon('close')}${t('close')}</button>
        ${languageToggle()}
      </header>
      <main class="guide">
        ${[['headset', 'sky'], ['clock', 'peach'], ['check', 'mint'], ['alert', 'pink']]
          .map(([name, colour], i) => `
            <div class="card tip"><span class="picture" data-colour="${colour}">${icon(name)}</span>
              <div><b>${t(`guide${i + 1}Title`)}</b><p>${t(`guide${i + 1}Text`)}</p></div></div>`)
          .join('')}
      </main>`,
  },
};

/* ─────────────────────────── moving between screens ────────────────────── */

function show(screen) {
  state.screen = screen;
  root.dataset.screen = screen;
  root.innerHTML = SCREENS[screen].html();
  SCREENS[screen].update?.();
}

setInterval(() => SCREENS[state.screen].update?.(), 250);

/** The lesson page inside the player's frame, or nothing while it loads. */
function teacher() {
  return document.getElementById('lesson')?.contentWindow?.teacher ?? null;
}

/**
 * The address of the lesson page for the frame: this lesson, as the teacher,
 * with our own buttons instead of its bar, and waiting for Play.
 */
function lessonAddress() {
  const query = new URLSearchParams({ lesson: state.picked.lesson, role: 'teacher', lang: state.lang, ...carried });
  return `./?${query}&framed&hold`;
}

function startPlayer() {
  state.play = { watched: 0, last: Date.now(), warned: false, leaving: false };
  show('player');
}

function startRest(lessonMs) {
  state.rest = {
    until: Date.now() + REST_MS,
    lesson: lessonName(state.picked),
    minutes: Math.max(1, Math.round((state.play?.watched ?? lessonMs) / 60000)),
    headsets: state.room.readyCount,
  };
  state.play = null;
  show('rest');
}

const ACTIONS = {
  lang({ lang }) {
    state.lang = lang;
    remember('class.lang', lang);
    // The player is never redrawn whole: that would restart the lesson.
    if (state.screen === 'player') {
      for (const b of document.querySelectorAll('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
      SCREENS.player.update();
    } else {
      show(state.screen);
    }
  },
  peek(_, button) {
    const input = button.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.innerHTML = icon(input.type === 'password' ? 'eyeOff' : 'eye');
  },
  confirmed() {
    remember('class.centre', state.centre.id);
    show('home');
  },
  guide() {
    state.back = state.screen;
    show('guide');
  },
  library() {
    state.back = state.screen === 'rest' ? 'home' : state.screen;
    state.afterPick = 'home';
    show('library');
  },
  close: () => show(state.back),
  home: () => show('home'),
  skip: () => show('home'),
  pick({ lesson }) {
    state.picked = state.lessons.find((l) => l.lesson === lesson) ?? state.picked;
    remember('class.lesson', state.picked.lesson);
    if (state.afterPick === 'player') startPlayer();
    else show('home');
  },
  pair: () => show('pairing'),
  paired() {
    if (state.picked) return startPlayer();
    // Paired first, lesson after: choosing one starts it.
    state.back = 'pairing';
    state.afterPick = 'player';
    show('library');
  },
  toggle() {
    const lesson = teacher();
    const info = lesson?.info();
    if (!info) return;
    if (info.started && !info.paused) return lesson.pause();
    lesson.setVolume(state.volume / SAFE_MAX);
    lesson.play();
  },
  seek: ({ by }) => teacher()?.seek(Number(by)),
  stop() {
    const lesson = teacher();
    // Never started: no headset left its waiting screen, so there is nothing
    // to stop and no rest to take.
    if (!lesson?.info().started) return show('home');
    lesson.stop();
  },
  'let-finish'() {
    document.getElementById('long').hidden = true;
  },
};

root.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  ACTIONS[target.dataset.action]?.(target.dataset, target);
  SCREENS[state.screen].update?.();
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  state.typed = { id: String(form.get('id')).trim(), password: String(form.get('password')) };
  // Both are checked together and neither is named as the wrong one, so the
  // screen never says which centre IDs exist.
  state.wrong = state.typed.id !== state.centre.id || state.typed.password !== state.centre.password;
  if (state.wrong) return show('signin');
  state.typed.password = '';
  state.lang = state.centre.lang;
  remember('class.lang', state.lang);
  show('confirm');
});

root.addEventListener('input', (event) => {
  if (event.target.id !== 'volume') return;
  // The slider is drawn to 100 so the teacher can see where the limit is,
  // and it will not go past it.
  if (Number(event.target.value) > SAFE_MAX) event.target.value = SAFE_MAX;
  state.volume = Number(event.target.value);
  teacher()?.setVolume(state.volume / SAFE_MAX);
});

/* ─────────────────────────────── starting up ───────────────────────────── */

async function json(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

/**
 * Every lesson a teacher can choose: one per land, with its picture and how
 * long it runs. The length is added up from the lesson's own steps, so it is
 * never a number somebody has to remember to update.
 */
async function loadLessons() {
  const [{ lands }, { lessons: index }] = await Promise.all([json('lands.json'), json('lessons/index.json')]);
  const usable = lands.filter((land) => land.group !== 'unused' && index[land.lesson]);
  return Promise.all(
    usable.map(async (land) => {
      const lesson = await json(`lessons/${index[land.lesson]}`);
      const ms = lesson.steps.reduce((sum, step) => sum + (step.duration ?? 0), 0);
      return {
        lesson: land.lesson,
        name: land.name,
        picture: `assets/lands/${land.id}.jpg`,
        ms,
        minutes: Math.max(1, Math.round(ms / 60000)),
        locked: land.review === true,
      };
    })
  );
}

async function start() {
  state.centre = await json('centre.json');
  show('splash');
  if (carried.classroom) sendEveryoneToWaiting(carried.classroom, state.lang);

  const [lessons] = await Promise.all([loadLessons(), new Promise((resolve) => setTimeout(resolve, 1600))]);
  state.lessons = lessons;
  state.picked = lessons.find((l) => l.lesson === remembered('class.lesson') && !l.locked) ?? null;
  state.room = new Room({ expected: state.centre.headsets, classroom: carried.classroom ?? null, demo: params.has('demo') });

  // Signed in once is signed in for good, on this tablet.
  show(remembered('class.centre') === state.centre.id ? 'home' : 'signin');
}

start().catch((error) => {
  root.innerHTML = `<p class="fatal">${esc(error.message)}</p>`;
  console.error(error);
});
