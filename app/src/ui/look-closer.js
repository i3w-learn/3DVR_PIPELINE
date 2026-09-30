/**
 * A close look at a few objects, for whoever is checking a lesson.
 *
 * A new model goes into a lesson at a guessed size and turn, and the only way
 * to know it is right is to look — from where the child sits, and close up.
 * Walking the camera there by hand, for eighty objects, is how a mistake gets
 * waved through. This draws the pictures instead: one close-up of each named
 * object, and the whole set from the child's seat, laid out over the page.
 *
 * Reviewer only. It answers `&look=apple,pear` on a teacher-mode address and
 * has no part in a lesson; nothing here runs in a headset.
 *
 *   ?lesson=eng-nur-fruits&role=teacher&look=apple,pear
 *   ?lesson=eng-nur-fruits&role=teacher&look=all       every object with a model
 *
 * Objects not named are hidden while the pictures are taken, so a new thing
 * can be seen on its own; then everything is put back.
 */

const CLOSE_FOV = 50;
const SEAT_FOV = 60;
/** How far back the close-up camera stands, in the object's own longest side. */
const REACH = 1.7;

/**
 * Wait until the lesson is on the stage and every model in it has a mesh, up
 * to a limit. The teacher role builds the stage when the first state message
 * arrives, a beat after it has started, so "started" is too early to look.
 */
async function settled(stageEl) {
  for (let i = 0; i < 80; i += 1) {
    const objects = [...stageEl.children].filter((el) => el.id && !el.classList.contains('prop'));
    const waiting = [...stageEl.querySelectorAll('[gltf-model]')].filter((el) => !el.getObject3D('mesh'));
    if (objects.length && !waiting.length) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  // Textures and shadows take another beat after the meshes are in.
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

/**
 * @param {Element} sceneEl  the `<a-scene>`
 * @param {string} which     comma-separated object ids, or "all"
 */
export async function lookCloser(sceneEl, which) {
  const THREE = AFRAME.THREE;
  const stageEl = document.querySelector('#stage');
  await settled(stageEl);

  const objects = [...stageEl.children].filter((el) => el.id && !el.classList.contains('prop'));
  const ids = which === 'all' ? objects.filter((el) => el.hasAttribute('gltf-model')).map((el) => el.id) : which.split(',');
  const wanted = ids.map((id) => document.getElementById(id)).filter(Boolean);
  if (!wanted.length) return;

  const renderer = sceneEl.renderer;
  const canvas = renderer.domElement;
  const camera = new THREE.PerspectiveCamera(CLOSE_FOV, canvas.width / canvas.height, 0.01, 500);
  const seat = new THREE.Vector3();
  sceneEl.camera.getWorldPosition(seat);

  const shown = new Map(objects.map((el) => [el, el.object3D.visible]));
  const only = (keep) => {
    for (const el of objects) el.object3D.visible = keep.includes(el);
  };
  const snap = (label) => {
    camera.updateMatrixWorld(true);
    renderer.render(sceneEl.object3D, camera);
    return { label, url: canvas.toDataURL('image/jpeg', 0.85) };
  };

  const pictures = [];
  const centre = new THREE.Vector3();
  const notes = [];

  for (const el of wanted) {
    only([el]);
    el.object3D.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(el.getObject3D('mesh') ?? el.object3D, true);
    const size = box.getSize(new THREE.Vector3());
    const middle = box.getCenter(new THREE.Vector3());
    centre.add(middle);
    notes.push(`${el.id}: ${size.x.toFixed(2)} wide, ${size.y.toFixed(2)} tall, ${size.z.toFixed(2)} deep, base at y = ${box.min.y.toFixed(2)}`);

    // From the child's side, a little above, near enough to fill the frame.
    const reach = Math.max(size.x, size.y, size.z) * REACH + 0.05;
    const towards = seat.clone().sub(middle).setY(0).normalize();
    camera.fov = CLOSE_FOV;
    camera.updateProjectionMatrix();
    camera.position.copy(middle).addScaledVector(towards, reach).add(new THREE.Vector3(0, reach * 0.45, 0));
    camera.lookAt(middle);
    pictures.push(snap(`${el.id} — close`));
  }

  only(wanted);
  centre.multiplyScalar(1 / wanted.length);
  camera.fov = SEAT_FOV;
  camera.updateProjectionMatrix();
  camera.position.copy(seat);
  camera.lookAt(centre);
  pictures.push(snap("from the child's seat"));

  for (const [el, visible] of shown) el.object3D.visible = visible;

  show(pictures, notes);
}

function show(pictures, notes) {
  document.querySelector('#look-closer')?.remove();

  const sheet = document.createElement('div');
  sheet.id = 'look-closer';
  // Two across for a few pictures, four for a whole lesson; the pictures stay
  // as large as the page allows either way.
  const columns = pictures.length <= 4 ? 2 : pictures.length <= 9 ? 3 : 4;
  const rows = Math.ceil(pictures.length / columns);
  sheet.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#111;display:grid;gap:2px;' +
    `grid-template-columns:repeat(${columns},1fr);grid-auto-rows:${100 / rows}%;cursor:pointer`;
  sheet.title = 'Click to close';
  sheet.addEventListener('click', () => sheet.remove());

  for (const picture of pictures) {
    const cell = document.createElement('div');
    cell.style.cssText = `background:url(${picture.url}) center/contain no-repeat #111;position:relative`;
    const tag = document.createElement('span');
    tag.textContent = picture.label;
    tag.style.cssText = 'position:absolute;left:6px;top:4px;font:600 15px sans-serif;color:#fff;background:#000a;padding:2px 6px';
    cell.append(tag);
    sheet.append(cell);
  }

  const sizes = document.createElement('pre');
  sizes.textContent = notes.join('\n');
  sizes.style.cssText = 'position:absolute;right:8px;bottom:6px;margin:0;font:12px monospace;color:#fff;background:#000a;padding:6px 8px';
  sheet.append(sizes);

  document.body.append(sheet);
}
