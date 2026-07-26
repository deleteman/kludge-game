import type { ActuatorProperty } from "../properties/functional.types.js";

/**
 * Palabras, no letras — misma convención que `KineticDamageSeverity`
 * (`kinetics/kinetic-events.types.ts`): severidad cualitativa de un evento de
 * dominio, no una propiedad de material.
 */
export type WeaponDamageSeverity = "low" | "medium" | "high";

/**
 * Umbrales de calibración de `weaponDamageSeverity`, data-driven y
 * ajustables — mismo criterio que `KINETIC_IMPACT_PARAMETERS`/
 * `MAGNETIC_FIELD_PARAMETERS`. `cadence` más BAJA agrava (actúa más seguido):
 * `torreta-automatizada`/`canon-laser` ya usan `cadence: 5` como su "cadencia
 * rápida" de catálogo.
 */
export const WEAPON_DAMAGE_PARAMETERS = {
  highPowerThreshold: 80,
  mediumPowerThreshold: 40,
  fastCadenceThreshold: 3,
  moderateCadenceThreshold: 6,
} as const;

function powerScore(power: number): number {
  if (power >= WEAPON_DAMAGE_PARAMETERS.highPowerThreshold) {
    return 3;
  }
  return power >= WEAPON_DAMAGE_PARAMETERS.mediumPowerThreshold ? 2 : 1;
}

function cadenceScore(cadence: number): number {
  if (cadence <= WEAPON_DAMAGE_PARAMETERS.fastCadenceThreshold) {
    return 3;
  }
  return cadence <= WEAPON_DAMAGE_PARAMETERS.moderateCadenceThreshold ? 2 : 1;
}

/**
 * Traduce `power`/`cadence` de un `ActuatorProperty` (GDD 7.0, ya usado por
 * `torreta-automatizada`/`canon-laser`/`garra-de-abordaje`) a severidad
 * cualitativa de daño — mismo criterio (tabla cualitativa, no física real)
 * que `kinetics/kinetic-impact.ts::kineticDamageSeverity`. Hoy nada más en el
 * motor traducía estas dos propiedades a daño; esta es esa función.
 */
export function weaponDamageSeverity(actuator: ActuatorProperty): WeaponDamageSeverity {
  const score = powerScore(actuator.power) + cadenceScore(actuator.cadence);
  if (score >= 5) {
    return "high";
  }
  return score >= 4 ? "medium" : "low";
}
