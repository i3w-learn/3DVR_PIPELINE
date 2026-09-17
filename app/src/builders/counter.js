/**
 * A thing to count.
 *
 * Twelve of the curriculum's maths topics are "how many" — counting to a
 * hundred, addition, subtraction, more and less, odd and even. All of them
 * need a small object that can sit on a table in a row, and none of them care
 * what it is. A bead is as good as a mango and costs no download, no licence
 * and no intake pass.
 *
 * ## Why not just use a fruit model
 *
 * Because the lesson is about the number, not the fruit. A row of mangoes
 * invites "what is that?" — which is a good question in a fruit lesson and a
 * distraction in an addition one. Plain counters keep the child's attention on
 * the quantity, which is what the topic is teaching.
 *
 * Real objects are still the right call where recognising the object *is* the
 * point. That is what the fruit and vegetable pack is for.
 *
 * ## Why this does not bake
 *
 * The shared `builder` helper merges a component's boxes into one mesh, which
 * is what makes a thirty-box classroom affordable. A counter is one shape, and
 * merging one shape into one mesh is the work without the saving — `mergeBoxes`
 * declines anything under two parts anyway. So this places a primitive and
 * stops.
 */

/** Small enough that twenty fit on a table a child can reach across. */
const SIZE = 0.07;

AFRAME.registerComponent('counter', {
  schema: {
    shape: { type: 'string', default: 'bead', oneOf: ['bead', 'block', 'disc'] },
    color: { type: 'color', default: '#e4572e' },
    size: { type: 'number', default: SIZE },
  },

  init() {
    this.build();
  },

  update() {
    this.build();
  },

  build() {
    this.el.innerHTML = '';

    const { shape, color, size } = this.data;
    const el = document.createElement(TAG[shape] ?? TAG.bead);

    // Origin at the base, like every model that comes through intake — so a
    // counter and a cow are positioned by the same rule.
    if (shape === 'block') {
      el.setAttribute('width', size);
      el.setAttribute('height', size);
      el.setAttribute('depth', size);
      el.setAttribute('position', `0 ${size / 2} 0`);
    } else if (shape === 'disc') {
      el.setAttribute('radius', size / 2);
      el.setAttribute('height', size / 3);
      el.setAttribute('position', `0 ${size / 6} 0`);
    } else {
      el.setAttribute('radius', size / 2);
      el.setAttribute('position', `0 ${size / 2} 0`);
    }

    el.setAttribute('material', { color, roughness: 0.55, metalness: 0 });

    this.el.appendChild(el);
    this.size = size;
  },

  /**
   * A 0.9 m ring round a 7 cm bead is a hoop the width of the table. See
   * `behaviours/highlight.js`.
   */
  highlightAnchor() {
    return {
      object3D: this.el.object3D,
      radius: (this.size ?? SIZE) * 1.6,
      thickness: 0.12,
    };
  },
});

const TAG = {
  bead: 'a-sphere',
  block: 'a-box',
  disc: 'a-cylinder',
};
