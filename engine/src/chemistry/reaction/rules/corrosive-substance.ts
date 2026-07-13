import type { ChemicalSubstanceId } from "../../chemical-substance.types.js";
import type { ReactionContext } from "../reaction-context.types.js";
import type { ReactionResult, ReactionRule } from "../reaction-rule.js";
import { anyReactantWithTag } from "../tag-predicates.js";

const DERIVED_TOXIC_GAS_ID = "reaction:derived-toxic-gas" as ChemicalSubstanceId;

/**
 * Corrosivo + otra sustancia química → la disuelve/neutraliza/genera un
 * subproducto. Resultado por defecto con nombre genérico fijo "Gas tóxico
 * derivado" (GDD 5.3). Distinto de corrosivo+estructura (Bloque 4) y
 * corrosivo+tripulante (Bloque 3): esta regla es sustancia contra sustancia.
 *
 * Menor prioridad que neutralización y combustión (Espec. §2): si el corrosivo
 * es además un ácido frente a una base, o hay ignición, esas reglas consumen
 * primero los reactivos y ésta se re-evalúa sobre el resultado.
 */
export class CorrosiveSubstanceRule implements ReactionRule {
  readonly id = "corrosive-substance" as const;

  appliesTo(ctx: ReactionContext): boolean {
    return anyReactantWithTag(ctx.reactants, "CORR") && ctx.reactants.length >= 2;
  }

  apply(ctx: ReactionContext): ReactionResult {
    return {
      product: {
        id: DERIVED_TOXIC_GAS_ID,
        name: "Gas tóxico derivado",
        tags: [{ name: "TOX", level: "M" }],
        state: "G",
      },
      consumedReactantIds: ctx.reactants.map((r) => r.id),
      events: [],
    };
  }
}
