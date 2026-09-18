/**
 * The far and the middle of a place: a horizon of hills, and a line of trees.
 *
 * ## Why these exist
 *
 * The first version of the snow, sky and water lands was a few objects on an
 * infinite flat plane, and in a headset it read as a tabletop diorama floating
 * in nothing. A real place has three depths — things near you, things in the
 * middle distance, and something at the horizon that says the world continues
 * and then ends. Those lands only had the first.
 *
 * `hills` is the far: a ring of peaks that closes the horizon. `grove` is the
 * middle: a band of trees between the viewer and the hills. Together they are
 * most of what turns a plane with props on it into somewhere.
 *
 * ## Why they are drawn directly rather than built from entities
 *
 * A grove of sixty pines made from A-Frame primitives is three hundred
 * entities and, until baked, three hundred draw calls. Everything here is
 * assembled as raw three.js geometry and merged before it ever touches the
 * scene: one land feature, one mesh, one draw call.
 *
 * Flat shading is deliberate. The art direction is stylised low-poly, and a
 * faceted hill reads as a drawing of a hill — which sits honestly next to a
 * school made of boxes in a way a photoscanned mountain never would.
 */

import { seeded } from './random.js';

/**
 * One material for every land feature.
 *
 * Smooth-shaded, not flat. The first version faceted everything, and a tree
 * crown made of twenty flat triangles each catching the light differently did
 * not read as low-poly style — it read as a crumpled paper cut-out, uneven and
 * two-dimensional. Round things now keep their real normals and shade as round
 * things; boxes stay crisp because a box's own normals are already per-face.
 * A part that genuinely wants facets — a mountain — asks for them with `flat`.
 */
let land = null;

export function flatMaterial() {
  land ??= new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  return land;
}

/**
 * Soft dark patches on the ground under things. See `groundShadows`.
 *
 * The darkness comes from a radial gradient drawn once to a canvas: opaque in
 * the middle, nothing at the rim. A plain dark disc has a hard edge, and from
 * across a field that is invisible — but on a table thirty centimetres from a
 * child's face it looked like a stain with corners.
 */
let shadow = null;

function shadowMaterial() {
  if (shadow) return shadow;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const fade = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, 'rgba(0,0,0,0.55)');
  fade.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 64);

  shadow = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), color: '#0e1a12',
    transparent: true, depthWrite: false, fog: true,
  });
  return shadow;
}

/**
 * Blob shadows: one soft dark patch on the ground under each thing, all one
 * mesh.
 *
 * Real shadow maps are off in these lands — a shadow pass doubles the draw
 * cost and a Quest cannot spare it. But with no shadow at all nothing is
 * anchored: every tree looked pasted onto the grass rather than growing out of
 * it, which was most of why the scenes read as flat. A soft dark patch under
 * each object is the oldest trick in games and costs one draw call per land.
 *
 * @param {{x: number, z: number, r: number}[]} spots
 */
