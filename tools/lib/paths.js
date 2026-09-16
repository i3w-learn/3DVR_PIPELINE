/**
 * The folder contract, in one place.
 *
 * Every tool asks this module where things live. Nothing else in the pipeline
 * hardcodes a directory name, so moving a folder is a one-line change here
 * instead of a grep across the repo.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §2.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Repository root — tools/lib/ is two levels down. */
export const ROOT = path.resolve(HERE, '..', '..');

/**
 * The web root, and therefore everything that ships.
 *
 * /app is what Bubblewrap wraps and what the service worker caches. Anything
 * outside it — /raw, /tools, /node_modules — is build-time only and never
 * reaches a headset.
 */
export const APP_DIR = path.join(ROOT, 'app');

/** Every written document lives here, including the generated ones. */
export const DOCS_DIR = path.join(ROOT, 'docs');

/** Untouched downloads plus their sidecars. Committed, never shipped. */
export const RAW_DIR = path.join(ROOT, 'raw');

/** Standardised, shipped assets. Nothing is hand-copied in here. */
export const ASSETS_DIR = path.join(APP_DIR, 'assets');
export const MODELS_DIR = path.join(ASSETS_DIR, 'models');
export const TEXTURES_DIR = path.join(ASSETS_DIR, 'textures');
export const AUDIO_DIR = path.join(ASSETS_DIR, 'audio');

/** Captured skies: backdrop and scene lighting in one image. */
export const HDRI_DIR = path.join(ASSETS_DIR, 'hdri');

/** Animal sounds and other effects. Not narration — narration is per language. */
export const SFX_DIR = path.join(ASSETS_DIR, 'sfx');

/** The generated asset catalogue. Never hand-edited. */
export const LIBRARY_FILE = path.join(ASSETS_DIR, 'library.json');

/** Reusable stage kits — the land, and the props dressed onto it. */
export const STAGES_DIR = path.join(APP_DIR, 'stages');

/** Lesson recipes. JSON only. */
export const LESSONS_DIR = path.join(APP_DIR, 'lessons');

/** Scratch space for the intermediate file between contract and compression. */
export const WORK_DIR = path.join(ROOT, '.work');

/** Path to a raw download and to its hand-written sidecar. */
export const rawModel = (id) => path.join(RAW_DIR, `${id}.glb`);
export const rawSidecar = (id) => path.join(RAW_DIR, `${id}.meta.json`);

/** Path to a standardised model. */
export const shippedModel = (id) => path.join(MODELS_DIR, `${id}.glb`);

/** Path to a stage kit and to a lesson recipe. */
export const stageFile = (id) => path.join(STAGES_DIR, `${id}.json`);
export const lessonFile = (id) => path.join(LESSONS_DIR, `${id}.json`);

/** Repo-relative path, for messages and for the library manifest. */
export const relative = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
