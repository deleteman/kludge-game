import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { CrewSpecialty } from "./crew-specialty.types.js";
import type { CrewTier } from "./crew-tier.types.js";

/**
 * Porcentaje de recuperación atómica base al desmontar, por tier (GDD 6.5,
 * tabla literal). Asume que ejecuta el Ingeniero (su especialidad afín) —
 * `atomicRecoveryFraction` aplica el bonus adicional o no según quién ejecuta.
 */
export const ATOMIC_RECOVERY_BASE_FRACTION: Record<CrewTier, number> = {
  novato: 0.6,
  veterano: 0.8,
  experto: 0.925, // "90-95%", punto medio del rango como valor de referencia.
};

/** Bonus adicional del Ingeniero sobre el porcentaje base de su tier (GDD 6.6). */
export const ENGINEER_RECOVERY_BONUS = 0.1;

/**
 * Penalización de recuperación por baja resistencia estructural del compuesto
 * (GDD 6.5: "un compuesto con RE baja tiene mayor probabilidad de perder
 * piezas frágiles… sin importar el tier"). Sin tabla numérica en el GDD —
 * valor de referencia data-driven, mismo criterio que `KINETIC_IMPACT_PARAMETERS`.
 */
export const LOW_STRUCTURAL_RESISTANCE_RECOVERY_PENALTY = 0.15;

/**
 * Fracción de piezas atómicas recuperadas intactas al desmontar (GDD 6.5),
 * en [0, 1]. El bonus de +10% del Ingeniero SOLO aplica cuando el propio
 * Ingeniero ejecuta la tarea (GDD 6.6, nota de 6.5: otra especialidad
 * desmontando mantiene el porcentaje base de su tier, sin el bonus, aunque sí
 * paga la penalización de tiempo fuera de afinidad en `crew-affinity.ts`).
 */
export function atomicRecoveryFraction(
  tier: CrewTier,
  actorSpecialty: CrewSpecialty,
  originalResistance?: StructuralResistanceLevel,
): number {
  let fraction = ATOMIC_RECOVERY_BASE_FRACTION[tier];
  if (actorSpecialty === "ingeniero") {
    fraction += ENGINEER_RECOVERY_BONUS;
  }
  if (originalResistance === "B") {
    fraction -= LOW_STRUCTURAL_RESISTANCE_RECOVERY_PENALTY;
  }
  return Math.min(1, Math.max(0, fraction));
}
