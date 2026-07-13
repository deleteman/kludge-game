import { anyInputActive } from "../signal-rule.js";
import type { SignalRule, SignalRuleContext } from "../signal-rule.js";

/**
 * Delay de propagación (GDD 5.6, "delay de propagación variable según material
 * del conductor"). La salida sigue al OR de las entradas, pero cada cambio
 * tarda `delaySeconds` en propagarse. Es la pieza que, combinada, permite
 * construir relojes y temporizaciones no triviales.
 *
 * Simplificación consciente (CLAUDE.md, "no optimizar prematuramente"): se
 * modela como un retardo de establecimiento (una transición pendiente a la
 * vez), no una línea de retardo FIFO exacta. Si la entrada vuelve a su valor
 * anterior antes de cumplirse el retardo, la transición pendiente se cancela.
 * Suficiente para las validaciones de Fase 2; revisable si algún caso exige
 * conservar pulsos más cortos que el retardo.
 */
export class DelayRule implements SignalRule {
  readonly kind = "delay" as const;

  evaluate(ctx: SignalRuleContext): boolean {
    if (ctx.behavior.kind !== "delay") {
      throw new Error(`DelayRule received behavior of kind ${ctx.behavior.kind}`);
    }
    const { inputs, state, tick, behavior } = ctx;
    const target = anyInputActive(inputs);

    if (target === state.output) {
      // La entrada coincide con la salida: cancela cualquier transición pendiente.
      state.delayTarget = null;
      state.delayRemainingSeconds = 0;
      return state.output;
    }

    // La entrada difiere de la salida: hay una transición en curso hacia `target`.
    if (state.delayTarget !== target) {
      state.delayTarget = target;
      state.delayRemainingSeconds = behavior.delaySeconds;
    }
    state.delayRemainingSeconds -= tick.dtSeconds;
    if (state.delayRemainingSeconds <= 0) {
      state.output = target;
      state.delayTarget = null;
      state.delayRemainingSeconds = 0;
    }
    return state.output;
  }
}
