/**
 * Lowering the arms of a figure that arrived standing like a scarecrow.
 *
 * Rigged people are modelled in a T-pose — arms straight out — because that is
 * the easiest shape to attach a skeleton to. A model that ships with a real
 * animation never shows it. One that ships with none stands in the classroom
 * with its arms out for the whole lesson.
 *
 * This bends the two upper-arm bones down to the figure's sides, once, at
 * intake. It works in world space — find which way the arm points, find the
 * same direction tipped towards the ground, turn the bone by the difference —
 * so it does not need to know which way the bone's own axes run, which differs
 * from one rigging tool to the next.
 *
 * Any animation track on those two bones is dropped, or the clip (usually a
 * single frame of the T-pose itself) would put the arms straight back.
 */

export class PoseError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Upper arm, not forearm: Mixamo's `LeftArm`, Blender's `upper_arm.L`, with or without an export suffix. */
const UPPER_ARM = /(?:^|[:_.\s])(?:left|right|l|r)?[_.\s]?(?:upper[_.\s]?arm|arm)(?:[_.\s]?(?:left|right|l|r))?(?:_\d+)?$/i;
const FOREARM = /fore|lower/i;

/**
 * @param {import('@gltf-transform/core').Document} document
 * @param {number | null} degrees  how far below the horizontal the arms should hang; ~72 is relaxed
 * @returns {string[]} the bones that were turned
 */
export function lowerArms(document, degrees) {
  if (degrees == null) return [];

  const root = document.getRoot();
  const joints = new Set(root.listSkins().flatMap((skin) => skin.listJoints()));
  const arms = [...joints].filter((node) => UPPER_ARM.test(node.getName()) && !FOREARM.test(node.getName()));

  if (arms.length !== 2) {
    throw new PoseError(
      'STD_CONTRACT',
      `armsDown needs exactly two upper-arm bones and found ${arms.length}: ${arms.map((n) => n.getName()).join(', ') || 'none'}.`
    );
  }

  const tilt = (degrees * Math.PI) / 180;

  for (const arm of arms) {
    const elbow = arm.listChildren().find((child) => joints.has(child));
    if (!elbow) throw new PoseError('STD_CONTRACT', `Arm bone ${arm.getName()} has no child bone to aim by.`);

    const from = normalise(subtract(elbow.getWorldTranslation(), arm.getWorldTranslation()));
    const flat = normalise([from[0], 0, from[2]]);
    const to = [flat[0] * Math.cos(tilt), -Math.sin(tilt), flat[2] * Math.cos(tilt)];

    // new local = parent⁻¹ · turn · world
    const parent = arm.getParentNode();
    const parentWorld = parent ? parent.getWorldRotation() : [0, 0, 0, 1];
    arm.setRotation(multiply(multiply(conjugate(parentWorld), between(from, to)), arm.getWorldRotation()));
  }

  const posed = new Set(arms);
  for (const animation of root.listAnimations()) {
    for (const channel of animation.listChannels()) {
      if (posed.has(channel.getTargetNode()) && channel.getTargetPath() === 'rotation') channel.dispose();
    }
  }

  return arms.map((node) => node.getName());
}

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const normalise = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const conjugate = ([x, y, z, w]) => [-x, -y, -z, w];

function multiply([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** The shortest turn that carries unit vector `a` onto unit vector `b`. */
function between(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const q = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 1 + dot];
  const l = Math.hypot(...q) || 1;
  return q.map((x) => x / l);
}
