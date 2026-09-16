/**
 * Validation rules, as data.
 *
 * Each rule is an object with an id, a one-line title, and a `check` that
 * returns a list of problems (empty means it passed). The runner knows nothing
 * about any individual rule — it iterates this array.
 *
 * That is the Open/Closed part: adding rule L15 is adding one entry here, with
 * no change to validate-lessons.js. Removing a rule is deleting an entry. No
 * rule can accidentally depend on the order of another, because none of them
 * can see each other.
 *
 * See docs/CONTENT-CREATION-PIPELINE.md §12.6.
 */

/** Budgets. Every one of these except frame rate is decidable on a laptop. */
export const BUDGET = {
  triangles: 150_000,
  drawCalls: 100,
  bytes: 40_000_000,
  distinctProps: 4,
  minStepDuration: 1000, // ms
};

export const TEMPLATES = ['identify', 'count', 'match', 'sequence', 'explore'];

/** A-Frame vec3 strings: "x y z", decimals and negatives allowed. */
const VEC3 = /^-?\d+(\.\d+)?( -?\d+(\.\d+)?){2}$/;

/**
 * Every rule receives the same context object:
 *
 *   lesson         the parsed recipe
 *   lessonId       filename stem
 *   kit            the stage kit named by the lesson
 *   resolvedStage  kit merged with stageOverride
 *   library        assets/library.json
 *   languages      audio language folders we ship
 *   instances      every placement: stage props + lesson objects
 */
