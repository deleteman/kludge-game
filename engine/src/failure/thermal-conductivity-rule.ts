import type { ConductorProperty } from "../properties/functional.types.js";
import type { OverloadSubject } from "./overload-rule.js";

/**
 * Parámetros del efecto de enfriamiento extremo sobre la conductividad
 * eléctrica (GDD 5.2 "conductividad eléctrica... variable con temperatura",
 * caso de validación 2). Sin tabla numérica en la Especificación de datos
 * técnicos — a diferencia de `REACTION_PARAMETERS`, estos valores no tienen
 * respaldo documental exacto, son puramente de referencia para playtesting.
 */
export const THERMAL_CONDUCTIVITY_PARAMETERS = {
  /** Por debajo de esta temperatura (°C) el enfriamiento extremo (ej. nitrógeno
   *  líquido) reduce la resistencia del conductor lo bastante como para
   *  arriesgar sobrecarga. */
  triggerTemperatureCelsius: -50,
  /** Fracción de la capacidad nominal que queda como "segura" por debajo del
   *  umbral: menos resistencia → menos capacidad de corriente segura antes de
   *  disparar sobrecarga. */
  effectiveCapacityFractionBelowTrigger: 0.5,
} as const;

/**
 * `OverloadSubject` de un conductor ajustado por temperatura ambiental (caso
 * 2: refrigerante conductor + nitrógeno líquido + panel eléctrico). Por
 * debajo del umbral de enfriamiento, la capacidad efectiva baja — un
 * conductor normalmente seguro puede superar su capacidad de corriente y
 * disparar `OverloadRule` sin que cambie la carga real. Reutiliza el
 * mecanismo de fallo ya existente en vez de duplicarlo.
 */
export function thermallyAdjustedConductorOverloadSubject(
  ref: string,
  conductor: ConductorProperty,
  load: number,
  temperatureCelsius: number,
): OverloadSubject {
  const capacity =
    temperatureCelsius <= THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius
      ? conductor.maxCapacity *
        THERMAL_CONDUCTIVITY_PARAMETERS.effectiveCapacityFractionBelowTrigger
      : conductor.maxCapacity;
  return { ref, resourceType: conductor.resourceType, capacity, load };
}
