import type { ChemicalSubstanceId } from "../../chemical-substance.types.js";
import type { ReactionContext } from "../reaction-context.types.js";
import type { ReactionResult, ReactionRule } from "../reaction-rule.js";
import { hasTag, anyReactantWithTag } from "../tag-predicates.js";
import { REACTION_PARAMETERS } from "../reaction-parameters.js";

const NEUTRALIZED_ID = "reaction:neutralized" as ChemicalSubstanceId;

/**
 * Ácido + base → neutralización, libera calor. Resultado con nombre genérico
 * fijo "Solución neutralizada" (inerte), GDD 5.3 paso 2. Consume las
 * sustancias ácidas y básicas involucradas.
 */
export class NeutralizationRule implements ReactionRule {
  readonly id = "neutralization" as const;

  appliesTo(ctx: ReactionContext): boolean {
    return anyReactantWithTag(ctx.reactants, "ACID") && anyReactantWithTag(ctx.reactants, "BASE");
  }

  apply(ctx: ReactionContext): ReactionResult {
    const consumed = ctx.reactants.filter(
      (reactant) => hasTag(reactant, "ACID") || hasTag(reactant, "BASE"),
    );
    const params = REACTION_PARAMETERS.neutralization;
    return {
      product: {
        id: NEUTRALIZED_ID,
        name: "Solución neutralizada",
        tags: [{ name: "INERTE" }],
        state: "L",
      },
      consumedReactantIds: consumed.map((reactant) => reactant.id),
      events: [
        {
          kind: "neutralization",
          heatReleasedCelsius: params.heatReleasedCelsius,
          heatDurationSeconds: params.heatDurationSeconds,
          elapsedSeconds: ctx.elapsedSeconds,
        },
      ],
    };
  }
}
