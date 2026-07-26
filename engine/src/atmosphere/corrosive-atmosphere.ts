import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ChemicalTag, ChemicalTagLevel, CorrTag } from "../properties/chemical-tag.types.js";
import { getGasFraction } from "./section.types.js";
import type { SectionAtmosphere } from "./section.types.js";

function isCorrTag(tag: ChemicalTag): tag is CorrTag {
  return tag.name === "CORR";
}

/**
 * Concentración mínima de un contaminante `CORR` para que la sección se
 * considere expuesta (Fase 11b). Por debajo de este umbral, trazas de
 * corrosivo no alimentan `StructuralIntegrity.tick()` — mismo criterio que
 * `OXYGEN_COMBUSTION_THRESHOLDS.none` en `combustion-atmosphere.ts`.
 */
export const CORROSIVE_ONSET_CONCENTRATION = 0.05;

/** Orden de severidad de mayor a menor (mismo criterio que `RE_ORDER` en `failure/structural-failure.ts`). */
const LEVEL_SEVERITY: ReadonlyArray<ChemicalTagLevel> = ["A", "M", "B"];

/**
 * Deriva el nivel corrosivo (`ChemicalTagLevel`) de una sección a partir de su
 * composición de gases (Fase 11b). Punto de acople entre atmósfera (Bloque 3)
 * y `StructuralIntegrity` (Bloque 4, `failure/structural-failure.ts`), igual
 * que `sectionCombustionAtmosphere` acopla atmósfera con la regla de
 * combustión — cada `GasKey` que no sea uno de los tres gases estándar (`GAS`)
 * es el id de una sustancia contaminante (convención de
 * `atmosphere-composition.types.ts`); si esa sustancia tiene tag `CORR` con
 * nivel y su concentración supera el umbral de exposición, aporta ese nivel.
 * Cuando varios contaminantes corrosivos coexisten, se devuelve el más severo.
 */
export function sectionCorrosiveLevel(
  atmosphere: SectionAtmosphere,
  registry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
): ChemicalTagLevel | null {
  let worst: ChemicalTagLevel | null = null;

  for (const gasKey of atmosphere.gases.keys()) {
    const concentration = getGasFraction(atmosphere, gasKey);
    if (concentration <= CORROSIVE_ONSET_CONCENTRATION) {
      continue;
    }
    const substance = registry.get(gasKey as ChemicalSubstanceId);
    if (!substance) {
      continue;
    }
    const corrTag = substance.data.tags.find(isCorrTag);
    if (!corrTag?.level) {
      continue;
    }
    if (worst === null || LEVEL_SEVERITY.indexOf(corrTag.level) < LEVEL_SEVERITY.indexOf(worst)) {
      worst = corrTag.level;
    }
  }

  return worst;
}
