import type { ReactionRule, ReactionRuleId } from "./reaction-rule.js";

/**
 * Orden de prioridad canónico entre reglas de reacción simultáneas
 * (Especificación de datos técnicos §2). Data-driven: una lista ordenada, no
 * un if-else. La regla de mayor prioridad consume los reactivos; las de menor
 * prioridad se re-evalúan sobre el resultado (lo implementa el resolver).
 *
 * `corrosive-substance` no está en la lista textual de §2 (que enumera seis
 * reglas); se inserta entre combustión y las reglas de efecto por ser una
 * transformación de sustancia, preservando el orden relativo de las seis de §2.
 *
 * Las reglas basadas en tiempo (`toxic-incapacitation`, `structural-degradation`,
 * `crew-damage`) figuran aquí por completitud del orden de §2, pero su
 * implementación vive en los subsistemas por tick (Bloques 3 y 4): su parámetro
 * definitorio es el tiempo (>5s, ~15s/nivel, ~10s), que el resolver instantáneo
 * no modela. El acoplamiento con la prioridad se mantiene por identidad de
 * sustancia: si una reacción de mayor prioridad consume la sustancia corrosiva
 * o tóxica, sus acumuladores por tick se detienen porque la sustancia deja de
 * existir.
 */
export const REACTION_PRIORITY: ReadonlyArray<ReactionRuleId> = [
  "neutralization",
  "combustion",
  "corrosive-substance",
  "toxic-incapacitation",
  "structural-degradation",
  "crew-damage",
  "spontaneous-ignition",
];

/** Ordena una lista de reglas según `REACTION_PRIORITY` (mayor prioridad primero). */
export function sortByPriority(rules: ReadonlyArray<ReactionRule>): ReactionRule[] {
  return [...rules].sort(
    (a, b) => REACTION_PRIORITY.indexOf(a.id) - REACTION_PRIORITY.indexOf(b.id),
  );
}
