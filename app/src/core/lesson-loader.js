/**
 * Turning a lesson id into something a template can build.
 *
 * A lesson names a stage kit; the kit holds the land and the reused props.
 * Merging them here means a template receives one finished description and
 * never has to know that two files were involved.
 *
 * No A-Frame, no DOM — this is fetch and object maths, and it is the same on
 * the tablet and in the headset.
 */

const cache = new Map();

/**
 * @param {string} lessonId
 * @returns {Promise<{lesson: object, stage: object}>}
 */
export async function loadLesson(lessonId) {
  if (cache.has(lessonId)) return cache.get(lessonId);

  const lesson = await fetchJson(`lessons/${lessonId}.json`);
  const kit = await fetchJson(`stages/${lesson.stage}.json`);

  const resolved = { lesson, stage: resolveStage(kit, lesson.stageOverride) };
  cache.set(lessonId, resolved);

  return resolved;
}

/**
 * Kit merged with the lesson's overrides.
 *
 * Props are never overridable. A lesson dresses a kit — different ground, a
 * different sky — it does not replace the kit's furniture. Letting it would
 * mean every lesson could quietly reintroduce the draw-call problem that
 * having only two kits exists to prevent.
 */
export function resolveStage(kit, override = {}) {
  const { props: _rejected, ...safe } = override;
  return { ...kit, ...safe, props: kit.props ?? [] };
}

async function fetchJson(path) {
  // `no-cache` revalidates rather than trusting the browser's copy.
  //
  // Without it, editing a lesson and reloading shows the old one — the file on
  // disk and the scene disagree, and the author chases a bug that is not
  // there. Offline this changes nothing: the service worker answers first, and
  // a revalidation with no network simply falls back to what it holds.
  const response = await fetch(path, { cache: 'no-cache' });

  if (!response.ok) {
    // Almost always one of two things: a typo the validator would have caught,
    // or the page was opened from file:// instead of over HTTP.
    throw new Error(`Could not load ${path} (${response.status}). Serve over HTTP, not file://`);
  }

  return response.json();
}
