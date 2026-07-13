import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { SignalBehavior } from "./signal-behavior.types.js";
import type { SignalNodeState } from "./signal-state.types.js";

/**
 * Una entrada a un nodo: el valor (salida del nodo origen en el tick anterior)
 * y, opcionalmente, el puerto del edge por el que llega (para nodos que tratan
 * sus entradas de forma asimétrica, como el latch set/reset).
 */
export interface SignalInput {
  readonly value: boolean;
  readonly port?: string;
}

export interface SignalRuleContext {
  readonly inputs: ReadonlyArray<SignalInput>;
  /** Slice de estado del nodo, mutable — la regla lee y actualiza su memoria/fase. */
  readonly state: SignalNodeState;
  readonly tick: TickContext;
  /** El behavior declarado del nodo; la regla lo estrecha a su variante. */
  readonly behavior: SignalBehavior;
}

/**
 * Strategy de combinación de señales (CLAUDE.md: patrón Strategy para las
 * reglas de 5.6). Cada comportamiento (`SignalBehavior["kind"]`) implementa
 * esta interfaz; añadir un comportamiento nuevo es implementar la interfaz y
 * registrarlo, no editar un switch central. `evaluate` devuelve la nueva
 * salida del nodo y puede mutar `ctx.state` (memoria del latch, fase del
 * oscilador, buffer del delay).
 */
export interface SignalRule {
  readonly kind: SignalBehavior["kind"];
  evaluate(ctx: SignalRuleContext): boolean;
}

/** Helper común: ¿alguna entrada está activa? (OR de entradas). */
export function anyInputActive(inputs: ReadonlyArray<SignalInput>): boolean {
  return inputs.some((input) => input.value);
}
