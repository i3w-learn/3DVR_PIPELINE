/**
 * Builder registry.
 *
 * A builder turns parameters into geometry: `build: "building"` with
 * `{ floors: 3, windows: 7 }` becomes a school. It knows nothing about which
 * lesson placed it or what that lesson teaches.
 *
 * Importing a builder registers its A-Frame component as a side effect, so
 * this file exists to be imported once, by `main.js`. Adding a builder is:
 * write the file, add one line here.
 *
 * `built.js` and `merge-boxes.js` are not listed — they register nothing.
 * They are the shared helpers the builders below import directly.
 */

import './blackboard.js';
import './building.js';
import './door.js';
import './flagpole.js';
import './furniture.js';
import './gate.js';
import './lab.js';
import './path.js';
import './playground.js';
import './portal.js';
import './room.js';
import './space.js';
import './wall.js';
