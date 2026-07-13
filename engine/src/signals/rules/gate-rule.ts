import { anyInputActive } from "../signal-rule.js";
import type { SignalRule, SignalRuleContext } from "../signal-rule.js";

/**
 * Compuertas combinacionales AND/OR/NOT (GDD 5.6). Las tres comparten una
 * regla porque son la misma responsabilidad — combinación booleana pura de las
 * entradas — parametrizada por `mode`. No es un "switch gigante": es un
 * único behavior con tres modos de dato; comportamientos genuinamente
 * distintos (latch, oscilador, delay) son clases Strategy aparte.
 *
 * NOT invierte el OR de sus entradas (con una sola entrada = NOT lógico
 * estricto; con varias = NOR). AND con cero entradas es `false` (no hay nada
 * que confirmar), coherente con "todos activos" sobre conjunto vacío tratado
 * como no-disparado.
 */
export class GateRule implements SignalRule {
  readonly kind = "gate" as const;

  evaluate(ctx: SignalRuleContext): boolean {
    if (ctx.behavior.kind !== "gate") {
      throw new Error(`GateRule received behavior of kind ${ctx.behavior.kind}`);
    }
    const { inputs } = ctx;
    switch (ctx.behavior.mode) {
      case "AND":
        return inputs.length > 0 && inputs.every((input) => input.value);
      case "OR":
        return anyInputActive(inputs);
      case "NOT":
        return !anyInputActive(inputs);
    }
  }
}
