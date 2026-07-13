import type { SignalRule, SignalRuleContext, SignalInput } from "../signal-rule.js";

const RESET_PORT = "reset";
const COUNT_PORT = "count";

function anyOnPort(inputs: ReadonlyArray<SignalInput>, port: string): boolean {
  return inputs.some((input) => input.port === port && input.value);
}

/**
 * Contador incremental con memoria (GDD 5.6, misma familia que `LatchRule` —
 * caso de validación 5, "El Cañón que Aprende"). Incrementa su cuenta en cada
 * flanco de subida de la entrada de conteo (puerto "count", o sin puerto
 * declarado) y activa su salida al alcanzar `threshold`. El puerto "reset"
 * tiene prioridad absoluta, mismo criterio que el reset de `LatchRule`: si
 * reset y count llegan a la vez, gana reset y no se cuenta el flanco.
 */
export class CounterRule implements SignalRule {
  readonly kind = "counter" as const;

  evaluate(ctx: SignalRuleContext): boolean {
    if (ctx.behavior.kind !== "counter") {
      throw new Error(`CounterRule received behavior of kind ${ctx.behavior.kind}`);
    }
    const { inputs, state } = ctx;
    const reset = anyOnPort(inputs, RESET_PORT);
    const countSignal =
      anyOnPort(inputs, COUNT_PORT) ||
      inputs.some((input) => input.port === undefined && input.value);

    if (reset) {
      state.counterValue = 0;
      state.counterPreviousInput = countSignal;
      return false;
    }

    const risingEdge = countSignal && !state.counterPreviousInput;
    if (risingEdge) {
      state.counterValue += 1;
    }
    state.counterPreviousInput = countSignal;

    return state.counterValue >= ctx.behavior.threshold;
  }
}
