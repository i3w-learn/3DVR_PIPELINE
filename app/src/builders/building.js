/**
 * A building, built from numbers.
 *
 * Everything else in this project is downloaded, because a cow is an organic
 * shape nobody on this team can model. A building is not: it is boxes. Walls,
 * floors, a flat roof, balcony slabs, pillars, window panes — all rectangles,
 * all placeable by arithmetic.
 *
 * That flips the trade completely. A downloaded school is somebody else's
 * school, at twenty thousand triangles, in whatever country it was modelled
 * for. This one is about five hundred triangles, says whatever the sign should
 * say, and becomes a house or a shop by changing three numbers — which is what
 * makes it useful for a curriculum that needs a school, a home, a market and a
 * health centre.
 *
 * It is deliberately plain. A three-year-old is being asked "which building is
 * the school?", not to admire the brickwork.
 */

import { builtMaterial, mergeBoxes } from './merge-boxes.js';

/**
 * The raised base every one of these buildings stands on.
 *
 * It is also the floor level inside, which is why it is a constant rather than
 * a number repeated in three methods: the steps climb to it, the entrance hall
 * sits on it, and the door is hung on it. Change it in one place or the school
 * gets a step down into its own doorway.
 */
const PLINTH = 0.4;

AFRAME.registerComponent('building', {
  schema: {
    floors: { type: 'number', default: 3 },
    width: { type: 'number', default: 18 },
    depth: { type: 'number', default: 9 },
    floorHeight: { type: 'number', default: 3.2 },

    /** Windows per floor across the front. */
    windows: { type: 'number', default: 6 },

    /** Ground floor open at the front — a veranda on pillars. */
    veranda: { type: 'boolean', default: true },

    /** Text on the board above the entrance. Empty for none. */
    sign: { type: 'string', default: '' },

    wall: { type: 'color', default: '#efe9dc' },
    trim: { type: 'color', default: '#6b2340' },
    roof: { type: 'color', default: '#d8d2c4' },
    glass: { type: 'color', default: '#7fa8c4' },

    /** Inside the entrance hall — a different room, so different colours. */
    inside: { type: 'color', default: '#e7ded0' },
    dado: { type: 'color', default: '#7a9aa8' },
    floorColor: { type: 'color', default: '#a08a72' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  /**
   * Bake the boxes into one mesh.
   *
   * A frame late, because the boxes are entities and their meshes do not exist
   * until A-Frame has attached them. Without this every box is its own draw
   * call, and five buildings put the scene four times over its budget.
   */
  bake() {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => mergeBoxes(this.el, builtMaterial()));
  },

  remove() {
    cancelAnimationFrame(this.pending);
  },

  build() {
    // Rebuilt whole rather than patched: it is a few dozen boxes, and a
    // partial update is more code than a fresh one.
    this.el.innerHTML = '';

    const { floors, width, depth, floorHeight, veranda } = this.data;
    const height = floors * floorHeight;

    this.mass(width, height, depth, floorHeight, veranda);

    // A plinth. These buildings stand on one, and the shadow line where it
    // meets the ground is what stops the wall looking like it was dropped on
    // the grass. Its top is the floor level everything inside sits on.
    this.block(width + 0.5, PLINTH, depth + 0.5, 0, PLINTH / 2, 0, this.data.trim);

    // The entrance bay, projecting forward. One flat face across twenty metres
    // reads as a slab from any angle; a break in the middle gives the front a
    // near side and a far side, and the light does the rest.
    //
    // It starts ABOVE the veranda. Running it to the ground walled the
    // entrance shut — the doorway and the pillars were still there, behind a
    // slab, and the school had no way in.
    const bay = Math.min(width * 0.34, 7);
    const bayFrom = veranda ? floorHeight : 0;

    this.block(bay, height - bayFrom, 1.1, 0, bayFrom + (height - bayFrom) / 2, depth / 2 + 0.55, this.data.wall);
    this.block(bay + 0.5, 0.4, 1.4, 0, height + 0.2, depth / 2 + 0.6, this.data.roof);

    // Roof: a slab slightly wider than the walls, so it reads as a lid rather
    // than as one more storey.
    this.block(width + 0.6, 0.4, depth + 0.6, 0, height + 0.2, 0, this.data.roof);

    // A parapet above it — the low wall that makes an Indian flat roof read as
    // a flat roof and not as an unfinished one.
    this.block(width + 0.6, 0.5, 0.3, 0, height + 0.65, depth / 2 + 0.3, this.data.roof);

    for (let floor = 0; floor < floors; floor += 1) {
      const y = floor * floorHeight;
      const openFront = veranda && floor === 0;

      if (openFront) this.veranda(y);
      else this.windowRow(y + floorHeight * 0.55, floor > 0);

      // A band between floors reads as a storey line from any distance, which
      // is how a child counts floors without being told.
      if (floor > 0) {
        this.block(width + 0.3, 0.25, depth + 0.3, 0, y, 0, this.data.trim);
      }
    }

    if (this.data.sign) this.sign(height);

    this.bake();
  },

  /**
   * The solid body of the building.
   *
   * Without a veranda this is one box and nothing more. With one, the ground
   * floor has to be hollow: the entrance is a real opening with a real door in
   * it, and behind a real door there has to be somewhere. So the ground floor
   * is built as the four solids AROUND the hall — left, right, the plug behind
   * it, and the front wall with a hole in it — and the storeys above sit on top
   * as a single box, which is also the hall's ceiling.
   *
   * Boxes cannot be subtracted from each other; a hole is something you build
   * around. That is the whole trick, and it costs six boxes instead of one.
   */
  mass(width, height, depth, floorHeight, veranda) {
    if (!veranda) {
      this.block(width, height, depth, 0, height / 2, 0, this.data.wall);
      return;
    }

    const hallWidth = Math.min(width * 0.25, 4.6);
    const hallDepth = Math.min(depth * 0.55, 5.5);
    const doorWidth = 2.6;
    const doorHeight = Math.min(2.3, floorHeight - 0.6);

    // Everything above the ground floor, in one piece. Its underside is the
    // hall ceiling, so the hall needs no ceiling of its own.
    this.block(width, height - floorHeight, depth, 0, floorHeight + (height - floorHeight) / 2, 0, this.data.wall);

    // Left and right of the hall, full depth.
    const side = (width - hallWidth) / 2;
    for (const s of [-1, 1]) {
      this.block(side, floorHeight, depth, s * (width + hallWidth) / 4, floorHeight / 2, 0, this.data.wall);
    }

    // The plug behind the hall — this is what stops the school being a tunnel
    // you can see straight through.
    this.block(
      hallWidth, floorHeight, depth - hallDepth,
      0, floorHeight / 2, -depth / 2 + (depth - hallDepth) / 2,
      this.data.wall
    );

    // The front wall across the hall, built in three pieces around the door:
    // a pier each side and a lintel over the top.
    const pier = (hallWidth - doorWidth) / 2;
    const faceZ = depth / 2 - 0.2;

    for (const s of [-1, 1]) {
      this.block(pier, floorHeight, 0.4, s * (doorWidth + pier) / 2, floorHeight / 2, faceZ, this.data.wall);
    }
    this.block(
      doorWidth, floorHeight - doorHeight - PLINTH, 0.4,
      0, PLINTH + doorHeight + (floorHeight - doorHeight - PLINTH) / 2, faceZ,
      this.data.wall
    );

    this.hall(hallWidth, hallDepth, depth, floorHeight);
    this.door(doorWidth, doorHeight, faceZ);
  },

  /**
   * What is behind the door.
   *
   * A door that opens onto darkness is worse than no door — the child sees the
   * school has nothing inside it. This is not a modelled interior and is not
   * meant to be: it is a corridor deep enough that you cannot see the end of
   * it, with two more doorways off it and a notice board, which is exactly
   * enough for the eye to conclude the school continues.
   *
   * The real interiors are their own lands. See `room`.
   */
  hall(hallWidth, hallDepth, depth, floorHeight) {
    const { inside, dado, floorColor, trim } = this.data;
    const front = depth / 2;
    const back = front - hallDepth;

    // Floor, standing proud of the plinth rather than flush with it. Flush
    // meant two surfaces at exactly the same height, and the corridor came out
    // striped where the renderer could not decide which one was in front.
    this.block(hallWidth, 0.14, hallDepth, 0, PLINTH - 0.02, front - hallDepth / 2, floorColor);

    // Ceiling, for the same reason. The storey band that marks the first floor
    // runs the full footprint, so its underside was the hall's ceiling — and
    // the corridor was roofed in the building's maroon trim.
    this.block(hallWidth, 0.04, hallDepth, 0, floorHeight - 0.18, front - hallDepth / 2, '#f2ede4');

    // The side walls and the back are the inward faces of the solids around
    // the hall, so they are already there — but they are the outside colour.
    // A skin a centimetre proud of each recolours them without a second solid.
    for (const s of [-1, 1]) {
      this.block(0.02, floorHeight - PLINTH, hallDepth, s * (hallWidth / 2 - 0.01), PLINTH + (floorHeight - PLINTH) / 2, front - hallDepth / 2, inside);
      this.block(0.03, 1.0, hallDepth, s * (hallWidth / 2 - 0.02), PLINTH + 0.5, front - hallDepth / 2, dado);
    }

    this.block(hallWidth, floorHeight - PLINTH, 0.02, 0, PLINTH + (floorHeight - PLINTH) / 2, back + 0.01, inside);
    this.block(hallWidth, 1.0, 0.03, 0, PLINTH + 0.5, back + 0.02, dado);

    // Two doorways off the corridor. Dark, because they are the way to rooms
    // that are not modelled — and a dark opening reads as depth, which is the
    // one thing a painted-on door could never do.
    for (const s of [-1, 1]) {
      const x = s * (hallWidth / 2 - 0.04);
      const z = front - hallDepth * 0.55;

      this.block(0.05, 2.0, 1.0, x, PLINTH + 1.0, z, '#241d18');
      this.block(0.07, 0.1, 1.2, x, PLINTH + 2.05, z, trim);
      this.block(0.07, 2.1, 0.1, x, PLINTH + 1.05, z + 0.55, trim);
      this.block(0.07, 2.1, 0.1, x, PLINTH + 1.05, z - 0.55, trim);
    }

    // A notice board on the end wall. Something to arrive at.
    this.block(1.8, 1.1, 0.05, 0, PLINTH + 1.5, back + 0.05, '#f5f1e6');
    this.block(1.9, 0.09, 0.07, 0, PLINTH + 2.07, back + 0.06, trim);
    this.block(1.9, 0.09, 0.07, 0, PLINTH + 0.93, back + 0.06, trim);

    // A bench along one side, so the corridor has something at a child's own
    // height in it rather than being an empty tube.
    const benchZ = front - hallDepth * 0.28;
    this.block(0.45, 0.07, 1.6, -(hallWidth / 2 - 0.3), PLINTH + 0.4, benchZ, '#8a6a45');
    for (const dz of [-0.65, 0.65]) {
      this.block(0.4, 0.4, 0.08, -(hallWidth / 2 - 0.3), PLINTH + 0.2, benchZ + dz, '#8a6a45');
    }

    // One lamp, so the inside is an inside and not a hole.
    //
    // The sky lights this scene through an irradiance map, which has no idea
    // that a corridor has a roof over it — so the hall comes out evenly grey
    // and lifeless. A short-range warm point light is what makes it read as a
    // room somebody uses.
    const lamp = document.createElement('a-entity');
    lamp.dataset.keep = '';
    lamp.setAttribute('position', `0 ${floorHeight - 0.9} ${front - hallDepth * 0.5}`);
    lamp.setAttribute('light', {
      type: 'point',
      color: '#ffe7c4',
      // Low and slow-falling. A bright lamp close to the ceiling burns a
      // visible hot spot onto it; the point is to lift the corridor, not to
      // light it like a stage.
      intensity: 1.5,
      distance: hallDepth + 5,
      decay: 1.1,
      castShadow: false,
    });
    this.el.appendChild(lamp);
  },

  /**
   * The door in the opening, hung on the floor level.
   *
   * `data-keep`, because its leaves swing and a baked box cannot move. It
   * applies its own `auto-open` for the same reason the gate does: a stage
   * prop carries one component, and the content files should not have to know
   * that opening is a second one.
   */
  door(width, height, faceZ) {
    const el = document.createElement('a-entity');
    el.dataset.keep = '';
    el.classList.add('clickable');
    // On the floor slab, not on the plinth under it.
    el.setAttribute('position', `0 ${PLINTH + 0.05} ${faceZ + 0.05}`);
    el.setAttribute('door', { width, height, frame: this.data.inside });
    el.setAttribute('auto-open', { range: 4.5, release: 6.5 });
    this.el.appendChild(el);
  },

  /** The open ground floor: pillars, and a slab overhead. */
  veranda(y) {
    const { width, depth, floorHeight, trim } = this.data;

    // The doorway is the gap. Pillars are placed around it, never through it —
    // an odd count spread evenly across the front puts one dead centre, which
    // is exactly where the door is, and the school ends up with a column in
    // its own entrance.
    const doorHalf = 1.6;
    const pillars = 6;

    for (let i = 0; i < pillars; i += 1) {
      const x = -width / 2 + 1 + (i * (width - 2)) / (pillars - 1);
      if (Math.abs(x) < doorHalf) continue;
      this.block(0.45, floorHeight, 0.45, x, floorHeight / 2, depth / 2 + 0.6, trim);
    }

    // A pillar either side of the opening, so the doorway has jambs rather
    // than a random gap in a row.
    for (const side of [-1, 1]) {
      this.block(0.45, floorHeight, 0.45, side * (doorHalf + 0.4), floorHeight / 2, depth / 2 + 0.6, trim);
    }

    this.block(width, 0.35, 1.8, 0, floorHeight, depth / 2 + 0.9, this.data.roof);

    // Steps up to it. These buildings stand on a plinth; a door flush with the
    // ground reads as a garage. Three risers to the plinth top, so the last
    // one lands on the floor rather than above or below it.
    const rise = PLINTH / 3;
    for (let i = 0; i < 3; i += 1) {
      this.block(4, rise, 0.4, 0, rise / 2 + i * rise, depth / 2 + 1.4 - i * 0.4, this.data.roof);
    }
  },

  /** A row of windows across the front, with a balcony slab if asked. */
  windowRow(y, balcony) {
    const { width, depth, windows, glass, trim } = this.data;
    const step = (width - 2) / windows;

    for (let i = 0; i < windows; i += 1) {
      const x = -width / 2 + 1 + step * (i + 0.5);
      this.window(x, y, step * 0.6, 1.4, depth / 2, glass, trim);
    }

    if (!balcony) return;

    // Slab, then the railing wall on top of it — the two-part shape every
    // building of this kind has.
    this.block(width - 1, 0.2, 1.2, 0, y - 0.9, depth / 2 + 0.6, this.data.roof);
    this.block(width - 1, 0.7, 0.15, 0, y - 0.45, depth / 2 + 1.15, trim);
  },

  /**
   * One window: a recessed pane inside a frame, on a sill, under a lintel.
   *
   * A flat coloured rectangle on a wall is a sticker — there is no edge for
   * the light to catch, so the eye never reads it as an opening. Four thin
   * boxes and a pane set back two centimetres is all it takes, and it is the
   * difference between a drawing of a building and a building.
   */
  window(x, y, w, h, face, glass, trim) {
    // Pane, set back into the wall.
    this.block(w, h, 0.06, x, y, face - 0.03, glass);

    const t = 0.09;
    this.block(w + t * 2, t, 0.14, x, y + h / 2 + t / 2, face + 0.04, trim); // lintel
    this.block(w + t * 2, t, 0.2, x, y - h / 2 - t / 2, face + 0.06, trim);  // sill
    this.block(t, h, 0.12, x - w / 2 - t / 2, y, face + 0.03, trim);          // jambs
    this.block(t, h, 0.12, x + w / 2 + t / 2, y, face + 0.03, trim);
  },

  /** The name board above the entrance. */
  sign(height) {
    const { width, depth, sign } = this.data;

    const bay = Math.min(width * 0.34, 7);

    this.block(bay - 0.4, 1.05, 0.12, 0, height - 1.2, depth / 2 + 1.16, '#f7f4ee');
    this.block(bay - 0.2, 0.1, 0.16, 0, height - 0.62, depth / 2 + 1.17, this.data.trim);
    this.block(bay - 0.2, 0.1, 0.16, 0, height - 1.78, depth / 2 + 1.17, this.data.trim);

    const text = document.createElement('a-entity');
    // Not boxes, so it cannot be baked; `data-keep` is what stops the bake
    // removing it along with everything else it merged.
    text.dataset.keep = '';
    text.setAttribute('position', `0 ${height - 1.2} ${depth / 2 + 1.24}`);
    text.setAttribute('text', {
      value: sign,
      align: 'center',
      // Wide enough to span the board; A-Frame text width is in metres.
      width: bay - 0.6,
      // Near-black on off-white. The old navy read as grey from the gate,
      // which is the one place the sign has to work — a child arrives there
      // and nowhere else.
      color: '#14141a',
      // Flat, so the sign is as readable in shade as in sun.
      shader: 'flat',
      // A-Frame's default font drops out at distance; this one keeps its
      // stems. `negate: false` is required for any SDF font that is not the
      // built-in one, or the glyphs render inverted.
      font: 'exo2bold',
      negate: false,
      // Room to breathe. Cramped letters are the first thing to go illegible.
      letterSpacing: 2,
    });
    this.el.appendChild(text);
  },

  /** One box. Everything above is made of these. */
  /**
   * One box.
   *
   * Textured, not flat-coloured. A flat colour has no surface at all — the
   * light falls on it evenly and the eye reads cardboard. One plaster map,
   * tinted by the box's own colour, gives every wall the same fine grain a
   * painted wall has, and the tint keeps each building its own shade.
   *
   * `repeat` is derived from the box's real size so the grain stays the same
   * physical scale whether the box is a pillar or a whole storey.
   */
  block(w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', {
      color,
      src: 'assets/textures/plaster_color.jpg',
      normalMap: 'assets/textures/plaster_normal.jpg',
      roughnessMap: 'assets/textures/plaster_rough.jpg',
      repeat: `${Math.max(0.5, w / 3).toFixed(2)} ${Math.max(0.5, h / 3).toFixed(2)}`,
      roughness: 1,
      metalness: 0,
    });

    this.el.appendChild(box);
    return box;
  },
});