export function groundShadows(spots) {
  const position = [];
  const uv = [];

  for (const { x, z, r } of spots) {
    // A quad, slightly off-centre away from the sun and stretched along it, so
    // it reads as cast rather than painted. The gradient rounds the corners.
    const cx = x - r * 0.18, cz = z - r * 0.12;
    const w = r * 1.5, d = r * 1.2;
    const corners = [[-w, -d, 0, 0], [w, -d, 1, 0], [w, d, 1, 1], [-w, d, 0, 1]];

    for (const i of [0, 2, 1, 0, 3, 2]) {
      const [dx, dz, u, v] = corners[i];
      position.push(cx + dx, 0.03, cz + dz);
      uv.push(u, v);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, shadowMaterial());
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Merge coloured parts into one geometry.
 *
 * @param {{geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4, color: string}[]} parts
 */
export function mergeParts(parts) {
  const prepared = [];
  let total = 0;

  for (const { geometry, matrix, color, shade, flat, lumpy } of parts) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();

    // Lumps: push each vertex in or out along its own direction, by an amount
    // that depends only on where it is — so the three copies of a shared
    // corner move together and the surface stays closed. This is what turns a
    // perfect ball into a canopy.
    if (lumpy) {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i += 1) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        const k = 1 + ((n - Math.floor(n)) - 0.5) * lumpy;
        p.setXYZ(i, x * k, y * k, z * k);
      }
    }

    // Light from above, baked in: darker at the bottom of the part, lighter at
    // the top. The underside of a crown or a cloud is in its own shade, and
    // that gradient is the strongest cue to volume there is — it is what
    // separates a ball from a disc.
    g.computeBoundingBox();
    const low = g.boundingBox.min.y;
    const span = Math.max(1e-6, g.boundingBox.max.y - low);
    const local = g.getAttribute('position');
    const heights = new Float32Array(local.count);
    for (let i = 0; i < local.count; i += 1) heights[i] = (local.getY(i) - low) / span;

    if (matrix) g.applyMatrix4(matrix);
    if (flat || !g.getAttribute('normal')) g.computeVertexNormals();

    total += g.getAttribute('position').count;
    prepared.push({ g, color: new THREE.Color(color), shade, heights });
    geometry.dispose();
  }

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const colour = new Float32Array(total * 3);
  let offset = 0;

  for (const { g, color, shade, heights } of prepared) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const [dark, light] = shade ?? [1, 1];

    for (let i = 0; i < p.count; i += 1) {
      const at = (offset + i) * 3;
      const k = dark + (light - dark) * heights[i];

      position.set([p.getX(i), p.getY(i), p.getZ(i)], at);
      normal.set([n.getX(i), n.getY(i), n.getZ(i)], at);
      colour.set([color.r * k, color.g * k, color.b * k], at);
    }

    offset += p.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  out.computeBoundingSphere();
  return out;
}

/** A transform, without six lines of three.js at every call site. */
export function place(x, y, z, { ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
}

/**
 * A rod from one point to another.
 *
 * Exists because the alternative is working out Euler angles by hand, and the
 * first tent's guy ropes showed what that produces: four lines leaving the
 * scene in four wrong directions. Aim a cylinder by its end points and there
 * is no angle to get backwards.
 */
export function rod(from, to, radius, color, sides = 5) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const axis = b.clone().sub(a);
  const length = axis.length();

  const matrix = new THREE.Matrix4().compose(
    a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()),
    new THREE.Vector3(1, 1, 1)
  );

  return { geometry: new THREE.CylinderGeometry(radius, radius, length, sides), matrix, color };
}

/** Blend a colour toward the haze — distant things are paler and bluer. */
export function hazed(color, haze, amount) {
  return `#${new THREE.Color(color).lerp(new THREE.Color(haze), amount).getHexString()}`;
}

/**
 * Shared by every land component: build once, rebuild on change, clean up.
 *
 * A component lists its geometry in `parts()`, and may push `{x, z, r}` onto
 * `this.spots` as it goes to ask for a ground shadow there.
 */
export const direct = {
  init() { this.rebuild(); },
  update() { this.rebuild(); },

  rebuild() {
    this.spots = [];

    this.el.getObject3D('mesh')?.geometry.dispose();
    this.el.setObject3D('mesh', new THREE.Mesh(mergeParts(this.parts()), flatMaterial()));

    this.el.getObject3D('shadows')?.geometry.dispose();
    this.el.removeObject3D('shadows');
    if (this.spots.length) this.el.setObject3D('shadows', groundShadows(this.spots));
  },

  remove() {
    for (const name of ['mesh', 'shadows']) {
      this.el.getObject3D(name)?.geometry.dispose();
      this.el.removeObject3D(name);
    }
  },
};

/**
 * The horizon: two rings of peaks, the back ring taller and paler.
 *
 * Two rings rather than one because a single row of cones reads as a fence.
 * The second ring, hazed toward the sky colour, is aerial perspective — the
 * cheapest depth cue there is, and the one that makes the near ring look near.
 */
