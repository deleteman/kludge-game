import { anyInputActive } from "../signal-rule.js";
import type { SignalRule, SignalRuleContext } from "../signal-rule.js";

/**
 * Comportamiento por defecto de un nodo sin lógica declarada: la salida es el
 * OR de sus entradas. Cubre conductores y receptores simples que solo
 * transportan la señal (retrocompatible con los nodos de Fase 1, que no tenían
 * `behavior`).
 */
export class PassthroughRule implements SignalRule {
  readonly kind = "passthrough" as const;

  evaluate(ctx: SignalRuleContext): boolean {
    return anyInputActive(ctx.inputs);
  }
}
