/**
 * The playground behind the school.
 *
 * Of everything in this project this is the part the children already know.
 * A three-year-old does not need to be told what a slide is, which makes it
 * the best place in the whole system to teach a word — the object is already
 * understood and only the name is new.
 *
 * Everything here is boxes, and everything that should move, moves. A still
 * swing is a frame with a plank hanging off it; a swinging one is a swing.
 * That difference is worth two components' worth of code.
 */

import { builder } from './built.js';
import { builtMaterial, mergeBoxes } from './merge-boxes.js';

/**
 * A swing frame with two seats, both swinging.
 *
 * The seats hang off pivot entities marked `data-keep`, for the same reason
 * the door leaves do: a baked box cannot move again. Each swings on its own
 * phase, because two seats moving in lockstep look mechanical rather than
 * played on.
 */
AFRAME.registerComponent('swing', {
  schema: {
    width: { type: 'number', default: 3.2 },
    height: { type: 'number', default: 2.3 },
    seats: { type: 'number', default: 2 },

    /** How far each seat swings from vertical, in degrees. */
    sway: { type: 'number', default: 16 },

    frame: { type: 'color', default: '#2f6fb0' },
    seat: { type: 'color', default: '#d4402f' },
    rope: { type: 'color', default: '#5f5548' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';
    this.pivots = [];

    const { width, height, seats, frame, seat, rope } = this.data;
    const spread = height * 0.55;

    // Two A-frames and a beam across the top. The legs splay, which is what
    // stops it reading as a doorway.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = this.block(0.1, height, 0.1, sx * width / 2, height / 2, sz * spread / 2, frame);
        leg.setAttribute('rotation', `${-sz * 14} 0 0`);
      }
    }
    this.block(width + 0.2, 0.12, 0.12, 0, height, 0, frame);

    const ropeLength = height - 0.55;

    for (let i = 0; i < seats; i += 1) {
      const at = seats === 1 ? 0 : -width * 0.25 + (i * width * 0.5) / (seats - 1);

      const pivot = document.createElement('a-entity');
      pivot.dataset.keep = '';
      pivot.setAttribute('position', `${at} ${height} 0`);
      this.el.appendChild(pivot);

      const body = document.createElement('a-entity');
      pivot.appendChild(body);

      for (const sx of [-1, 1]) {
        this.block(0.03, ropeLength, 0.03, sx * 0.19, -ropeLength / 2, 0, rope, body);
      }
      this.block(0.5, 0.05, 0.24, 0, -ropeLength, 0, seat, body);

      // A quarter cycle apart, so the two never line up.
      this.pivots.push({ el: pivot, phase: i * Math.PI * 0.6 });
    }

    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      mergeBoxes(this.el, builtMaterial());
      for (const { el } of this.pivots) mergeBoxes(el.firstElementChild, builtMaterial());
    });
  },

  tick(time) {
    if (!this.pivots) return;

    for (const { el, phase } of this.pivots) {
      const angle = Math.sin(time / 900 + phase) * this.data.sway;
      el.object3D.rotation.x = THREE.MathUtils.degToRad(angle);
    }
  },
});

