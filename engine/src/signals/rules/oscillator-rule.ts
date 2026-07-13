import { anyInputActive } from "../signal-rule.js";
import type { SignalRule, SignalRuleContext } from "../signal-rule.js";

/**
 * Oscilador/reloj (GDD 5.6, "permite construir relojes/osciladores"). Genera
 * una onda cuadrada: alterna su salida cada `periodSeconds` de tiempo simulado.
 *
 * Enable por presencia (caso de validación 6, "El Pulmón Compartido"): si el
 * nodo tiene entradas, oscila solo mientras alguna está activa y se congela
 * (salida false, fase a cero) cuando todas cesan; sin entradas, corre libre.
 */
export class OscillatorRule implements SignalRule {
  readonly kind = "oscillator" as const;

  evaluate(ctx: SignalRuleContext): boolean {
    if (ctx.behavior.kind !== "oscillator") {
      throw new Error(`OscillatorRule received behavior of kind ${ctx.behavior.kind}`);
    }
    const { inputs, state, tick, behavior } = ctx;
    const enabled = inputs.length === 0 || anyInputActive(inputs);
    if (!enabled) {
      state.oscillatorPhaseSeconds = 0;
      return false;
    }

    const period = behavior.periodSeconds;
    if (period <= 0) {
      throw new Error(`Oscillator periodSeconds must be > 0, got ${period}`);
    }

    state.oscillatorPhaseSeconds += tick.dtSeconds;
    // Un dt grande respecto al periodo puede cruzar varios flancos: cada
    // periodo completo invierte la salida.
    while (state.oscillatorPhaseSeconds >= period) {
      state.oscillatorPhaseSeconds -= period;
      state.output = !state.output;
    }
    return state.output;
  }
}
