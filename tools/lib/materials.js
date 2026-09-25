/**
 * Normalising materials to the project's art style.
 *
 * The style is decided and it is not per-asset: stylised low-poly, flat or
 * lightly shaded, natural colours. Two things arrive wrong and both are fixed
 * here rather than in the scene.
 *
 * **Metalness.** Kenney's glTF exports set `metallicFactor: 1` on every
 * material — a physically-based way of saying "this surface is a mirror". With
 * no environment map to reflect, a mirror is black, so a tree canopy renders
 * almost unlit. The failure reads as "the scene looks muddy" three weeks later
 * rather than as a material setting.
 *
 * **Palette.** Kenney's Nature Kit is deliberately teal and orange; Quaternius
 * animals are natural browns and greens. Neither is wrong on its own, and
 * together they are the single most visible quality failure available to this
 * project. A sidecar `palette` maps material names to the colours this project
 * uses, so a pack can be brought into the house style without opening Blender.
 *
 * **Alpha, and why foliage must not be blended.** A photoscanned tree's leaves
 * are flat cards with a cut-out texture, and exporters ship them as
 * `alphaMode: BLEND`. Blending is the expensive kind: it needs back-to-front
 * sorting, it writes no depth, and it lands the geometry in a second render
 * pass — one tree's 19,000 leaf triangles counted twice, which is most of the
 * gap between what this pipeline predicted and what the renderer drew.
 *
 * A leaf is not translucent. It is either there or it is not, which is exactly
 * what `alphaMode: MASK` describes: one cutoff, no sorting, no second pass,
 * and shadows that work. Set `alphaMode: "mask"` in the sidecar for anything
 * cut out of a texture; leave it alone for glass.
 *
 * A model that genuinely should be metal sets `metallic: true`.
 */

/** Fully rough, fully non-metal: the flat look the art direction asks for. */
const STYLE = {
  metallic: 0,
  roughness: 0.9,
};

export class MaterialError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * @param {import('@gltf-transform/core').Document} document
 * @param {{metallic?: boolean, emissive?: number|null, palette?: Record<string, string>}} sidecar
 * @returns {{delit: number, recoloured: string[]}}
 */
export function normaliseMaterials(document, { metallic = false, emissive = null, palette = null, alphaMode = null } = {}) {
  const materials = document.getRoot().listMaterials();
  const names = materials.map((m) => m.getName());

  // The check runs in the useful direction: every material in the MODEL must
  // be covered by the palette. A trunk recoloured and its leaves forgotten is
  // the mistake worth stopping for.
  //
  // Palette entries the model does not use are fine and expected — one palette
  // is shared across a whole pack, and no single prop uses all of it.
  if (palette) {
    const uncovered = names.filter((name) => !(name in palette));
    if (uncovered.length) {
      throw new MaterialError(
        'STD_PALETTE',
        `Material(s) not in the palette: ${uncovered.join(', ')}. ` +
          `Add them, or the model ships in the source pack's colours.`
      );
    }
  }

  let delit = 0;
  let masked = 0;
  const recoloured = [];

  for (const material of materials) {
    if (alphaMode === 'mask' && material.getAlphaMode() === 'BLEND') {
      material.setAlphaMode('MASK');
      material.setAlphaCutoff(0.5);
      masked += 1;
    }

    if (emissive !== null) {
      material.setEmissiveFactor(material.getEmissiveFactor().map((c) => c * emissive));
    }

    if (!metallic && material.getMetallicFactor() !== STYLE.metallic) {
      material.setMetallicFactor(STYLE.metallic);

      // A photoscan carries a roughness map, and roughnessFactor multiplies
      // it. Overwriting the factor there would flatten real surface variation
      // into one number — the opposite of what the map is for.
      if (!material.getMetallicRoughnessTexture()) {
        material.setRoughnessFactor(STYLE.roughness);
      }

      delit += 1;
    }

    const hex = palette?.[material.getName()];
    if (!hex) continue;

    // glTF stores base colour in LINEAR space; the hex a person writes down is
    // sRGB, because that is what a colour picker shows. Converting here means
    // the value in the sidecar is the value that appears on screen.
    const [r, g, b] = hexToLinear(hex);
    const alpha = material.getBaseColorFactor()[3];
    material.setBaseColorFactor([r, g, b, alpha]);
    recoloured.push(material.getName());
  }

  return { delit, masked, recoloured };
}

/** "#6b4f34" → linear [r, g, b], each 0–1. */
function hexToLinear(hex) {
  const value = hex.replace('#', '');

  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new MaterialError('STD_PALETTE', `"${hex}" is not a #rrggbb colour.`);
  }

  return [0, 2, 4].map((offset) => srgbToLinear(parseInt(value.slice(offset, offset + 2), 16) / 255));
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
