import type {
  ChemicalProperties,
  ChemicalTag,
  ChemicalTagLevel,
  ToxicityLevel,
} from "../../properties/chemical-tag.types.js";
import type { ChemicalSubstanceDefinition } from "../chemical-substance.types.js";
import type { ReactantSubstance } from "./reaction-context.types.js";

/** Extrae la vista de reactivo de una definición de sustancia (atómica o compuesta). */
export function toReactant(definition: ChemicalSubstanceDefinition): ReactantSubstance {
  return {
    id: definition.id,
    name: definition.name,
    tags: definition.data.tags,
    state: definition.data.state,
  };
}

export function hasTag(reactant: ReactantSubstance, name: ChemicalTag["name"]): boolean {
  return reactant.tags.some((tag) => tag.name === name);
}

export function anyReactantWithTag(
  reactants: ReadonlyArray<ReactantSubstance>,
  name: ChemicalTag["name"],
): boolean {
  return reactants.some((reactant) => hasTag(reactant, name));
}

/** Nivel de severidad para desempatar tags con nivel al fusionarlos (A > M > B > controlado). */
const LEVEL_RANK: Record<ChemicalTagLevel | "controlado", number> = {
  A: 3,
  M: 2,
  B: 1,
  controlado: 0,
};

function levelRank(level: ToxicityLevel | undefined): number {
  return level === undefined ? -1 : LEVEL_RANK[level];
}

/**
 * Unión de tags de varias sustancias, "sin cancelarse" (GDD 5.3, rama de
 * mezcla sin identificar): deduplica por nombre y, para TOX/CORR, conserva el
 * nivel más severo. Distinto de `assertValidTagCount`: una mezcla generada
 * puede superar la guía de 1-3 tags de una sustancia autorada — el motor no
 * fuerza ese límite sobre los productos de reacción.
 */
export function mergeTags(reactants: ReadonlyArray<ReactantSubstance>): ChemicalProperties {
  const byName = new Map<ChemicalTag["name"], ChemicalTag>();
  for (const reactant of reactants) {
    for (const tag of reactant.tags) {
      const existing = byName.get(tag.name);
      if (!existing) {
        byName.set(tag.name, tag);
        continue;
      }
      if ((tag.name === "TOX" || tag.name === "CORR") && "level" in tag && "level" in existing) {
        if (levelRank(tag.level) > levelRank(existing.level)) {
          byName.set(tag.name, tag);
        }
      }
    }
  }
  return [...byName.values()];
}
