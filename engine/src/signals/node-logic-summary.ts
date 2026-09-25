import type { GateMode, SignalBehavior } from "./signal-behavior.types.js";
import type { SignalEdge } from "./signal-edge.types.js";
import type { SignalNodeId } from "./signal-node.types.js";
import { createSignalNodeState, type SignalNodeState } from "./signal-state.types.js";

/**
 * Resumen legible del estado INTERNO de un nodo de señal (Deuda #56).
 *
 * `SignalNodeState` guarda la cuenta del contador, la memoria del latch, la fase
 * del reloj y la transición pendiente del retardo, pero nada de eso llegaba al
 * jugador: podía configurar un circuito entero y no ver qué pasaba adentro, que
 * es el eje 1 del checklist de playtest (la UI no puede ocultar el estado del
 * motor). Es lo que necesita para depurar los filtros AND/OR/NOT que pide el Cap.2.
 *
 * DATOS, no texto: el motor no arma strings de UI (CLAUDE.md). Una unión
 * discriminada por `kind`, una variante por comportamiento; `passthrough` y los
 * nodos sin `behavior` devuelven `undefined` — un LED o un conductor no ganan
 * una línea vacía en su tooltip.
 */

/** Cuántas de las entradas de un nodo están activas ahora (p.ej. "1 de 2" en una compuerta Y). */
export interface NodeInputTally {
  readonly active: number;
  readonly total: number;
}

export type NodeLogicSummary =
  | { readonly kind: "gate"; readonly mode: GateMode; readonly inputs: NodeInputTally; readonly output: boolean }
  | { readonly kind: "latch"; readonly engaged: boolean }
  | { readonly kind: "counter"; readonly count: number; readonly threshold: number; readonly reached: boolean }
  | {
      readonly kind: "oscillator";
      readonly periodSeconds: number;
      /** Corriendo: sin entradas corre libre; con entradas, sólo mientras alguna esté activa (`OscillatorRule`). */
      readonly running: boolean;
      readonly output: boolean;
    }
  | {
      readonly kind: "delay";
      readonly delaySeconds: number;
      /** Hay una transición en curso: la entrada ya cambió y la salida todavía no. */
      readonly pending: boolean;
      readonly remainingSeconds: number;
      readonly output: boolean;
    };

/** Cuenta las entradas de un nodo sobre las aristas que se le pasen (el grafo ACTIVO: un cable quemado no cuenta). */
export function tallyNodeInputs(
  edges: ReadonlyArray<SignalEdge>,
  nodeId: SignalNodeId,
  isSourceActive: (sourceId: SignalNodeId) => boolean,
): NodeInputTally {
  let total = 0;
  let active = 0;
  for (const edge of edges) {
    if (edge.to !== nodeId) continue;
    total += 1;
    if (isSourceActive(edge.from)) active += 1;
  }
  return { active, total };
}

export function summarizeNodeLogic(
  behavior: SignalBehavior | undefined,
  state: SignalNodeState | undefined,
  inputs: NodeInputTally,
): NodeLogicSummary | undefined {
  const current = state ?? createSignalNodeState();
  switch (behavior?.kind) {
    case "gate":
      return { kind: "gate", mode: behavior.mode, inputs, output: current.output };
    case "latch":
      return { kind: "latch", engaged: current.latchMemory };
    case "counter":
      return {
        kind: "counter",
        count: current.counterValue,
        threshold: behavior.threshold,
        reached: current.counterValue >= behavior.threshold,
      };
    case "oscillator":
      return {
        kind: "oscillator",
        periodSeconds: behavior.periodSeconds,
        running: inputs.total === 0 || inputs.active > 0,
        output: current.output,
      };
    case "delay":
      return {
        kind: "delay",
        delaySeconds: behavior.delaySeconds,
        pending: current.delayTarget !== null,
        remainingSeconds: Math.max(0, current.delayRemainingSeconds),
        output: current.output,
      };
    default:
      return undefined;
  }
}
