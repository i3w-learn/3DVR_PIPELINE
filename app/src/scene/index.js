/**
 * Scene registry.
 *
 * Scene components are the world a lesson happens inside: the ground, the sky,
 * the shadow under a model, the rule that a model's feet meet y = 0. They are
 * the stage's business, not the lesson's — no scene component ever knows what
 * is being taught.
 *
 * Importing one registers its A-Frame component as a side effect. Adding one
 * is: write the file, add one line here.
 */

import './contact-shadow.js';
import './pbr-ground.js';
import './seat-on-ground.js';
import './sky-environment.js';
