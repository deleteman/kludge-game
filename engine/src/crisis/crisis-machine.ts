import type { CrisisState } from "./crisis-state.types.js";
import { TERMINAL_CRISIS_STATES } from "./crisis-state.types.js";
import type { CrisisDefinition } from "./crisis-definition.types.js";
import type { CrisisEvalContext, CrisisResolutionRule, CrisisTriggerRule } from "./crisis-rule.js";
import type { CrisisDomainEvent } from "./crisis-events.types.js";

export interface CrisisRuleRegistries {
  readonly triggerRules: ReadonlyMap<string, CrisisTriggerRule>;
  readonly resolutionRules: ReadonlyMap<string, CrisisResolutionRule>;
}

export interface CrisisEvaluationResult {
  readonly state: CrisisState;
  readonly events: ReadonlyArray<CrisisDomainEvent>;
}

/**
 * Evalúa un paso de la máquina de estados de una crisis (`crisis-state.types.ts`)
 * contra el mundo actual. Función pura de `(estado, definición, contexto) →
 * nuevo estado + eventos` — mismo criterio que las reglas de reacción/señal;
 * no conoce `TaskScheduler` ni `Tickable` (eso es la sub-fase 10b, que llama
 * a esta función desde su propio adaptador de tick).
 */
export function evaluateCrisis(
  currentState: CrisisState,
  definition: CrisisDefinition,
  ctx: CrisisEvalContext,
  registries: CrisisRuleRegistries,
): CrisisEvaluationResult {
  if (TERMINAL_CRISIS_STATES.has(currentState)) {
    return { state: currentState, events: [] };
  }

  if (currentState === "not-triggered") {
    const triggered = evaluateAll(definition.triggers, registries.triggerRules, (rule, spec) =>
      rule.isTriggered(spec, ctx),
    );
    if (!triggered) {
      return { state: currentState, events: [] };
    }
    return {
      state: "active",
      events: [{ kind: "crisis-triggered", crisisId: definition.id, elapsedSeconds: ctx.tick.elapsedSeconds }],
    };
  }

  // currentState === "active"
  const resolved = evaluateAll(definition.resolutions, registries.resolutionRules, (rule, spec) =>
    rule.isResolved(spec, ctx),
  );
  if (resolved) {
    return {
      state: "resolved-success",
      events: [
        {
          kind: "crisis-resolved",
          crisisId: definition.id,
          outcome: "resolved-success",
          elapsedSeconds: ctx.tick.elapsedSeconds,
        },
      ],
    };
  }

  const timer = definition.timer;
  if (timer !== undefined && ctx.tick.elapsedSeconds >= timer.softDeadlineSeconds) {
    return {
      state: timer.onExpire,
      events: [
        {
          kind: "crisis-resolved",
          crisisId: definition.id,
          outcome: timer.onExpire,
          elapsedSeconds: ctx.tick.elapsedSeconds,
        },
      ],
    };
  }

  return { state: currentState, events: [] };
}

function evaluateAll<TSpec extends { readonly kind: string }, TRule extends { readonly kind: string }>(
  specs: ReadonlyArray<TSpec>,
  rules: ReadonlyMap<string, TRule>,
  check: (rule: TRule, spec: TSpec) => boolean,
): boolean {
  return specs.every((spec) => {
    const rule = rules.get(spec.kind);
    if (!rule) {
      throw new Error(`No hay CrisisTriggerRule/CrisisResolutionRule registrada para kind "${spec.kind}"`);
    }
    return check(rule, spec);
  });
}
