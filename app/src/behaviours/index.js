/**
 * Behaviour registry.
 *
 * A behaviour makes something act: an animal wanders, a highlight pulses, a
 * door opens when you approach, the view fades between viewpoints. Behaviours
 * attach to whatever a builder or a lesson has already placed — they never
 * create geometry themselves.
 *
 * Importing a behaviour registers its A-Frame component as a side effect.
 * Adding one is: write the file, add one line here.
 */

import './auto-open.js';
import './highlight.js';
import './natural-idle.js';
import './preview-move.js';
import './scene-look.js';
import './tap-target.js';
import './view-fade.js';
import './viewer-rig.js';
import './wander.js';
