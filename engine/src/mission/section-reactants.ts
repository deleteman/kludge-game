import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ReactantSubstance } from "../chemistry/reaction/reaction-context.types.js";
import { toReactant } from "../chemistry/reaction/tag-predicates.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";

/**
 * Reactivos REALMENTE presentes en el aire de una sección (Subfase 14a-2).
 *
 * Hasta acá `MissionReactionRuntime` solo miraba `CrisisDefinition.scriptedReactions`
 * — vacío en TODOS los capítulos, o sea que la química viva de misión no tenía
 * ningún camino jugable y `SpontaneousIgnitionRule` era inalcanzable. Decisión
 * del operador en la planificación de 14a-2: **los reactivos salen del mundo**,
 * de lo que el jugador vierte y de lo que las reacciones dejan atrás.
 *
 * Función pura y sin estado: recibe una atmósfera y devuelve qué hay dentro que
 * pueda reaccionar. Quién decide si reacciona sigue siendo `ReactionResolver`.
 */

/**
 * Los tres gases de fondo no son reactivos: están en toda sección respirable, y
 * meterlos en el contexto haría que cada sala de la nave fuera candidata
 * permanente a todas las reglas. El oxígeno entra en la reacción por su propio
 * canal (`ReactionContext.oxygen`, vía `sectionCombustionAtmosphere`), que es
 * donde el GDD 5.5 lo modela — no como un reactivo más.
 */
const BASELINE_GAS_KEYS: ReadonlySet<string> = new Set<string>(Object.values(GAS));

/**
 * Fracción mínima para que una sustancia cuente como reactivo. Existe por el
 * mismo motivo que el guard de `applyHpLoss`: sin piso, una traza residual de
 * un gas que ya se difundió mantendría la sección "reactiva" para siempre y el
 * runtime emitiría eventos de algo que ya no está pasando.
 */
export const REACTANT_PRESENCE_FLOOR = 0.02;

export function sectionReactants(
  atmosphere: SectionAtmosphere,
  substanceOf: (substanceId: ChemicalSubstanceId) => ChemicalSubstanceDefinition | undefined,
): ReadonlyArray<ReactantSubstance> {
  const reactants: ReactantSubstance[] = [];
  for (const [gasKey, fraction] of atmosphere.gases) {
    if (fraction < REACTANT_PRESENCE_FLOOR || BASELINE_GAS_KEYS.has(gasKey)) {
      continue;
    }
    const definition = substanceOf(gasKey as ChemicalSubstanceId);
    if (definition) {
      reactants.push(toReactant(definition));
    }
  }
  return reactants;
}

/**
 * Huella estable del conjunto de reactivos de una sección, para no re-emitir el
 * mismo evento tick tras tick mientras nada cambió (patrón 26: un efecto que no
 * cambió nada no debe emitir evento). Ordenada: el orden de iteración del mapa
 * no es una diferencia real.
 */
export function reactantsFingerprint(reactants: ReadonlyArray<ReactantSubstance>): string {
  return reactants
    .map((reactant) => reactant.id)
    .sort()
    .join("|");
}
