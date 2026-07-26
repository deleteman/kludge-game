import type { CombatRangeRule } from "../combat-rule.js";
import { MeleeAdjacencyRule } from "./melee-adjacency-rule.js";
import { RangedProximityRule } from "./ranged-proximity-rule.js";

/**
 * Registro de reglas de combate por `kind` — mismo patrón que
 * `createDefaultCrisisTriggerRegistry` (`crisis/rules/`). Una regla nueva se
 * agrega acá, nunca editando un switch central.
 */
export function createDefaultCombatRuleRegistry(): ReadonlyMap<CombatRangeRule["kind"], CombatRangeRule> {
  return new Map([
    [MeleeAdjacencyRule.kind, MeleeAdjacencyRule],
    [RangedProximityRule.kind, RangedProximityRule],
  ]);
}
