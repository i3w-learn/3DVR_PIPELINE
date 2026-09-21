/**
 * A path across the ground.
 *
 * A lawn with a building on it is a field. A lawn with a path running to the
 * door is a place people arrive at — and for a lesson that starts at the gate
 * and ends at the classroom, the path is the lesson's own shape laid on the
 * ground. A child follows it without being told to.
 *
 * It is a flat strip laid just above the ground plane, with a kerb either
 * side. Not a hole cut in the grass: cutting one would mean a second ground
 * mesh and a seam to hide, and this reads identically.
 */

AFRAME.registerComponent('path', {
  schema: {
    length: { type: 'number', default: 24 },
    width: { type: 'number', default: 3.4 },

    /** Raised edging either side. 0 for none. */
    kerb: { type: 'number', default: 0.12 },

    /** Texture set in assets/textures, without the _color suffix. */
    surface: { type: 'string', default: 'paving' },

    /** How many times the texture repeats along the length. */
    repeat: { type: 'number', default: 8 },

    kerbColor: { type: 'color', default: '#d8d2c6' },

    /** A broken white line down the middle — a road for vehicles, not a footpath. */
    lane: { type: 'boolean', default: false },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { length, width, kerb, surface, repeat, kerbColor, lane } = this.data;

    const strip = document.createElement('a-plane');
    strip.setAttribute('width', width);
    strip.setAttribute('height', length);
    strip.setAttribute('rotation', '-90 0 0');
    // Clear of the ground plane, or the two flicker against each other.
    strip.setAttribute('position', '0 0.015 0');
    strip.setAttribute('material', {
      src: `assets/textures/${surface}_color.jpg`,
      normalMap: `assets/textures/${surface}_normal.jpg`,
      roughnessMap: `assets/textures/${surface}_rough.jpg`,
      repeat: `${Math.max(1, Math.round(repeat * (width / length)))} ${repeat}`,
      roughness: 1,
      metalness: 0,
    });
    this.el.appendChild(strip);

    if (lane) {
      // Three metres of paint, six of gap — the rhythm of a real centre line.
      for (let z = -length / 2 + 2; z < length / 2 - 2; z += 9) {
        const dash = document.createElement('a-plane');
        dash.setAttribute('width', 0.14);
        dash.setAttribute('height', 3);
        dash.setAttribute('rotation', '-90 0 0');
        dash.setAttribute('position', `0 0.022 ${z + 1.5}`);
        dash.setAttribute('material', { color: '#e9e6dc', roughness: 0.85, metalness: 0 });
        this.el.appendChild(dash);
      }
    }

    if (!kerb) return;

    for (const side of [-1, 1]) {
      const edge = document.createElement('a-box');
      edge.setAttribute('width', 0.18);
      edge.setAttribute('height', kerb);
      edge.setAttribute('depth', length);
      edge.setAttribute('position', `${(side * (width + 0.18)) / 2} ${kerb / 2} 0`);
      edge.setAttribute('material', { color: kerbColor, roughness: 0.9, metalness: 0 });
      this.el.appendChild(edge);
    }
  },
});
