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
