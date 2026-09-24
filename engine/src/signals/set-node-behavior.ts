import { inputPortsOf } from "./edge-port.js";
import type { SignalBehavior } from "./signal-behavior.types.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

/**
 * Configuración del comportamiento lógico de un nodo de un grafo YA construido
 * (Subfase 14b-3). Hasta ahora `behavior` sólo se fijaba al crear el nodo
 * (`addSignalNode`, o el dato de un capítulo), así que el jugador no tenía
 * forma de construir AND/OR/NOT sobre su propio cableado.
 *
 * Es una función pura sobre el grafo (devuelve otro grafo), igual que
 * `connectNodes` en el banco de trabajo: quien la llame decide dónde guardar el
 * resultado (el `Blueprint` vivo en la misión, el `WorkbenchState` en la mesa).
 */

export type SetNodeBehaviorIssue =
  | "unknown-node"
  /** Los emisores ignoran el behavior — su salida la fija el mundo. */
  | "emitter-not-configurable"
  | "invalid-parameter";

export type SetNodeBehaviorResult<TOwnerRef> =
  | { readonly ok: true; readonly graph: SignalGraph<TOwnerRef> }
  | { readonly ok: false; readonly issue: SetNodeBehaviorIssue };

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

/** ¿Los parámetros numéricos del behavior tienen sentido físico? */
export function isValidSignalBehavior(behavior: SignalBehavior): boolean {
  switch (behavior.kind) {
    case "oscillator":
      return isPositiveFinite(behavior.periodSeconds);
    case "delay":
      return isPositiveFinite(behavior.delaySeconds);
    case "counter":
      return Number.isInteger(behavior.threshold) && behavior.threshold >= 1;
    default:
      return true;
  }
}

/** Igualdad por valor: los behaviors son datos planos de un nivel. */
export function signalBehaviorsEqual(a: SignalBehavior | undefined, b: SignalBehavior | undefined): boolean {
  const left = a ?? { kind: "passthrough" };
  const right = b ?? { kind: "passthrough" };
  return JSON.stringify(left) === JSON.stringify(right);
}

export function setNodeBehavior<TOwnerRef>(
  graph: SignalGraph<TOwnerRef>,
  nodeId: SignalNodeId,
  behavior: SignalBehavior,
): SetNodeBehaviorResult<TOwnerRef> {
  const target = graph.nodes.find((node) => node.id === nodeId);
  if (!target) return { ok: false, issue: "unknown-node" };
  if (target.role === "emitter") return { ok: false, issue: "emitter-not-configurable" };
  if (!isValidSignalBehavior(behavior)) return { ok: false, issue: "invalid-parameter" };
  if (signalBehaviorsEqual(target.behavior, behavior)) return { ok: true, graph };

  // Los puertos de los cables entrantes tienen que seguir existiendo en el behavior
  // nuevo. Si no, un cable que venía marcado "count" hacia un contador quedaría
  // hacia un latch como una entrada que no es set NI reset: la regla la ignora y
  // el jugador vería un cable conectado que no hace nada. Se vuelve al default.
  const validPorts = inputPortsOf(behavior);
  const edges = graph.edges.map((edge) =>
    edge.to === nodeId && edge.toPort !== undefined && !validPorts.includes(edge.toPort)
      ? { ...edge, toPort: undefined }
      : edge,
  );
  return {
    ok: true,
    graph: { ...graph, edges, nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, behavior } : node)) },
  };
}