/** A slide: ladder, platform, and the chute down. */
AFRAME.registerComponent('slide', {
  schema: {
    height: { type: 'number', default: 1.8 },
    length: { type: 'number', default: 3.2 },

    frame: { type: 'color', default: '#3f9e5c' },
    chute: { type: 'color', default: '#f0a92b' },
    rail: { type: 'color', default: '#d4402f' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { height, length, frame, chute, rail } = this.data;

    // Platform at the top, on four legs.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.block(0.09, height, 0.09, sx * 0.36, height / 2, -length / 2 + sz * 0.3 + 0.3, frame);
      }
    }
    this.block(0.9, 0.07, 0.9, 0, height, -length / 2 + 0.3, chute);

    // Ladder behind it.
    for (const sx of [-1, 1]) {
      this.block(0.07, height + 0.5, 0.07, sx * 0.34, (height + 0.5) / 2, -length / 2 - 0.35, rail);
    }
    const rungs = Math.max(3, Math.round(height / 0.3));
    for (let i = 1; i <= rungs; i += 1) {
      this.block(0.7, 0.05, 0.05, 0, (height / (rungs + 1)) * i, -length / 2 - 0.35, rail);
    }

    // The chute, placed by its two ends rather than by a guessed centre.
    //
    // Sizing it from the height and then rotating it left the bottom end
    // twenty centimetres above the grass — a slide you fall off. Working out
    // where it starts and where it lands, and putting the slab between them,
    // cannot go wrong that way.
    const top = { y: height - 0.03, z: -length / 2 + 0.3 };
    const foot = { y: 0.06, z: top.z + (length - 0.6) };

    const rise = top.y - foot.y;
    const run = foot.z - top.z;
    const bed = Math.hypot(run, rise);
    const slope = -THREE.MathUtils.radToDeg(Math.atan2(rise, run));

    const midY = (top.y + foot.y) / 2;
    const midZ = (top.z + foot.z) / 2;

    const deck = this.block(0.8, 0.06, bed, 0, midY, midZ, chute);
    deck.setAttribute('rotation', `${slope} 0 0`);

    // A rail each side. Without them it is a ramp, and a ramp is not a slide.
    for (const sx of [-1, 1]) {
      const side = this.block(0.06, 0.24, bed, sx * 0.43, midY + 0.1, midZ, rail);
      side.setAttribute('rotation', `${slope} 0 0`);
    }

    this.bake();
  },
});

/** A see-saw, tipped and rocking. */
AFRAME.registerComponent('seesaw', {
  schema: {
    length: { type: 'number', default: 3.0 },
    pivotHeight: { type: 'number', default: 0.55 },
    tilt: { type: 'number', default: 11 },

    frame: { type: 'color', default: '#8e4fa8' },
    plank: { type: 'color', default: '#f0a92b' },
    seat: { type: 'color', default: '#2f6fb0' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { length, pivotHeight, frame, plank, seat } = this.data;

    // The trestle it rocks on.
    for (const sx of [-1, 1]) {
      const leg = this.block(0.1, pivotHeight, 0.1, sx * 0.22, pivotHeight / 2, 0, frame);
      leg.setAttribute('rotation', `0 0 ${-sx * 12}`);
    }
    this.block(0.12, 0.12, 0.4, 0, pivotHeight, 0, frame);

    const pivot = document.createElement('a-entity');
    pivot.dataset.keep = '';
    pivot.setAttribute('position', `0 ${pivotHeight + 0.09} 0`);
    this.el.appendChild(pivot);

    const body = document.createElement('a-entity');
    pivot.appendChild(body);

    this.block(length, 0.07, 0.26, 0, 0, 0, plank, body);
    for (const sx of [-1, 1]) {
      this.block(0.3, 0.05, 0.28, sx * (length / 2 - 0.25), 0.06, 0, seat, body);
      // A handle to hold, which is the part a child looks for.
      this.block(0.05, 0.22, 0.05, sx * (length / 2 - 0.6), 0.14, 0, frame, body);
    }

    this.pivot = pivot;

    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      mergeBoxes(this.el, builtMaterial());
      mergeBoxes(body, builtMaterial());
    });
  },

  tick(time) {
    if (!this.pivot) return;
    // Slower than the swing. A see-saw with nobody on it should barely move.
    const angle = Math.sin(time / 1400) * this.data.tilt;
    this.pivot.object3D.rotation.z = THREE.MathUtils.degToRad(angle);
  },
});

/** A sand pit: a low kerb of sleepers with sand inside. */
AFRAME.registerComponent('sandpit', {
  schema: {
    width: { type: 'number', default: 4 },
    depth: { type: 'number', default: 3 },

    kerb: { type: 'color', default: '#8a6a45' },
    sand: { type: 'color', default: '#d9c9a3' },
  },

  ...builder,

  build() {
    this.el.innerHTML = '';

    const { width, depth, kerb, sand } = this.data;
    const t = 0.22;

    this.block(width, 0.06, depth, 0, 0.03, 0, sand);

    for (const sz of [-1, 1]) {
      this.block(width + t * 2, 0.26, t, 0, 0.13, sz * (depth / 2 + t / 2), kerb);
    }
    for (const sx of [-1, 1]) {
      this.block(t, 0.26, depth, sx * (width / 2 + t / 2), 0.13, 0, kerb);
    }

    this.bake();
  },
});
