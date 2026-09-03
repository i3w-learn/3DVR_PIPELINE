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
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    // Rebuilt whole rather than patched: it is a few dozen boxes, and a
    // partial update is more code than a fresh one.
    this.el.innerHTML = '';

    const { floors, width, depth, floorHeight, veranda } = this.data;
    const height = floors * floorHeight;

    this.block(width, height, depth, 0, height / 2, 0, this.data.wall);

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
  },

  /** The open ground floor: pillars, and a slab overhead. */
  veranda(y) {
    const { width, depth, floorHeight, trim } = this.data;
    const pillars = 5;

    for (let i = 0; i < pillars; i += 1) {
      const x = -width / 2 + 1 + (i * (width - 2)) / (pillars - 1);
      this.block(0.5, floorHeight, 0.5, x, floorHeight / 2, depth / 2 + 0.6, trim);
    }

    this.block(width, 0.3, 1.6, 0, floorHeight, depth / 2 + 0.8, this.data.roof);

    // The doorway, centred.
    this.block(2.4, floorHeight * 0.75, 0.2, 0, floorHeight * 0.375, depth / 2 + 0.05, '#4a3328');

    // Steps up to it. These buildings stand on a plinth; a door flush with the
    // ground reads as a garage.
    for (let i = 0; i < 3; i += 1) {
      const rise = 0.15;
      this.block(4, rise, 0.4, 0, rise / 2 + i * rise, depth / 2 + 1.4 - i * 0.4, this.data.roof);
    }
  },

  /** A row of windows across the front, with a balcony slab if asked. */
  windowRow(y, balcony) {
    const { width, depth, windows, glass, trim } = this.data;
    const step = (width - 2) / windows;

    for (let i = 0; i < windows; i += 1) {
      const x = -width / 2 + 1 + step * (i + 0.5);
      this.block(step * 0.6, 1.4, 0.12, x, y, depth / 2 + 0.06, glass);
    }

    if (!balcony) return;

    // Slab, then the railing wall on top of it — the two-part shape every
    // building of this kind has.
    this.block(width - 1, 0.2, 1.2, 0, y - 0.9, depth / 2 + 0.6, this.data.roof);
    this.block(width - 1, 0.7, 0.15, 0, y - 0.45, depth / 2 + 1.15, trim);
  },

  /** The name board above the entrance. */
  sign(height) {
    const { width, depth, sign } = this.data;

    this.block(width * 0.6, 1, 0.15, 0, height - 1.2, depth / 2 + 0.1, '#ffffff');

    const text = document.createElement('a-entity');
    text.setAttribute('position', `0 ${height - 1.2} ${depth / 2 + 0.2}`);
    text.setAttribute('text', {
      value: sign,
      align: 'center',
      // Wide enough to span the board; A-Frame text width is in metres.
      width: width * 0.62,
      color: '#1f2f5c',
      // Flat, so the sign is as readable in shade as in sun.
      shader: 'flat',
    });
    this.el.appendChild(text);
  },

  /** One box. Everything above is made of these. */
  block(w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', { color, roughness: 0.85, metalness: 0 });

    this.el.appendChild(box);
    return box;
  },
});
