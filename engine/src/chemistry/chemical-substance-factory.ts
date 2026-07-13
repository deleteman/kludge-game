import { assertValidTagCount } from "../properties/chemical-tag.types.js";
import { CompositionFactory } from "../composition/composition-factory.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type {
  ChemicalSubstanceData,
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "./chemical-substance.types.js";

/**
 * Instancia la CompositionFactory genérica para el dominio químico (GDD
 * 5.4.1-5.4.2) — la MISMA clase que usa el dominio físico
 * (components/physical-component-factory.ts), solo cambia la regla de
 * validación propia: 1-3 tags químicos por sustancia (GDD 5.3).
 */
export function createChemicalSubstanceFactory(
  registry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
): CompositionFactory<
  ChemicalSubstanceId,
  ChemicalSubstanceData,
  ChemicalSubstanceData,
  ChemicalSubstanceId
> {
  return new CompositionFactory<
    ChemicalSubstanceId,
    ChemicalSubstanceData,
    ChemicalSubstanceData,
    ChemicalSubstanceId
  >(registry, {
    validateAtomicData: assertValidTagCount,
    validateCompositeData: assertValidTagCount,
  });
}
