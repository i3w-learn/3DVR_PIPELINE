/**
 * Reading and writing glTF/GLB files.
 *
 * One job: hand the rest of the pipeline a Document, and write one back.
 * Nothing here knows what a lesson or a stage is.
 */

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

let io;

/**
 * A NodeIO configured with every standard extension and with the Draco
 * codecs, so it can read compressed input and write compressed output.
 *
 * Built once and reused — the Draco WASM modules are expensive to load.
 */
export async function getIO() {
  if (io) return io;

  io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  return io;
}

export async function readDocument(file) {
  const document = await (await getIO()).read(file);

  // gltf-transform's transforms narrate what they removed. Useful when
  // debugging a single model, noise when standardising sixty, and the tools
  // print their own summary line either way.
  document.setLogger(new Logger(Logger.Verbosity.ERROR));

  return document;
}

export async function writeDocument(document, file) {
  return (await getIO()).write(file, document);
}
