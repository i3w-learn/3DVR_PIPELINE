/**
 * Dunes: the ground rising behind the child.
 *
 * A beach that is one flat plane to the horizon reads as a table with a
 * picture on it. What a real beach has is a rise behind: low mounds of sand
 * that hide the edge of the world, catch the sun on one side and throw a soft
 * shadow on the other, and put something at every distance so the eye has
 * depth to read. That is most of the difference between "3D" and "a flat
 * picture", and it costs one mesh.
 *
 * The mounds are a subdivided disc with a height field of overlapping sines —
 * smooth, not spiky, because dunes are smooth. The field is flat inside
 * `inner` metres so the lesson's own ground stays exactly level under the
 * child and the things that walk up to them, and rises from there.
 *
 * It wears the same sand maps as the ground (colour, normal, roughness, AO),
 * so the join is invisible, and it receives the sun's shadow like the ground.
 *
 * Params:
 *   radius   metres to the far edge (default 110)
 *   inner    metres of flat before the rise (default 22)
 *   height   tallest mound in metres (default 3.2)
 *   texture  id of the ground texture set in assets/textures (default sand)
 *   repeat   texture tiles across the disc (default 34)
 *   arc      degrees of the disc that rise, centred on `facing` (default 360)
 *   facing   degrees; 180 is behind the child (default 180)
 *   seed     picks the shape (default 3)
 */

function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

AFRAME.registerComponent('dunes', {
  schema: {
    radius: { type: 'number', default: 110 },
    inner: { type: 'number', default: 22 },
    height: { type: 'number', default: 3.2 },
    texture: { type: 'string', default: 'sand' },
    repeat: { type: 'number', default: 34 },
    arc: { type: 'number', default: 360 },
    facing: { type: 'number', default: 180 },
    seed: { type: 'number', default: 3 },
  },

  init() {
    const { radius, inner, height, texture, repeat, arc, facing, seed } = this.data;
    const random = seeded(seed);

    // A handful of broad sine waves at odd angles. Summed, they make mounds
    // that never repeat visibly across the disc.
    const waves = [];
    for (let i = 0; i < 7; i += 1) {
      const angle = random() * Math.PI * 2;
      waves.push({
        kx: Math.cos(angle), kz: Math.sin(angle),
        length: 18 + random() * 30,
        phase: random() * Math.PI * 2,
        weight: 0.5 + random() * 0.5,
      });
    }
    const total = waves.reduce((sum, w) => sum + w.weight, 0);

    const segments = 160;
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position;
    const half = THREE.MathUtils.degToRad(arc) / 2;
    const face = THREE.MathUtils.degToRad(facing);

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      // Flat until `inner`, then rising over the next 20 m to full height.
      const rise = THREE.MathUtils.smoothstep(r, inner, inner + 20);
      // Only the wedge the land asked for rises; the sea side stays flat.
      const bearing = Math.atan2(x, -z); // 0 = ahead of the child (-z)
      let d = Math.abs(bearing - face);
      if (d > Math.PI) d = Math.PI * 2 - d;
      const wedge = arc >= 360 ? 1 : 1 - THREE.MathUtils.smoothstep(d, half - 0.35, half + 0.35);
      // Fade out at the rim so the disc does not end in a cliff.
      const rim = 1 - THREE.MathUtils.smoothstep(r, radius * 0.8, radius * 0.98);

      let h = 0;
      for (const w of waves) h += w.weight * (0.5 + 0.5 * Math.sin((x * w.kx + z * w.kz) / w.length * Math.PI * 2 + w.phase));
      h = (h / total) * height;
      pos.setY(i, h * rise * wedge * rim);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    const loader = new THREE.TextureLoader();
    const map = (name, srgb) => {
      const t = loader.load(`assets/textures/${texture}_${name}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = 16;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const material = new THREE.MeshStandardMaterial({
      map: map('color', true),
      normalMap: map('normal'),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: map('rough'),
      aoMap: map('ao'),
      roughness: 1,
      metalness: 0,
    });
    geometry.setAttribute('uv2', geometry.attributes.uv);

    const mesh = new THREE.Mesh(geometry, material);
    // A hair above the flat ground where it is flat, so the two never fight
    // in the depth test; the rise carries it well clear beyond that.
    mesh.position.y = 0.012;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.el.setObject3D('mesh', mesh);
  },

  remove() {
    const mesh = this.el.getObject3D('mesh');
    if (mesh) {
      mesh.geometry.dispose();
      for (const t of Object.values(mesh.material)) if (t?.isTexture) t.dispose();
      mesh.material.dispose();
    }
    this.el.removeObject3D('mesh');
  },
});
