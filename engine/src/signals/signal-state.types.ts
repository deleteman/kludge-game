import type { SignalNodeId } from "./signal-node.types.js";
import type { SignalGraph } from "./signal-graph.types.js";

/**
 * Estado mutable de simulación de un nodo de señal. Separado del grafo
 * (dato inmutable de topología/behavior) porque el estado cambia en cada
 * `tick` mientras la definición del grafo no: distinción explícita entre el
 * "circuito" y su "voltaje instantáneo".
 *
 * Cada Strategy usa solo el slice que le concierne; los demás campos quedan en
 * su valor por defecto. Todos los campos son mutables por diseño — el
 * evaluador los actualiza in-place por rendimiento y claridad del bucle.
 */
export interface SignalNodeState {
  /** Salida booleana actual del nodo (lo que ven sus consumidores). */
  output: boolean;
  /** Memoria del latch (GDD 5.6). Su valor ES la salida de un nodo latch. */
  latchMemory: boolean;
  /** Fase acumulada del oscilador, en segundos, dentro del periodo actual. */
  oscillatorPhaseSeconds: number;
  /** Valor objetivo pendiente de propagar en un nodo delay (null = sin pendiente). */
  delayTarget: boolean | null;
  /** Segundos restantes hasta que el nodo delay adopte `delayTarget`. */
  delayRemainingSeconds: number;
}

export function createSignalNodeState(): SignalNodeState {
  return {
    output: false,
    latchMemory: false,
    oscillatorPhaseSeconds: 0,
    delayTarget: null,
    delayRemainingSeconds: 0,
  };
}

/** Estado de simulación de todo el grafo: un `SignalNodeState` por nodo. */
export type SignalGraphState = Map<SignalNodeId, SignalNodeState>;

export function createSignalGraphState<TOwnerRef>(graph: SignalGraph<TOwnerRef>): SignalGraphState {
  const state: SignalGraphState = new Map();
  for (const node of graph.nodes) {
    state.set(node.id, createSignalNodeState());
  }
  return state;
}
