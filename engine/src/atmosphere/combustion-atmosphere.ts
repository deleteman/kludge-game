import type { CombustionAtmosphere } from "../chemistry/reaction/reaction-context.types.js";
import { GAS } from "./atmosphere-composition.types.js";
import { getGasFraction } from "./section.types.js";
import type { SectionAtmosphere } from "./section.types.js";

/**
 * Umbrales de O2 (fracción del volumen) que separan los cuatro buckets de
 * combustión de la tabla del GDD 5.5. Data-driven: valores de referencia
 * (Espec. §1 fija "sin efecto si O2 < 5%"); ajustables sin tocar la lógica.
 */
export const OXYGEN_COMBUSTION_THRESHOLDS = {
  /** Por debajo → `none`: combustión imposible (vacío/atmósfera inerte total). */
  none: 0.05,
  /** Por debajo → `low`: ignición difícil, fuego débil. */
  low: 0.15,
  /** Por debajo o igual → `normal`; por encima → `high` (enriquecida). */
  normal: 0.3,
} as const;

/**
 * Traduce una fracción de O2 al bucket de combustión (GDD 5.5). Es el punto de
 * acople entre el Bloque 3 (atmósfera) y la regla de combustión del Bloque 2:
 * la sección aporta su O2, la regla decide intensidad (o imposibilidad).
 */
export function oxygenToCombustionBucket(oxygenFraction: number): CombustionAtmosphere {
  if (oxygenFraction < OXYGEN_COMBUSTION_THRESHOLDS.none) {
    return "none";
  }
  if (oxygenFraction < OXYGEN_COMBUSTION_THRESHOLDS.low) {
    return "low";
  }
  if (oxygenFraction <= OXYGEN_COMBUSTION_THRESHOLDS.normal) {
    return "normal";
  }
  return "high";
}

export function sectionCombustionAtmosphere(atmosphere: SectionAtmosphere): CombustionAtmosphere {
  return oxygenToCombustionBucket(getGasFraction(atmosphere, GAS.OXYGEN));
}
