import type { EventEmitter } from "../../simulation/event-emitter.js";
import type { ReactantSubstance, ReactionContext } from "./reaction-context.types.js";
import type { ReactionDomainEvent } from "./reaction-events.types.js";
import type { ReactionRule, ReactionRuleId } from "./reaction-rule.js";
import { sortByPriority } from "./reaction-priority.js";
import { NamedRecipeIndex } from "./named-recipe-index.js";
import { createUnidentifiedMixture } from "./unidentified-mixture-factory.js";
import { NeutralizationRule } from "./rules/neutralization.js";
import { CombustionRule } from "./rules/combustion.js";
import { CorrosiveSubstanceRule } from "./rules/corrosive-substance.js";
import { SpontaneousIgnitionRule } from "./rules/spontaneous-ignition.js";

const MAX_ITERATIONS = 32;

/** Reglas de reacción que el resolver instantáneo posee (las que transforman identidad o disparan ignición). */
export function createDefaultReactionRules(): ReactionRule[] {
  return [
    new NeutralizationRule(),
    new CombustionRule(),
    new CorrosiveSubstanceRule(),
    new SpontaneousIgnitionRule(),
  ];
}

export interface ReactionResolverOptions {
  readonly rules?: ReadonlyArray<ReactionRule>;
  readonly namedRecipeIndex?: NamedRecipeIndex;
  /** Si se pasa, el resolver emite los eventos además de devolverlos. */
  readonly emitter?: EventEmitter<ReactionDomainEvent>;
}

export interface ReactionOutcome {
  /** Sustancia resultante de la mezcla (null si no había reactivos). */
  readonly result: ReactantSubstance | null;
  readonly events: ReadonlyArray<ReactionDomainEvent>;
  readonly appliedRuleIds: ReadonlyArray<ReactionRuleId>;
}

/**
 * Resolutor de reacciones químicas (GDD 5.3). Implementa el modelo de
 * resolución de identidad en 3 pasos y el orden de prioridad/stacking de la
 * Especificación §2:
 *
 *  1. Receta nombrada (`NamedRecipeIndex`): si el conjunto de reactivos coincide
 *     con una receta de compuesto conocida, la mezcla ES ese compuesto.
 *  2. Regla de reacción por tags (Strategy, por orden de prioridad): la de mayor
 *     prioridad consume sus reactivos y produce un resultado; el bucle re-evalúa
 *     el resto de reglas SOBRE EL RESULTADO, no sobre los reactivos originales.
 *  3. Fallback: si quedan ≥2 reactivos sin reaccionar, se genera una "Mezcla sin
 *     identificar" (Factory). Nunca un resultado indefinido.
 */
export class ReactionResolver {
  private readonly rules: ReactionRule[];

  constructor(private readonly options: ReactionResolverOptions = {}) {
    this.rules = sortByPriority(options.rules ?? createDefaultReactionRules());
  }

  resolve(ctx: ReactionContext): ReactionOutcome {
    let reactants: ReactantSubstance[] = [...ctx.reactants];
    const events: ReactionDomainEvent[] = [];
    const appliedRuleIds: ReactionRuleId[] = [];
    const firedEffectRules = new Set<ReactionRuleId>();

    let iterations = 0;
    for (;;) {
      if (iterations++ >= MAX_ITERATIONS) {
        throw new Error("ReactionResolver did not converge — possible rule loop");
      }

      // Paso 1: receta nombrada tiene precedencia sobre las reglas de tags.
      const named = this.options.namedRecipeIndex?.lookup(reactants);
      if (named) {
        reactants = [named];
        continue;
      }

      // Paso 2: primera regla aplicable por orden de prioridad.
      const derivedCtx: ReactionContext = { ...ctx, reactants };
      let changed = false;
      for (const rule of this.rules) {
        if (firedEffectRules.has(rule.id) || !rule.appliesTo(derivedCtx)) {
          continue;
        }
        const result = rule.apply(derivedCtx);
        events.push(...result.events);
        appliedRuleIds.push(rule.id);
        if (result.product) {
          const consumed = new Set(result.consumedReactantIds);
          reactants = [result.product, ...reactants.filter((r) => !consumed.has(r.id))];
        } else {
          // Regla de efecto (sin producto): se dispara una vez para no reciclar.
          firedEffectRules.add(rule.id);
        }
        changed = true;
        break;
      }
      if (!changed) {
        break;
      }
    }

    // Paso 3: fallback a mezcla sin identificar.
    if (reactants.length >= 2) {
      reactants = [createUnidentifiedMixture(reactants)];
    }

    if (this.options.emitter) {
      for (const event of events) {
        this.options.emitter.emit(event);
      }
    }

    return { result: reactants[0] ?? null, events, appliedRuleIds };
  }
}
