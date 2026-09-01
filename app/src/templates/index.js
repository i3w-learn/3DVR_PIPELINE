/**
 * Template lookup.
 *
 * `lesson-sync` asks for a template by name and calls the three methods it
 * gets back. It never branches on which template it received — no
 * `if (template === 'count')` anywhere — so the five templates and a future
 * fifteen are the same code path.
 *
 * Adding a template is: write the file, add one line here.
 */

import explore from './explore.js';
import identify from './identify.js';

const TEMPLATES = {
  [identify.name]: identify,
  [explore.name]: explore,
  // count, match and sequence land here as they are built.
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
