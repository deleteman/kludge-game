import type { ReactionContext } from "../reaction-context.types.js";
import type { ReactionResult, ReactionRule } from "../reaction-rule.js";
import { anyReactantWithTag } from "../tag-predicates.js";

/**
 * Volátil + regulador térmico sobrecargado → riesgo de ignición espontánea
 * (GDD 5.3). Regla de efecto (no transforma identidad de sustancia): emite el
 * evento de ignición espontánea, que el resto del sistema puede usar como
 * fuente de ignición para una combustión posterior. Prioridad más baja de la
 * lista (Espec. §2).
 */
export class SpontaneousIgnitionRule implements ReactionRule {
  readonly id = "spontaneous-ignition" as const;

  appliesTo(ctx: ReactionContext): boolean {
    return ctx.thermalRegulatorOverloaded && anyReactantWithTag(ctx.reactants, "VOLAT");
  }

  apply(ctx: ReactionContext): ReactionResult {
    return {
      consumedReactantIds: [],
      events: [{ kind: "spontaneous-ignition", elapsedSeconds: ctx.elapsedSeconds }],
    };
  }
}