AFRAME.registerComponent('hills', {
  schema: {
    radius: { type: 'number', default: 130 },
    count: { type: 'number', default: 16 },
    height: { type: 'number', default: 26 },
    width: { type: 'number', default: 38 },
    color: { type: 'color', default: '#5f7f52' },
    haze: { type: 'color', default: '#cfdde8' },
    /** Snow on the summits. */
    capped: { type: 'boolean', default: false },
    snow: { type: 'color', default: '#f4f8fb' },
    seed: { type: 'number', default: 7 },
  },

  ...direct,

  parts() {
    const { radius, count, height, width, color, haze, capped, snow, seed } = this.data;
    const random = seeded(seed);
    const parts = [];

    for (const [ring, distance, scale, fade] of [[0, 1, 1, 0.18], [1, 1.45, 1.7, 0.5]]) {
      const n = count + ring * 4;

      for (let i = 0; i < n; i += 1) {
        const angle = ((i + random() * 0.6) / n) * Math.PI * 2 + ring * 0.2;
        const r = radius * distance * (0.92 + random() * 0.2);
        const h = height * scale * (0.6 + random() * 0.8);
        const w = width * scale * (0.7 + random() * 0.6);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        parts.push({
          geometry: new THREE.ConeGeometry(w, h, 6, 1),
          matrix: place(x, h / 2 - 1, z, { ry: random() * Math.PI }),
          color: hazed(color, haze, fade),
          flat: true,
          shade: [0.82, 1.08],
        });

        if (!capped) continue;

        // The top 40% again, a hair larger, in white.
        parts.push({
          geometry: new THREE.ConeGeometry(w * 0.41, h * 0.4, 6, 1),
          matrix: place(x, h - h * 0.2 - 0.9, z, { ry: random() * Math.PI }),
          color: hazed(snow, haze, fade * 0.6),
          flat: true,
        });
      }
    }

    return parts;
  },
});

/**
 * The middle distance: a scattered band of trees, as one mesh.
 *
 * `arc` and `facing` aim the band — a grove behind a pond is an arc on the far
 * side, not a ring, because trees between the child and the water would hide
 * the water.
 */
AFRAME.registerComponent('grove', {
  schema: {
    count: { type: 'number', default: 40 },
    inner: { type: 'number', default: 14 },
    outer: { type: 'number', default: 42 },
    /** Degrees of the circle the band covers, centred on `facing`. */
    arc: { type: 'number', default: 360 },
    /** 0 is straight ahead of the seated child (−Z). */
    facing: { type: 'number', default: 0 },
    kind: { type: 'string', default: 'pine', oneOf: ['pine', 'round'] },
    height: { type: 'number', default: 5 },
    leaf: { type: 'color', default: '#3f6b4a' },
    trunk: { type: 'color', default: '#5d4632' },
    capped: { type: 'boolean', default: false },
    snow: { type: 'color', default: '#f1f6fa' },
    seed: { type: 'number', default: 11 },
  },

  ...direct,

  parts() {
    const { count, inner, outer, arc, facing, kind, height, leaf, trunk, capped, snow, seed } = this.data;
    const random = seeded(seed);
    const parts = [];
    const span = (arc * Math.PI) / 180;
    const centre = (-90 + facing) * (Math.PI / 180);

    for (let i = 0; i < count; i += 1) {
      const angle = centre + (random() - 0.5) * span;
      const r = inner + random() * (outer - inner);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = height * (0.65 + random() * 0.7);
      // No two the same green, or a forest reads as a wallpaper pattern.
      const tint = hazed(leaf, '#9fb86a', random() * 0.35);

      // Beyond forty metres a tree is a few pixels in a headset. It keeps its
      // silhouette and loses its detail, which is where the triangles go.
      const far = r > 40;

      if (kind === 'pine') parts.push(...pineParts(x, z, h, tint, trunk, capped, snow, random));
      else parts.push(...roundParts(x, z, h, tint, trunk, random, far));

      if (!far) this.spots.push({ x, z, r: h * (kind === 'pine' ? 0.3 : 0.42) });
    }

    return parts;
  },
});

/**
 * One broadleaf tree, for a lesson that points at it.
 *
 * `grove` and `avenue` are scenery: many trees, one mesh, nothing to ring. A
 * lesson about taller and shorter needs two trees it can name, so this is the
 * same tree as an object in its own right — with a ring sized to its trunk
 * rather than the 0.9 m default, which round a 3 m sapling is wider than the
 * sapling.
 */
