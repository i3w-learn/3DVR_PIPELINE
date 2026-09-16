/**
 * Taking the lockstep out of idle animation.
 *
 * Every animal in a lesson plays the same Idle clip from the same baked file,
 * and if they all start it at the same instant they breathe together, blink
 * together and shift weight together. Nothing else in the scene says
 * "computer" as loudly — a field of animals moving in perfect unison is
 * something no child has ever seen.
 *
 * Two lines fix it. Start each animal at a random point in the clip, and let
 * each run at a slightly different speed so they drift apart instead of
 * re-syncing. Both are free: the same clip, the same mixer, the same cost.
 */

AFRAME.registerComponent('natural-idle', {
  schema: {
    /** How much the playback rate may vary either side of normal. */
    variance: { type: 'number', default: 0.14 },
  },

  init() {
    this.apply = this.apply.bind(this);
    this.el.addEventListener('model-loaded', this.apply);
    this.apply();
  },

  apply() {
    const mixer = this.el.components['animation-mixer']?.mixer;
    if (!mixer) return;

    const action = mixer._actions?.[0];
    if (!action) return;

    // A small nudge either side of whatever speed the lesson asked for — not
    // a speed of its own. How fast a hen pecks is a content decision made by
    // someone watching it; this only stops six animals sharing one metronome.
    action.timeScale *= 1 + (Math.random() * 2 - 1) * this.data.variance;

    // Anywhere in the clip. Without this every animal is on the same frame.
    const duration = action.getClip().duration;
    if (duration > 0) action.time = Math.random() * duration;
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.apply);
  },
});
