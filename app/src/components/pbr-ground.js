/**
 * The ground, as a real surface rather than a coloured plane.
 *
 * A-Frame's standard material does not expose everything three.js can do with
 * a ground, and two of the things it leaves out are the two that decide whether
 * 140 metres of grass reads as a field or as green paper:
 *
 * **Anisotropic filtering.** A ground plane is seen almost edge-on. Without
 * anisotropy the far half of it blurs into a smear — the single most obvious
 * "this is a game" artefact there is. With it, the texture holds detail all
 * the way to the horizon. It costs nothing but a sampler flag.
 *
 * **The normal map.** Light catching individual blades instead of one flat
 * sheet. Under a moving sun it is the difference between a surface and a decal.
 *
 * Colour space matters and is easy to get wrong: the colour map is sRGB
 * because it is a picture, and the normal and roughness maps are linear because
 * they are numbers. Marking a normal map as sRGB bends every surface normal.
 */

const loader = new THREE.TextureLoader();

AFRAME.registerComponent('pbr-ground', {
  schema: {
    color: { type: 'string' },
    normal: { type: 'string', default: '' },
    rough: { type: 'string', default: '' },
    ao: { type: 'string', default: '' },
    repeat: { type: 'number', default: 45 },
    /** Bump strength. Above ~1.5 the grass starts to look like gravel. */
    normalScale: { type: 'number', default: 0.9 },
  },

  init() {
    this.material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    this.breakUpTiling();
    this.textures = [];
    this.el.addEventListener('object3dset', () => this.attach());
    this.attach();
  },

  update() {
    const { data } = this;
    const base = 'assets/textures/';

    this.disposeTextures();

    this.material.map = this.load(base + data.color, THREE.SRGBColorSpace);
    this.material.normalMap = data.normal ? this.load(base + data.normal) : null;
    this.material.roughnessMap = data.rough ? this.load(base + data.rough) : null;
    this.material.aoMap = data.ao ? this.load(base + data.ao) : null;

    this.material.normalScale = new THREE.Vector2(data.normalScale, data.normalScale);
    this.material.needsUpdate = true;

    this.attach();
  },

  /**
   * Hide the repeat.
   *
   * One square metre of grass tiled fifty times across a field is fifty
   * identical squares, and the eye finds that grid immediately — it is the
   * "pattern" that gives a synthetic ground away long before the texture
   * resolution does.
   *
   * The fix is not a bigger texture. It is to vary the tile: sample the same
   * map a second time at a very different scale and rotation, and blend the
   * two by a slow noise. Where the blend favours one sample the grid lines up
   * with that scale; where it favours the other it does not; and no repeat
   * survives across the whole field.
   *
   * Injected with `onBeforeCompile` rather than written as a new shader, so
   * everything else three.js does for a standard material — the normal map,
   * the environment, the fog, the shadows — keeps working untouched.
   */
  breakUpTiling() {
    this.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>

          // Cheap value noise. Two octaves is enough: this only has to be
          // slow and irregular, not detailed.
          float gnoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
            float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
            float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
            float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
          }`
        )
        .replace(
          '#include <map_fragment>',
          `
          #ifdef USE_MAP
            vec2 uvA = vMapUv;
            // A second sample: rotated a third of a turn and at 40% of the
            // scale, so its grid shares no lines with the first.
            vec2 uvB = mat2(0.5, -0.866, 0.866, 0.5) * vMapUv * 0.41 + 0.37;

            float blend = smoothstep(0.35, 0.65, gnoise(vMapUv * 0.09));

            vec4 sampledDiffuseColor = mix(texture2D(map, uvA), texture2D(map, uvB), blend);
            diffuseColor *= sampledDiffuseColor;

            // A slow tint variation on top, so even the blended result is not
            // one flat green across a hundred metres. Real ground is patchy.
            diffuseColor.rgb *= 0.88 + 0.24 * gnoise(vMapUv * 0.035);
          #endif
          `
        );
    };
  },

  /**
   * @param {string} url
   * @param {THREE.ColorSpace} [colorSpace] omit for data maps — normal, roughness, AO
   */
  load(url, colorSpace) {
    const texture = loader.load(url);

    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(this.data.repeat, this.data.repeat);
    if (colorSpace) texture.colorSpace = colorSpace;

    const renderer = this.el.sceneEl.renderer;
    if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    this.textures.push(texture);
    return texture;
  },

  /** The AO map reads UV2, which a plane does not have until we give it one. */
  attach() {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh) return;

    mesh.material = this.material;

    const uv = mesh.geometry.getAttribute('uv');
    if (uv && !mesh.geometry.getAttribute('uv2')) {
      mesh.geometry.setAttribute('uv2', uv.clone());
    }
  },

  disposeTextures() {
    for (const texture of this.textures) texture.dispose();
    this.textures = [];
  },

  remove() {
    this.disposeTextures();
    this.material.dispose();
  },
});
