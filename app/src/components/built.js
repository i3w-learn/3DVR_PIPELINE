/**
 * What everything built from boxes has in common.
 *
 * Furniture, lab benches, playground equipment — they all do the same three
 * things: place boxes on init, rebuild on update, and bake the lot into one
 * mesh a frame later. That is the whole of the shared behaviour, so it lives
 * here rather than being copied into every component that needs it.
 *
 * Spread into a component rather than inherited, because an A-Frame component
 * is a plain object and there is nothing to inherit from.
 */

import { builtMaterial, mergeBoxes } from './merge-boxes.js';

export const builder = {
  init() {
    this.build();
  },

  update() {
    this.build();
  },

  remove() {
    cancelAnimationFrame(this.pending);
  },

  /**
   * Bake into one mesh, a frame late.
   *
   * Late because the boxes are entities and their meshes do not exist until
   * A-Frame has attached them. One mesh because every box is otherwise its own
   * draw call, and a furnished classroom is thirty boxes.
   */
  bake() {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => mergeBoxes(this.el, builtMaterial()));
  },

  block(w, h, d, x, y, z, color, parent) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', {
      color,
      src: 'assets/textures/plaster_color.jpg',
      normalMap: 'assets/textures/plaster_normal.jpg',
      repeat: `${Math.max(0.5, w / 3).toFixed(2)} ${Math.max(0.5, h / 3).toFixed(2)}`,
      roughness: 0.85,
      metalness: 0,
    });

    (parent ?? this.el).appendChild(box);
    return box;
  },
}
;
