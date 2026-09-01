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

function detach(node) {
  for (const child of node.listChildren()) detach(child);
  node.dispose();
}
