import type { EntityRegistry } from "../composition/entity-registry.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { LeveledChemicalTagName, SimpleChemicalTagName } from "../properties/chemical-tag.types.js";
import { GAS } from "./atmosphere-composition.types.js";
import { getGasFraction } from "./section.types.js";
import type { SectionAtmosphere } from "./section.types.js";

/**
 * Concentración del contaminante más presente con un tag químico dado
 * (Subfase 13f). Extraído porque el mismo recorrido —"por cada gas que no sea
 * uno de los tres estándar, resolver la sustancia y mirar sus tags"— ya vivía
 * copiado dentro de `aggregateAtmosphere` y `sectionCorrosiveLevel`, y el
 * runtime de hazards necesitaba una tercera copia.
 *
 * Convención de `atmosphere-composition.types.ts`: cada `GasKey` que no sea
 * uno de `GAS` es el id de una sustancia química contaminante.
 */
export function sectionTaggedConcentration(
  atmosphere: SectionAtmosphere,
  registry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
  tagName: SimpleChemicalTagName | LeveledChemicalTagName,
): number {
  let worst = 0;
  for (const gasKey of atmosphere.gases.keys()) {
    if (gasKey === GAS.OXYGEN || gasKey === GAS.NITROGEN || gasKey === GAS.CO2) {
      continue;
    }
    const substance = registry.get(gasKey as ChemicalSubstanceId);
    if (!substance?.data.tags.some((tag) => tag.name === tagName)) {
      continue;
    }
    worst = Math.max(worst, getGasFraction(atmosphere, gasKey));
  }
  return worst;
}