export const RULES = [
  {
    id: 'VAL_L2',
    title: 'lesson id matches its filename',
    check: ({ lesson, lessonId }) =>
      lesson.id === lessonId ? [] : [`id is "${lesson.id}" but the file is ${lessonId}.json`],
  },

  {
    id: 'VAL_L3',
    title: 'template is one of the five',
    check: ({ lesson }) =>
      TEMPLATES.includes(lesson.template)
        ? []
        : [`template "${lesson.template}" is not one of ${TEMPLATES.join(', ')}`],
  },

  {
    id: 'VAL_L4',
    title: 'every model reference exists in the library',
    check: ({ instances, library }) =>
      instances
        .filter((i) => !library.models[i.model])
        .map((i) => `${i.where} names model "${i.model}", which is not in the library`),
  },

  {
    id: 'VAL_L5',
    title: 'every clip exists on the model that plays it',
    check: ({ instances, library }) =>
      instances.flatMap((i) => {
        if (!i.clip) return [];

        const model = library.models[i.model];
        if (!model) return []; // L4 already reported this

        if (!model.rigged) return [`${i.where} plays a clip but "${i.model}" has no skeleton`];

        return model.clips.includes(i.clip)
          ? []
          : [`${i.where} plays "${i.clip}"; ${i.model} has ${model.clips.join(', ')}`];
      }),
  },

  {
    id: 'VAL_L6',
    title: 'highlight and visibility name real objects',
    check: ({ lesson }) => {
      const ids = new Set(lesson.objects.map((o) => o.id));
      const problems = [];

      lesson.objects.forEach((o, i) => {
        if (!o.id) problems.push(`objects[${i}] has no id`);
      });

      if (ids.size !== lesson.objects.length) {
        problems.push('two objects share an id — ids must be unique within a lesson');
      }

      lesson.steps.forEach((step, i) => {
        // `explore` steps are invitations, not instructions — they highlight
        // nothing, because the child chooses.
        if (step.highlight && !ids.has(step.highlight)) {
          problems.push(`steps[${i}] highlights "${step.highlight}", which is not an object`);
        }
        for (const key of Object.keys(step.visible ?? {})) {
          if (!ids.has(key)) {
            problems.push(`steps[${i}].visible names "${key}", which is not an object`);
          }
        }
      });

      return problems;
    },
  },

  {
    id: 'VAL_L7',
    title: 'narration exists in every language we ship',
    check: ({ lesson, library, languages }) => {
      // Two places, because the templates differ: `identify` speaks per step,
      // `explore` speaks per object. A missing file is the same failure either
      // way — a lesson that plays silence.
      const named = [
        ...lesson.steps.map((step, i) => [step.audio, `steps[${i}]`]),
        ...lesson.objects.map((o) => [o.audio, `object "${o.id}"`]),
      ];

      return named.flatMap(([audio, where]) => {
        if (!audio) return []; // teacher reads `script` instead — allowed

        return languages
          .filter((lang) => !library.audio[lang]?.[audio])
          .map((lang) => `${where} needs audio/${lang}/${audio}, which is missing`);
      });
    },
  },

  {
    id: 'VAL_L15',
    title: 'every sound effect an object names exists',
    check: ({ lesson, library }) =>
      lesson.objects
        .filter((o) => o.sound && !library.sfx?.[o.sound])
        .map((o) => `object "${o.id}" names sfx/${o.sound}, which is not in the library`),
  },

  {
    id: 'VAL_L8',
    title: 'steps last long enough to be understood',
    check: ({ lesson }) =>
      lesson.steps
        .map((step, i) =>
          typeof step.duration === 'number' && step.duration >= BUDGET.minStepDuration
            ? null
            : `steps[${i}] duration is ${step.duration}; minimum is ${BUDGET.minStepDuration} ms`
        )
        .filter(Boolean),
  },

  {
    id: 'VAL_L9',
    title: 'triangle budget',
    check: ({ instances, library, resolvedStage }) => {
      // Every placement counts. A tree used five times is five times the
      // geometry on screen: A-Frame does not instance gltf-model entities.
      const geometry = instances.reduce(
        (sum, i) => sum + (library.models[i.model]?.triangles ?? 0),
        0
      );

      // Only shadow casters are drawn twice. A prop with `castShadow: false`
      // is submitted once, which is the whole point of turning it off.
      const casting = instances.reduce(
        (sum, i) => (i.raw.castShadow === false ? sum : sum + (library.models[i.model]?.triangles ?? 0)),
        0
      );

      // A shadow-casting scene renders its casters a second time, from the
      // sun's point of view. The renderer's own counter shows that doubling and
      // this check has to as well, or a lesson passes on a laptop and breaches
      // on the device. Kits with `shadows: false` pay it once.
      // A caster is drawn twice — once for the camera, once for the shadow
      // map — and both are counted by the renderer. The earlier 0.8 factor was
      // a guess that ran 25% under what the device actually saw.
      const total = resolvedStage.shadows === false ? geometry : geometry + casting;

      return total <= BUDGET.triangles
        ? []
        : [
            `${total.toLocaleString()} triangles on screen ` +
              `(${geometry.toLocaleString()} of geometry${resolvedStage.shadows === false ? '' : ' + shadow pass'}); ` +
              `budget is ${BUDGET.triangles.toLocaleString()}`,
          ];
    },
  },

  {
    id: 'VAL_L10',
    title: 'draw-call budget (proxy)',
    check: ({ instances, library }) => {
      // A proxy, not a promise: one primitive is roughly one draw call, but
      // the renderer decides. 72 fps is only ever measured on the headset.
      const meshes = instances.reduce((sum, i) => sum + (library.models[i.model]?.meshes ?? 0), 0);
      const ground = 1;
      const highlightRing = 1;
      const total = meshes + ground + highlightRing;

      return total <= BUDGET.drawCalls
        ? []
        : [`${total} draw calls (proxy); budget is ${BUDGET.drawCalls}`];
    },
  },

  {
    id: 'VAL_L11',
    title: 'lesson bundle size',
    check: ({ instances, library, resolvedStage, lesson, languages }) => {
      const files = new Set();
      let bytes = 0;

      const add = (record) => {
        if (!record || files.has(record.file)) return;
        files.add(record.file);
        bytes += record.bytes;
      };

      for (const i of instances) add(library.models[i.model]);

      // A ground is a set of maps, not one image. Older kits name a single
      // file; both forms count toward the same budget. A land may also have no
      // ground at all — there is nothing to stand on in space.
      const ground = resolvedStage.ground;
      const maps = !ground
        ? []
        : typeof ground === 'string'
          ? [ground]
          : [ground.color, ground.normal, ground.rough, ground.ao].filter(Boolean);
      for (const map of maps) add(library.textures[map]);

      // Anything a prop or an object names by file path — the planet maps are
      // the first of these. Built props carry their pictures in `params`, and
      // a picture nobody counted is a picture that still has to be downloaded.
      for (const holder of [...(resolvedStage.props ?? []), ...lesson.objects]) {
        const src = holder.params?.src;
        if (typeof src === 'string') add(library.planets?.[src.split('/').pop()]);
      }
      for (const object of lesson.objects) add(library.sfx?.[object.sound]);

      // The captured sky is usually the single largest file in a lesson.
      if (resolvedStage.sky?.hdri) add(library.hdri?.[resolvedStage.sky.hdri]);

      for (const step of lesson.steps) {
        if (!step.audio) continue;
        for (const lang of languages) add(library.audio[lang]?.[step.audio]);
      }

      return bytes <= BUDGET.bytes
        ? []
        : [`${(bytes / 1e6).toFixed(1)} MB of assets; budget is ${BUDGET.bytes / 1e6} MB`];
    },
  },

  {
    id: 'VAL_L12',
    title: 'distinct prop models in a stage kit',
    check: ({ kit }) => {
      // Reuse is the rule: one tree model at five positions and scales reads
      // as five trees. A fifth distinct prop means rethink the scene.
      const distinct = new Set(kit.props.map((p) => p.model));

      return distinct.size <= BUDGET.distinctProps
        ? []
        : [
            `stage "${kit.id}" uses ${distinct.size} distinct prop models ` +
              `(${[...distinct].join(', ')}); limit is ${BUDGET.distinctProps}`,
          ];
    },
  },

  {
    id: 'VAL_L13',
    title: 'stageOverride does not replace props',
    check: ({ lesson }) =>
      lesson.stageOverride?.props
        ? ['stageOverride.props is not allowed — change the kit or add lesson objects']
        : [],
  },

  {
    id: 'VAL_L14',
    title: 'positions, rotations and scales are A-Frame vec3 strings',
    check: ({ instances }) =>
      instances.flatMap((i) =>
        ['position', 'rotation', 'scale']
          .filter((field) => i.raw[field] !== undefined && !VEC3.test(String(i.raw[field])))
          .map(
            (field) =>
              `${i.where} has ${field}: ${JSON.stringify(i.raw[field])} — expected "x y z"`
          )
      ),
  },
];
