/**
 * Template lookup.
 *
 * `lesson-sync` asks for a template by name and calls the three methods it
 * gets back. It never branches on which template it received — no
 * `if (template === 'count')` anywhere — so the seven templates and a future
 * fifteen are the same code path.
 *
 * Adding a template is: write the file, add one line here.
 *
 * What the seven have in common lives in `scene.js`, not here. This file is a
 * lookup table and nothing else.
 */

import compare from './compare.js';
import count from './count.js';
import explore from './explore.js';
import identify from './identify.js';
import match from './match.js';
import sequence from './sequence.js';
import sort from './sort.js';

const TEMPLATES = {
  [identify.name]: identify,
  [explore.name]: explore,
  [compare.name]: compare,
  [count.name]: count,
  [match.name]: match,
  [sort.name]: sort,
  [sequence.name]: sequence,
};

export function getTemplate(name) {
  const template = TEMPLATES[name];

  if (!template) {
    throw new Error(
      `Unknown template "${name}". Known: ${Object.keys(TEMPLATES).join(', ') || 'none'}`
    );
  }

  return template;
}