AFRAME.registerComponent('tree', {
  schema: {
    height: { type: 'number', default: 5 },
    leaf: { type: 'color', default: '#4a8a45' },
    trunk: { type: 'color', default: '#5d4632' },
    seed: { type: 'number', default: 5 },
  },

  ...direct,

  parts() {
    const { height, leaf, trunk, seed } = this.data;
    this.spots.push({ x: 0, z: 0, r: height * 0.42 });
    return roundParts(0, 0, height, leaf, trunk, seeded(seed));
  },

  highlightAnchor() {
    return { object3D: this.el.object3D, radius: Math.max(0.7, this.data.height * 0.26), thickness: 0.06 };
  },
});

/** A conifer: a trunk and stacked cones. The steps are what make it a tree. */
export function pineParts(x, z, h, leaf, trunk, capped, snow, random = Math.random) {
  const bare = h * 0.16;
  const spread = h * 0.36;
  const parts = [{
    geometry: new THREE.CylinderGeometry(h * 0.025, h * 0.045, bare + 0.2, 7),
    matrix: place(x, bare / 2, z),
    color: trunk,
    shade: [0.75, 1],
  }];

  const tiers = 4;
  for (let t = 0; t < tiers; t += 1) {
    const f = t / tiers;
    const tierHeight = ((h - bare) / tiers) * 1.55;
    const y = bare + (h - bare) * f * 0.8 + tierHeight / 2;
    const radius = spread * (1 - f * 0.66);
    const turn = random() * Math.PI;

    parts.push({
      geometry: new THREE.ConeGeometry(radius, tierHeight, 9, 1),
      matrix: place(x, y, z, { ry: turn }),
      color: capped && t === tiers - 1 ? snow : leaf,
      // Each skirt is dark where the one above overhangs it.
      shade: [0.6, 1.1],
    });

    if (!capped || t === tiers - 1) continue;

    // Snow lying on the branch: the upper part of the tier again, in white,
    // a touch wider so it sits outside the green rather than fighting it.
    parts.push({
      geometry: new THREE.ConeGeometry(radius * 0.62, tierHeight * 0.58, 9, 1),
      matrix: place(x, y + tierHeight * 0.215, z, { ry: turn }),
      color: snow,
      shade: [0.88, 1.04],
    });
  }

  return parts;
}

/**
 * A broadleaf: a tapering trunk and a canopy of overlapping lumps.
 *
 * The first version was a stick with three twenty-sided gems on it, and it
 * looked like exactly that. A canopy is wider than it is tall, it is lumpy
 * rather than spherical, it is dark underneath where it shades itself, and it
 * is never the same twice. Five lumps, jittered, graded from a dark underside
 * to a sunlit top, do all four.
 *
 * `far` is the cheap one for the horizon belt: same silhouette, a quarter of
 * the triangles, because nobody can count the lumps on a tree at sixty metres.
 */
export function roundParts(x, z, h, leaf, trunk, random = Math.random, far = false) {
  const stem = h * (0.38 + random() * 0.1);
  const crown = h * 0.36;
  const lean = (random() - 0.5) * 0.12;

  const parts = [{
    geometry: new THREE.CylinderGeometry(h * 0.028, h * 0.06, stem * 1.15, far ? 5 : 8),
    matrix: place(x, stem * 0.575, z, { rz: lean }),
    color: trunk,
    shade: [0.7, 1.05],
  }];

  const LUMPS = far
    ? [[0, 0, 0, 1.05]]
    : [[0, 0.1, 0, 1], [0.62, -0.16, 0.18, 0.74], [-0.58, -0.1, -0.2, 0.8],
       [0.1, -0.2, 0.62, 0.68], [-0.12, 0.34, -0.3, 0.66]];

  for (const [dx, dy, dz, size] of LUMPS) {
    const r = crown * size * (0.9 + random() * 0.2);

    parts.push({
      geometry: new THREE.IcosahedronGeometry(r, far ? 0 : 1),
      matrix: place(
        x + dx * crown + lean * h,
        stem + crown * 0.62 + dy * crown,
        z + dz * crown,
        { ry: random() * Math.PI, sy: 0.8 }
      ),
      color: leaf,
      lumpy: far ? 0 : 0.2,
      // Dark belly, bright crown. This one line is most of the volume.
      shade: [0.55, 1.15],
    });
  }

  return parts;
}
