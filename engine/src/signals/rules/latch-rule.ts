import type { SignalRule, SignalRuleContext, SignalInput } from "../signal-rule.js";

const SET_PORT = "set";
const RESET_PORT = "reset";

function anyOnPort(inputs: ReadonlyArray<SignalInput>, port: string): boolean {
  return inputs.some((input) => input.port === port && input.value);
}

/**
 * Latch Set-Reset con memoria (GDD 5.6): retiene su estado aunque cese el
 * trigger original, hasta un reset explícito. Las entradas se distinguen por
 * el puerto del edge: `toPort: "set"` y `toPort: "reset"`. Una entrada sin
 * puerto se trata como "set" (caso común de un único disparador).
 *
 * El reset tiene **prioridad absoluta** (caso de validación 4, "El Piano de
 * Emergencia"): si set y reset llegan a la vez, gana reset.
 */
export class LatchRule implements SignalRule {
  readonly kind = "latch" as const;

  evaluate(ctx: SignalRuleContext): boolean {
    const { inputs, state } = ctx;
    const reset = anyOnPort(inputs, RESET_PORT);
    // Set: puerto "set" explícito, o cualquier entrada sin puerto declarado.
    const set =
      anyOnPort(inputs, SET_PORT) ||
      inputs.some((input) => input.port === undefined && input.value);

    if (reset) {
      state.latchMemory = false;
    } else if (set) {
      state.latchMemory = true;
    }
    // Sin set ni reset: mantiene memoria (la esencia del latch).
    return state.latchMemory;
  }
}
