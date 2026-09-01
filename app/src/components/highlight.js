/**
 * The highlight ring.
 *
 * This is the entire teaching mechanic. The audience cannot read, so a lesson
 * cannot label the thing it is naming — it points at it. A pulsing yellow ring
 * on the ground under an object says "this one" in every language at once, and
 * costs one torus to draw.
 *
 * It is a component and not a template's private detail because every template
 * needs it: identify points at one object, count points at each in turn, match
 * points at a pair.
 */

AFRAME.registerComponent('highlight', {
  schema: {
    radius: { type: 'number', default: 0.9 },
    color: { type: 'color', default: '#ffe14d' },
  },

  init() {
    const ring = document.createElement('a-torus');

    ring.setAttribute('radius', this.data.radius);
    ring.setAttribute('radius-tubular', 0.04);
    ring.setAttribute('segments-tubular', 24);
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', '0 0.02 0');
    ring.setAttribute('color', this.data.color);
    // Flat shading: the ring is a symbol, not an object in the world, and it
    // must read the same wherever the light happens to fall.
    ring.setAttribute('material', 'shader: flat');
    ring.setAttribute('animation', {
      property: 'scale',
      to: '1.15 1.15 1.15',
      dir: 'alternate',
      loop: true,
      dur: 900,
      easing: 'easeInOutSine',
    });

    this.ring = ring;
    this.el.appendChild(ring);
  },

  remove() {
    if (this.ring?.parentNode) this.ring.parentNode.removeChild(this.ring);
    this.ring = null;
  },
});
