/**
 * The teacher role.
 *
 * Owns the one clock in the room and is the only client that publishes state.
 * It also renders the lesson itself, flat, on the tablet — the same scene
 * graph the children are standing inside, drawn to a rectangle instead of to
 * two eye buffers. No video is streamed anywhere; the tablet simply draws it
 * too.
 */

import { LessonSync } from '../lesson-sync.js';
import { Clock } from '../core/clock.js';
import { loadLesson } from '../core/lesson-loader.js';
import { Session } from '../core/session.js';
import { TOPIC } from '../core/transport.js';
import { ControlBar } from '../ui/control-bar.js';

/** The lesson that is the menu of lands. */
const LOBBY = 'lobby';

function showError(error) {
  document.querySelector('#error').textContent = error.message;
}

/**
 * The way back to the lobby from inside a land: a small card low on the
 * child's left, on the rig so it stays put while the teacher walks. Looking
 * at it fuses, exactly like looking at a land in the lobby.
 */
function homeTile(elements) {
  let tile = document.querySelector('#home-tile');
  if (tile) return tile;
  tile = document.createElement('a-entity');
  tile.setAttribute('id', 'home-tile');
  tile.setAttribute('position', '-0.6 -0.42 -0.95');
  tile.setAttribute('rotation', '22 28 0');
  const face = document.createElement('a-entity');
  face.classList.add('clickable');
  face.setAttribute('glyph', { char: 'Lands', height: 0.09, card: '#ffe14d' });
  face.addEventListener('click', () => elements.scene.emit('land-pick', { lesson: LOBBY }, false));
  tile.appendChild(face);
  document.querySelector('#rig').appendChild(tile);
  return tile;
}

export async function startTeacher({ transport, session, elements, controlsRoot, lessonId }) {
  // Two sessions, deliberately.
  //
  // `session` is the publisher: it owns the sequence number and decides where
  // the class goes. The renderer below gets its own, because on the tablet the
  // scene is a SUBSCRIBER like any headset — it learns where the class is by
  // receiving the message, not by having sent it.
  //
  // Sharing one object here looks tidier and silently breaks: the publisher
  // increments seq, then its own subscriber sees a message whose seq is not
  // greater than what it already holds, discards it as a straggler, and the
  // scene never builds.
  const renderSession = new Session({ lang: session.lang });

  // The teacher renders the lesson the same way a headset does. Same sync, same
  // template, same models — only the role differs.
  const sync = new LessonSync({ transport, session: renderSession, elements });
  sync.start();

  let { lesson } = await loadLesson(lessonId);

  let paused = false;
  const clock = new Clock(() => next());

  const bar = new ControlBar(controlsRoot, {
    onBack: () => go(session.step - 1),
    onNext: () => next(),
    onPause: () => togglePause(),
    onBlackout: () => transport.publish(TOPIC.command, { cmd: 'blackout' }),
    onLands: () => enter(LOBBY).catch(showError),
  });

  /** Publish where the class now is, then start that step's countdown. */
  function go(stepIndex) {
    const clamped = Math.max(0, Math.min(stepIndex, lesson.steps.length - 1));
    const message = { ...session.advance(clamped), lesson: lesson.id };

    // Retained, so a headset that reboots mid-lesson is handed the current
    // step the moment it subscribes.
    transport.publish(TOPIC.state, message, { retain: true, qos: 1 });

    render();

    // A teacher who paused stays paused across a manual Back or Next; the
    // countdown should not restart itself underneath them.
    if (!paused) clock.start(lesson.steps[clamped].duration);
  }

  function next() {
    const last = session.step >= lesson.steps.length - 1;
    if (last) return clock.stop();
    go(session.step + 1);
  }

  function togglePause() {
    paused = !paused;
    if (paused) clock.pause();
    else clock.resume();
    bar.setPaused(paused);
  }

  function render() {
    bar.update({
      script: lesson.steps[session.step]?.script,
      lang: session.lang,
      step: session.step,
      total: lesson.steps.length,
    });
  }

  /**
   * Move the class into another land.
   *
   * The teacher walked through a door. Everything else follows from the state
   * message already being "everybody is now on this step of this lesson" — a
   * different lesson id in the same message is a different land, and every
   * headset rebuilds without a word of new protocol.
   */
  async function enter(nextLessonId) {
    if (nextLessonId === lesson.id) return;

    // Loaded before anything is published. Publishing first and failing to
    // load would leave the class staring at a lesson that does not exist.
    const loaded = await loadLesson(nextLessonId);

    lesson = loaded.lesson;
    session.lesson = lesson.id;

    // The way home is not shown while you are home.
    homeTile(elements).setAttribute('visible', lesson.id !== LOBBY);

    // The URL is deliberately left alone.
    //
    // It was briefly rewritten as you walked, so that a refresh put you back
    // where you were standing. That is wrong for a classroom: refresh is how a
    // teacher starts over, and starting over means the front of the school,
    // not the middle of a corridor she happened to be in. The lesson in the
    // address bar is where the session BEGINS, and walking through a door does
    // not change where it begins.
    go(0);
  }

  // A portal is a spot on the floor; only the teacher's camera can reach one,
  // because only she walks.
  elements.scene.addEventListener('portal-enter', (event) => {
    enter(event.detail.to).catch(showError);
  });

  // A card in the lobby, or the small home tile inside a land. Same door as a
  // portal: the class goes where the teacher's finger went.
  elements.scene.addEventListener('land-pick', (event) => {
    enter(event.detail.lesson).catch(showError);
  });

  homeTile(elements).setAttribute('visible', lesson.id !== LOBBY);

  session.lesson = lesson.id;
  go(0);

  return { sync, next, go, togglePause, enter };
}
