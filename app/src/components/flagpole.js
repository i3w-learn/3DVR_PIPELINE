/**
 * The flag pole.
 *
 * Every school in India has one, and it stands where the children line up. It
 * is the single detail that turns a building with a wall around it into a
 * school a child recognises before anybody says the word.
 *
 * The flag is three flat panels rather than a texture — at this size the
 * saffron, white and green bands are all that read, and a cloth simulation
 * would cost more than the whole building.
 */

AFRAME.registerComponent('flagpole', {
  schema: {
    height: { type: 'number', default: 7 },
    flagWidth: { type: 'number', default: 1.8 },
    pole: { type: 'color', default: '#c9ccd0' },
    base: { type: 'color', default: '#ded5c4' },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { height, flagWidth, pole, base } = this.data;

    // A stepped plinth — the pole never comes straight out of the ground.
    this.block(1.4, 0.25, 1.4, 0, 0.125, 0, base);
    this.block(1.0, 0.25, 1.0, 0, 0.375, 0, base);

    const mast = document.createElement('a-cylinder');
    mast.setAttribute('radius', 0.07);
    mast.setAttribute('height', height);
    mast.setAttribute('position', `0 ${height / 2 + 0.5} 0`);
    mast.setAttribute('material', { color: pole, roughness: 0.4, metalness: 0.3 });
    this.el.appendChild(mast);

    // Three bands, hanging from just below the top.
    const bandHeight = (flagWidth * 2) / 3 / 2;
    const top = height + 0.5 - 0.4;

    ['#ff9933', '#ffffff', '#138808'].forEach((colour, i) => {
      this.block(
        flagWidth,
        bandHeight,
        0.03,
        flagWidth / 2 + 0.07,
        top - bandHeight / 2 - i * bandHeight,
        0,
        colour
      );
    });
  },

  block(w, h, d, x, y, z, color) {
    const box = document.createElement('a-box');

    box.setAttribute('width', w);
    box.setAttribute('height', h);
    box.setAttribute('depth', d);
    box.setAttribute('position', `${x} ${y} ${z}`);
    box.setAttribute('material', { color, roughness: 0.8, metalness: 0 });

    this.el.appendChild(box);
    return box;
  },
});
