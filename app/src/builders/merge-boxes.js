/**
 * Merging a built object's boxes into one mesh.
 *
 * Building things from boxes is the right call — a school made of arithmetic
 * beats a downloaded one at a fortieth of the triangles. But every box is its
 * own mesh, and every mesh is its own draw call. Five buildings, a wall with
 * pillars and a gate with bars came to **447 draw calls against a budget of
 * 100**, while the triangle count sat comfortably at half its limit.
 *
 * Draw calls, not triangles, are what a mobile GPU runs out of first. A
 * thousand triangles in one mesh is nearly free; a hundred meshes of ten
 * triangles is not.
 *
 * So once a thing has finished building itself, its boxes are baked into a
 * single geometry. Their colours move into vertex colours, which is what lets
 * one material serve the lot — they already share the plaster texture, and the
 * tint was the only thing separating them.
 *
 * `three/examples/jsm/utils/BufferGeometryUtils` would do the merge, but it is
 * not in the A-Frame build, and the merge is thirty lines.
 *
 * ## What is left out
 *
 * Baking is one-way: once a box is folded into the merged geometry it cannot
 * move again, because it no longer exists as a thing. Anything that has to move
 * later — a door leaf that swings — must be kept out of the bake, and so must
 * anything that is not boxes at all, like the name board's text.
 *
 * `data-keep` on an element is that opt-out. The subtree under it is neither
 * merged nor removed; it stays a live entity with its own mesh, and pays its
 * own draw call. Use it for the few things that move, not for decoration.
 */

const colour = new THREE.Color();

/**
 * Bake every descendant mesh of `el` into one.
 *
 * @param {Element} el          the entity whose children were built
 * @param {THREE.Material} material  the single material the result will use
 */
export function mergeBoxes(el, material) {
  // `update()` fires after `init()`, so a naive bake runs twice and the second
  // pass merges the first pass's output back into itself.
  if (el.getObject3D('mesh')) return null;

  const root = el.object3D;
  root.updateWorldMatrix(false, true);

  // Only what the builder itself put there.
  //
  // Walking the whole object3D tree also swept up things other components had
  // hung on the same entity — `contact-shadow` adds its patch straight to
  // `el.object3D`, and it was being baked into the furniture as a plain white
  // rectangle lying on the floor. Starting from the child ELEMENTS instead
  // keeps the bake to the boxes that were built.
  const parts = [];
  for (const child of el.children) {
    if (child.dataset.keep !== undefined) continue;
    collect(child.object3D, parts);
  }

  if (parts.length < 2) return null;

  let vertices = 0;
  let indices = 0;

  for (const part of parts) {
    vertices += part.geometry.getAttribute('position').count;
    indices += part.geometry.index ? part.geometry.index.count : 0;
  }

  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const color = new Float32Array(vertices * 3);
  const index = new Uint32Array(indices);

  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();

  let v = 0;
  let i = 0;

  for (const part of parts) {
    const geometry = part.geometry;
    const src = geometry.getAttribute('position');
    const srcNormal = geometry.getAttribute('normal');
    const srcUv = geometry.getAttribute('uv');

    // Into the root's space, so the merged mesh can hang off the entity
    // unchanged rather than in world coordinates.
    matrix.multiplyMatrices(inverse, part.matrixWorld);
    normalMatrix.getNormalMatrix(matrix);

    const material = Array.isArray(part.material) ? part.material[0] : part.material;
    colour.copy(material?.color ?? { r: 1, g: 1, b: 1 });

    const vertex = new THREE.Vector3();
    const start = v;

    for (let k = 0; k < src.count; k += 1, v += 1) {
      vertex.fromBufferAttribute(src, k).applyMatrix4(matrix);
      position.set([vertex.x, vertex.y, vertex.z], v * 3);

      if (srcNormal) {
        vertex.fromBufferAttribute(srcNormal, k).applyMatrix3(normalMatrix).normalize();
        normal.set([vertex.x, vertex.y, vertex.z], v * 3);
      }

      // Each box kept its own texture repeat; baking it into the UVs is what
      // preserves the grain scale once they all share one material.
      if (srcUv) {
        const repeat = material?.map?.repeat ?? { x: 1, y: 1 };
        uv.set([srcUv.getX(k) * repeat.x, srcUv.getY(k) * repeat.y], v * 2);
      }

      color.set([colour.r, colour.g, colour.b], v * 3);
    }

    if (geometry.index) {
      for (let k = 0; k < geometry.index.count; k += 1, i += 1) {
        index[i] = geometry.index.getX(k) + start;
      }
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  merged.computeBoundingSphere();

  // Remove what was merged, one element at a time.
  //
  // Clearing `innerHTML` and re-appending the survivors looks equivalent and
  // is not: detaching an entity tears down its components, and re-attaching
  // the same element does not reliably rebuild them. The school's name board
  // came back as an entity with no mesh — present in the DOM, invisible on
  // screen. Leaving it attached avoids the question entirely.
  //
  // Every child that contributed goes, including wrappers. Removing only the
  // `<a-box>` children missed the gate entirely — its bars live inside two
  // hinge entities, so they were merged into the new mesh AND left in place,
  // and the gate was quietly drawn twice.
  for (const child of [...el.children]) {
    if (child.dataset.keep === undefined) el.removeChild(child);
  }

  const mesh = new THREE.Mesh(merged, material);
  el.setObject3D('mesh', mesh);

  return mesh;
}

/**
 * Every mesh under `object`, minus the subtrees that asked to be left alone.
 *
 * `Object3D.traverse` cannot skip a branch, and skipping is the whole point —
 * so this is the same walk written out, with one early return.
 */
function collect(object, out) {
  if (object.el?.dataset.keep !== undefined) return;

  if (object.isMesh && object.geometry?.getAttribute('position')) out.push(object);
  for (const child of object.children) collect(child, out);
}

/** One material for everything built this way — plaster, tinted per vertex. */
let shared = null;

export function builtMaterial() {
  if (shared) return shared;

  const loader = new THREE.TextureLoader();
  const wrap = (url) => {
    const t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  const map = wrap('assets/textures/plaster_color.jpg');
  map.colorSpace = THREE.SRGBColorSpace;

  shared = new THREE.MeshStandardMaterial({
    map,
    normalMap: wrap('assets/textures/plaster_normal.jpg'),
    roughnessMap: wrap('assets/textures/plaster_rough.jpg'),
    // The tint that used to live on each box's own material.
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });

  return shared;
}
