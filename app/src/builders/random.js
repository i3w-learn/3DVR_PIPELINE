/**
 * Randomness that comes out the same every time.
 *
 * A scattered forest wants random positions, and `Math.random()` gives a
 * different forest on every load — which means the teacher's tablet and each
 * child's headset are standing in different places while the teacher says
 * "look at the tall tree on the left". Every device must build the same land.
 *
 * So scatter is seeded: same seed, same forest, on every device, forever.
 */
export function seeded(seed = 1) {
  let s = (seed >>> 0) || 1;

  return () => {
    // A linear congruential generator. Not good randomness; good enough to
    // place trees, and four lines long.
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
