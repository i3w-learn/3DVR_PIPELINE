/**
 * The page's console, sent to the app that opened it.
 *
 * Inside a VR browser on a headset there is no console anyone can read, and
 * no way to plug a laptop into the page. But the page came from the app's own
 * server on the same device, and that server has one extra door, `/log`:
 * whatever is posted there is written to the app's log, which `adb logcat -s
 * Lesson` shows on a laptop. So every console line, and every error, is
 * copied there as well.
 *
 * Only when the app asks (`?log=app`). On a laptop the page's console is
 * right there, and the dev server has no `/log`.
 */

/** Sends one line, in order, without waiting. Failure is ignored: it is a log. */
function send(line) {
  try {
    fetch('/log', { method: 'POST', body: line, keepalive: true }).catch(() => {});
  } catch {
    // Nothing to do: a page that cannot log is still a page.
  }
}

function text(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

export function logToApp() {
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      send(`${level === 'log' ? '' : `${level}: `}${text(args)}`);
    };
  }

  window.addEventListener('error', (event) => {
    send(`error: ${event.message} (${event.filename}:${event.lineno})`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    send(`error: unhandled ${text([event.reason])}`);
  });

  send(`page: ${location.href}`);
}
