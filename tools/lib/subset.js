/**
 * Taking only the part of a pack you asked for.
 *
 * A downloaded model is often more than one thing. The best realistic chicken
 * available under a licence this programme can ship is called "ANIMAL & FOOD |
 * Chicken Model", and it contains a live hen *and* a roasted one on a plate.
 * Both arrive; only one belongs in an Anganwadi classroom.
 *
 * Rejecting the whole pack over that would mean going back to a stylised bird
 * that does not match anything else in the yard. Dropping a named branch at
 * intake costs one line in a sidecar and keeps the good half.
 *
 * The rule is a name match, deliberately: it is readable in the sidecar, it
 * survives a re-download, and it fails loudly when the pack changes rather
 * than silently keeping something new.
 */

import { compactPrimitive } from '@gltf-transform/functions';

export class SubsetError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Remove every node whose name contains one of `patterns`, and everything
 * under it.
 *
 * @param {import('@gltf-transform/core').Document} document
 * @param {string[] | null} patterns  case-insensitive substrings
 * @returns {{dropped: string[]}}
 */
export function dropNodes(document, patterns) {
  if (!patterns?.length) return { dropped: [] };

  const wanted = patterns.map((p) => p.toLowerCase());
  const dropped = [];
  const matchedPattern = new Set();

  for (const node of document.getRoot().listNodes()) {
    const name = (node.getName() ?? '').toLowerCase();
    const hit = wanted.find((p) => name.includes(p));
    if (!hit) continue;

    matchedPattern.add(hit);
    dropped.push(node.getName());

    // Detach the whole branch, not just this node — its children are the
    // meshes, and orphaning them would leave the geometry in the file for
    // `prune` to argue about later.
    detach(node);
  }

  // A pattern that matches nothing means the pack has changed under us, or the
  // name was mistyped. Either way the build would quietly ship the thing the
  // sidecar was written to remove.
  const missed = wanted.filter((p) => !matchedPattern.has(p));
  if (missed.length) {
    throw new SubsetError(
      'STD_SUBSET',
      `dropNodes matched nothing for: ${missed.join(', ')}. ` +
        `Present: ${document.getRoot().listNodes().map((n) => n.getName()).filter(Boolean).slice(0, 12).join(', ')}…`
    );
  }

  return { dropped };
}

/**
 * The other way round: keep only the named meshes out of a pack of many.
 *
 * A scanned fruit pack is sixteen fruits in one file, laid out for a product
 * shot. A lesson wants the apple. Listing fifteen things to drop would break
 * the day the pack gains a seventeenth, so this names what stays.
 *
 * Names are matched exactly, not as substrings: "Potato" must not also keep
 * "Russet Potato". Only mesh-bearing nodes are judged; the empty parents that
 * hold them are structure and stay.
 *
 * @param {import('@gltf-transform/core').Document} document
 * @param {string[] | null} names  exact node names to keep
 * @returns {{kept: string[], dropped: string[]}}
 */
export function keepNodes(document, names) {
  if (!names?.length) return { kept: [], dropped: [] };

  const wanted = new Set(names);
  const kept = [];
  const dropped = [];

  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;

    if (wanted.has(node.getName())) {
      kept.push(node.getName());
      continue;
    }

    dropped.push(node.getName());
    detach(node);
  }

  const missed = names.filter((name) => !kept.includes(name));
  if (missed.length) {
    throw new SubsetError(
      'STD_SUBSET',
      `keepNodes found no mesh named: ${missed.join(', ')}. Present: ${[...kept, ...dropped].slice(0, 20).join(', ')}…`
    );
  }

  return { kept, dropped };
}

/**
 * Finer than a node: keep only the loose pieces of a mesh that sit inside a box.
 *
 * "Sliced apple" is one mesh holding a whole apple and its two halves, laid
 * side by side for the picture. No node name separates them, so `keepNodes`
 * cannot. But they do not touch — and pieces that do not touch can be told
 * apart by where they are.
 *
 * `box` gives a range per axis in the file's own units, before the contract
 * scales anything: `{ "x": [null, 0.9] }` keeps every piece whose centre is
 * left of x = 0.9. A stalk and a leaf count as pieces too, which is why this
 * asks where a piece IS rather than how big it is — the stalk goes with the
 * apple it stands on.
 *
 * @param {import('@gltf-transform/core').Document} document
 * @param {Record<'x'|'y'|'z', [number|null, number|null]> | null} box
 * @returns {{kept: number, dropped: number}}
 */
export function keepPieces(document, box) {
  if (!box) return { kept: 0, dropped: 0 };

  const ranges = ['x', 'y', 'z'].map((axis) => box[axis] ?? [null, null]);
  let kept = 0;
  let dropped = 0;

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    const world = node.getWorldMatrix();

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      const count = position.getCount();
      const indices = primitive.getIndices();
      const corner = (i) => (indices ? indices.getScalar(i) : i);
      const corners = indices ? indices.getCount() : count;

      // Vertices are doubled along every texture seam, so "shares a vertex"
      // would cut one apple into its UV islands. Same place, same vertex.
      const parent = new Int32Array(count);
      const seen = new Map();
      const point = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        position.getElement(i, point);
        const key = `${Math.round(point[0] * 1e4)},${Math.round(point[1] * 1e4)},${Math.round(point[2] * 1e4)}`;
        const first = seen.get(key);
        if (first === undefined) seen.set(key, i);
        parent[i] = first ?? i;
      }
      const find = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      };
      for (let i = 0; i < corners; i += 3) {
        const a = find(corner(i));
        parent[find(corner(i + 1))] = a;
        parent[find(corner(i + 2))] = a;
      }

      const pieces = new Map();
      for (let i = 0; i < count; i++) {
        position.getElement(i, point);
        const at = [0, 1, 2].map(
          (k) => world[k] * point[0] + world[4 + k] * point[1] + world[8 + k] * point[2] + world[12 + k]
        );
        const root = find(i);
        const piece = pieces.get(root) ?? { min: [...at], max: [...at] };
        for (let k = 0; k < 3; k++) {
          piece.min[k] = Math.min(piece.min[k], at[k]);
          piece.max[k] = Math.max(piece.max[k], at[k]);
        }
        pieces.set(root, piece);
      }

      const wanted = new Set();
      for (const [root, piece] of pieces) {
        const inside = ranges.every(([low, high], k) => {
          const centre = (piece.min[k] + piece.max[k]) / 2;
          return (low === null || centre >= low) && (high === null || centre <= high);
        });
        if (inside) wanted.add(root);
        inside ? (kept += 1) : (dropped += 1);
      }

      const keep = [];
      for (let i = 0; i < corners; i += 3) {
        if (wanted.has(find(corner(i)))) keep.push(corner(i), corner(i + 1), corner(i + 2));
      }

      const Index = count > 65535 ? Uint32Array : Uint16Array;
      primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Index(keep)));

      // The dropped pieces' vertices are still in the buffer, and the bounding
      // box is measured from the buffer.
      compactPrimitive(primitive);
    }
  }

  if (!kept) {
    throw new SubsetError('STD_SUBSET', `keepPieces kept nothing — no piece has its centre inside ${JSON.stringify(box)}.`);
  }

  return { kept, dropped };
}

function detach(node) {
  for (const child of node.listChildren()) detach(child);
  node.dispose();
}
