/**
 * A door that opens.
 *
 * The school had a doorway — a flat brown rectangle painted on the wall, with
 * solid building behind it. From the steps it read as a cupboard, and a child
 * walking up to it walked into plaster. A school you cannot go into is a
 * facade, and the whole point of arriving at the gate is that you are about to
 * be let in.
 *
 * So this is a real one: a frame, two panelled leaves hung on hinges at the
 * outer edges, and handles where they meet. It swings inward, away from the
 * veranda pillars — a leaf that opens outward would sweep through them.
 *
 * ## Why the leaves are their own entities
 *
 * Everything else built from boxes is baked into a single mesh, because draw
 * calls are what a mobile GPU runs out of first. A baked box cannot move
 * again: it stops being a thing and becomes vertices inside a bigger thing.
 *
 * The leaves have to move, so they are marked `data-keep` and bake separately
 * — one mesh each, hung under a hinge entity that carries the rotation. Three
 * draw calls for the whole door: frame, left leaf, right leaf. That is the
 * price of it being a door and not a picture of one.
 *
 * Opening is not this component's job. `auto-open` decides when; this only
 * knows how far.
 */

import { builtMaterial, mergeBoxes } from './merge-boxes.js';

AFRAME.registerComponent('door', {
  schema: {
    /** The opening the two leaves cover when shut. */
    width: { type: 'number', default: 2.6 },
    height: { type: 'number', default: 2.5 },

    /** How far each leaf swings when fully open, in degrees. */
    swing: { type: 'number', default: 88 },

    /** Panels down each leaf. Two is a school door; six is a front door. */
    panels: { type: 'number', default: 2 },

    /**
     * One leaf or two.
     *
     * Two for an entrance, because that is what a school's front door is. One
     * for a room off a corridor, because that is what those are — a pair of
     * half-metre leaves on an internal door looks like a doll's house.
     */
    leaves: { type: 'number', default: 2 },

    /**
     * How far the frame stands proud of the wall. 0 draws no frame at all.
     *
     * An entrance wants a deep reveal. A doorway that already has a frame
     * around it — `room` draws its own — wants none: two frames in the same
     * opening put a pale post either side of every interior door, which from
     * down a corridor reads as a column.
     */
    frameDepth: { type: 'number', default: 0.42 },

    /**
     * How far open it stands when built, 0 to 1.
     *
     * `auto-open` swings a door as somebody walks up to it, which is right for
     * a tour and useless for a lesson about open and closed — that needs one
     * door standing open and one standing shut, and neither moving.
     */
    open: { type: 'number', default: 0 },

    leaf: { type: 'color', default: '#7d4a2b' },
    panel: { type: 'color', default: '#6a3d22' },
    frame: { type: 'color', default: '#e9e2d4' },
    handle: { type: 'color', default: '#c9a227' },
  },

  init() {
    /** 0 shut, 1 fully open. Read and written by `auto-open`. */
    this.openness = 0;
    this.hinges = [];

    this.build();
  },

  update() {
    this.build();
  },

  remove() {
    cancelAnimationFrame(this.pending);
  },

  /**
   * How far open the door stands, 0 to 1.
   *
   * The contract `auto-open` drives. Anything that swings can implement it and
   * get proximity opening for free.
   */
  setOpen(fraction) {
    this.openness = fraction;

    for (const { el, sign } of this.hinges) {
      el.object3D.rotation.y = THREE.MathUtils.degToRad(sign * this.data.swing * fraction);
    }
  },

  build() {
    this.el.innerHTML = '';
    this.hinges = [];

    this.frame();

    // Hinged at the outer edges, so a pair meets in the middle. Everything
    // swings to -z, into the building: the veranda pillars stand in front.
    const { width, leaves } = this.data;

    if (leaves === 1) {
      this.leaf(-width / 2, 1, width);
    } else {
      this.leaf(-width / 2, 1, width / 2);
      this.leaf(width / 2, -1, width / 2);
    }

    // The frame is boxes and bakes into one mesh. The leaves are `data-keep`,
    // so this walks straight past them.
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      mergeBoxes(this.el, builtMaterial());
      for (const { el } of this.hinges) mergeBoxes(el.firstElementChild, builtMaterial());

      // Shut on arrival, unless the content says otherwise. Opening on
      // approach is the moment worth having, and it only exists if the door
      // was shut to begin with — so `open` defaults to 0 and every door that
      // does not mention it behaves exactly as before. A lesson about open and
      // closed sets it, and gets a door that stands open and stays there.
      this.setOpen(this.data.open);
    });
  },

  /** Jambs, lintel and threshold — the hole the leaves hang in. */
  frame() {
    const { width, height, frame, frameDepth } = this.data;
    if (!frameDepth) return;

    const t = 0.16;

    for (const side of [-1, 1]) {
      this.block(this.el, t, height + t, frameDepth, side * (width / 2 + t / 2), (height + t) / 2, 0, frame);
    }

    this.block(this.el, width + t * 2, t, frameDepth, 0, height + t / 2, 0, frame);

    // A threshold. Without it the leaves stop at nothing and you can see the
    // seam where the floor inside meets the step outside.
    this.block(this.el, width + t * 2, 0.08, frameDepth + 0.08, 0, 0.04, 0, '#8d8478');
  },

  /**
   * One leaf, hinged at `x`.
   *
   * Two entities deep on purpose: the outer one is the hinge and only ever
   * rotates, the inner one holds the boxes and is what gets baked. Baking the
   * hinge itself would fold its rotation into the vertices, and then turning
   * it would turn an already-turned door.
   */
  leaf(x, sign, leafWidth) {
    const { height, panels, leaf, panel, handle } = this.data;
    const thickness = 0.07;

    const hinge = document.createElement('a-entity');
    hinge.dataset.keep = '';
    hinge.setAttribute('position', `${x} 0 0`);
    this.el.appendChild(hinge);

    const body = document.createElement('a-entity');
    body.setAttribute('position', '0 0 0');
    hinge.appendChild(body);

    this.hinges.push({ el: hinge, sign });

    // The leaf hangs off the hinge at the edge of the opening, so its own
    // middle is half a leaf back towards the centre.
    const mid = sign * leafWidth / 2;
    const stile = 0.17;

    // Stiles down each side, rails across top and bottom.
    for (const edge of [-1, 1]) {
      this.block(body, stile, height, thickness, mid + edge * (leafWidth - stile) / 2, height / 2, 0, leaf);
    }
    this.block(body, leafWidth, stile, thickness, mid, stile / 2, 0, leaf);
    this.block(body, leafWidth, stile, thickness, mid, height - stile / 2, 0, leaf);

    // Panels, with a rail between each pair. A flat slab with a border is a
    // board; the horizontal shadow lines are what make it read as a door.
    const inner = height - stile * 2;
    const cell = inner / panels;

    for (let i = 0; i < panels; i += 1) {
      const y = stile + cell * (i + 0.5);

      // Set back, so the stiles cast a line across it.
      //
      // Sized to run UNDER the rails rather than to stop at them. Cut to the
      // exact gap it left a hairline of daylight above and below every panel,
      // and the door read as four planks with slots between them.
      this.block(body, leafWidth - stile * 1.6, cell, thickness * 0.5, mid, y, -0.015, panel);

      if (i > 0) {
        this.block(body, leafWidth, stile * 0.8, thickness, mid, stile + cell * i, 0, leaf);
      }
    }

    // The handle, on the meeting edge at a child's eye line rather than an
    // adult's — this is the door they will be told to look at.
    const lip = mid + sign * (leafWidth / 2 - 0.18);
    this.block(body, 0.06, 0.22, 0.12, lip, 1.0, thickness / 2 + 0.03, handle);
  },

  block(parent, w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    // Painted wood, not plaster: the same texture at a much lower roughness,
    // so the leaves catch a sheen the walls around them do not.
    box.setAttribute('material', {
      color,
      src: 'assets/textures/plaster_color.jpg',
      normalMap: 'assets/textures/plaster_normal.jpg',
      repeat: `${Math.max(0.5, w / 3).toFixed(2)} ${Math.max(0.5, h / 3).toFixed(2)}`,
      roughness: 0.55,
      metalness: 0,
    });

    parent.appendChild(box);
    return box;
  },
});
