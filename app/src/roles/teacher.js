/**
 * The teacher role.
 *
 * Owns the one clock in the room and is the only client that publishes state.
 * It also renders the lesson itself, flat, on the tablet — the same scene
 * graph the children are standing inside, drawn to a rectangle instead of to
 * two eye buffers. No video is streamed anywhere; the tablet simply draws it
 * too.
 */

import { LessonSync } from '../components/lesson-sync.js';
import { Clock } from '../core/clock.js';
import { loadLesson } from '../core/lesson-loader.js';
import { Session } from '../core/session.js';
import { TOPIC } from '../core/transport.js';
import { ControlBar } from '../ui/control-bar.js';

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

  const { lesson } = await loadLesson(lessonId);

  let paused = false;
  const clock = new Clock(() => next());

  const bar = new ControlBar(controlsRoot, {
    onBack: () => go(session.step - 1),
    onNext: () => next(),
    onPause: () => togglePause(),
    onBlackout: () => transport.publish(TOPIC.command, { cmd: 'blackout' }),
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

  session.lesson = lesson.id;
  go(0);

  return { sync, next, go, togglePause };
}
