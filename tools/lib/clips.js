/**
 * Dropping animation clips a lesson will never play.
 *
 * The CC0 animal packs ship thirteen clips each — Attack_Headbutt, Death,
 * Gallop_Jump and so on. A pre-primary lesson uses two or three. The rest is
 * keyframe data for every bone, and it dominates the file.
 *
 * The trap, learned the hard way: clips of equal length SHARE their keyframe
 * accessors. Disposing an unwanted clip's accessors directly also destroys the
 * data a kept clip was pointing at, and the model then fails to load with
 * "Cannot read properties of undefined (reading 'bufferView')" — a message
 * that names nothing useful.
 *
 * So this never touches accessors. It disposes channels, samplers and the
 * animation itself, then lets `prune` decide which accessors are genuinely
 * unreferenced. That is the whole difference between a model that loads and
 * one that does not.
 */

import { PropertyType } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

export class ClipError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Keep only the named clips, and reclaim the keyframe data behind the rest.
 *
 * @param {import('@gltf-transform/core').Document} document
 * @param {string[] | null} keep  clip names to keep; null keeps everything
 * @returns {Promise<{kept: string[], dropped: string[]}>}
 */
export async function keepOnlyClips(document, keep) {
  const animations = document.getRoot().listAnimations();
  const present = animations.map((a) => a.getName());

  if (!keep) return { kept: present, dropped: [] };

  // A typo in a sidecar would silently ship a model that cannot move, so a
  // clip that was asked for and does not exist is an error, not a warning.
  const missing = keep.filter((name) => !present.includes(name));
  if (missing.length) {
    throw new ClipError(
      'STD_CONTRACT',
      `Clip(s) not in this model: ${missing.join(', ')}. Available: ${present.join(', ')}.`
    );
  }

  const wanted = new Set(keep);
  const dropped = [];

  for (const animation of animations) {
    if (wanted.has(animation.getName())) continue;

    dropped.push(animation.getName());

    // Channels first: they reference the samplers. Nothing here touches an
    // accessor — see the note above.
    for (const channel of animation.listChannels()) channel.dispose();
    for (const sampler of animation.listSamplers()) sampler.dispose();

    animation.dispose();
  }

  // Now that nothing points at them, unreferenced keyframe accessors can go.
  // The default prune does not include accessors, so they are named explicitly.
  if (dropped.length) {
    await document.transform(prune({ propertyTypes: [PropertyType.ACCESSOR] }));
  }

  return { kept: keep, dropped };
}

/**
 * Keep an animal on its spot while its clip plays.
 *
 * Some clips carry the animal along as well as moving its limbs: the sea
 * turtle's swim cycle swims it four metres off and snaps it back. In a lesson
 * the *lesson* decides where a thing is — `wander` walks it, a position places
 * it — so a clip that also moves it puts the turtle somewhere the ring and the
 * name card are not.
 *
 * Dropping the translation track of the named bones leaves them at their rest
 * position; every rotation, which is the swimming, is untouched.
 *
 * @param {import('@gltf-transform/core').Document} document
 * @param {string[] | null} bones  node names whose translation tracks to drop
 * @returns {string[]} the bones that were actually held
 */
export function holdInPlace(document, bones) {
  if (!bones?.length) return [];

  const wanted = new Set(bones);
  const held = new Set();

  for (const animation of document.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const name = channel.getTargetNode()?.getName();
      if (channel.getTargetPath() !== 'translation' || !wanted.has(name)) continue;

      channel.dispose();
      held.add(name);
    }
  }

  const missing = bones.filter((name) => !held.has(name));
  if (missing.length) {
    throw new ClipError('STD_CONTRACT', `inPlace names bone(s) with no translation track: ${missing.join(', ')}.`);
  }

  return [...held];
}
