import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalTag } from "../../properties/chemical-tag.types.js";
import type { ReactantSubstance } from "./reaction-context.types.js";
import { mergeTags } from "./tag-predicates.js";

const UNIDENTIFIED_ID = "reaction:unidentified" as ChemicalSubstanceId;

/** Adjetivo en español por tag, para la plantilla del nombre (GDD 5.3). */
const TAG_ADJECTIVE: Record<ChemicalTag["name"], string> = {
  OXI: "Oxidante",
  COMB: "Combustible",
  ACID: "Ácida",
  BASE: "Básica",
  INERTE: "Inerte",
  VOLAT: "Volátil",
  TOX: "Tóxica",
  CORR: "Corrosiva",
};

/**
 * Paso 3 de la resolución de identidad (GDD 5.3, Factory): cuando no hay receta
 * nombrada ni regla de tags aplicable, la mezcla NO queda indefinida — se
 * convierte en una "Mezcla sin identificar" con propiedades iguales a la unión
 * de los tags de sus componentes (sin cancelarse) y un nombre generado por
 * plantilla desde sus tags dominantes (ej. "Mezcla sin identificar (Volátil,
 * Corrosiva)"). Coherente con el pilar de diseño 4.
 */
export function createUnidentifiedMixture(
  reactants: ReadonlyArray<ReactantSubstance>,
): ReactantSubstance {
  const tags = mergeTags(reactants);
  const adjectives = tags.map((tag) => TAG_ADJECTIVE[tag.name]);
  return {
    id: UNIDENTIFIED_ID,
    name: `Mezcla sin identificar (${adjectives.join(", ")})`,
    tags,
  };
}
