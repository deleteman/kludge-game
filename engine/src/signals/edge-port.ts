import type { SignalBehavior } from "./signal-behavior.types.js";
import type { SignalEdgeId } from "./signal-edge.types.js";
import type { SignalGraph } from "./signal-graph.types.js";

/**
 * Puertos de entrada que un behavior distingue (Subfase 14b-3). Sólo el latch y
 * el contador tratan sus entradas de forma asimétrica; el resto ignora
 * `SignalEdge.toPort`. Es la fuente única de "qué puertos existen": la regla de
 * cada behavior los lee por su cuenta (`rules/`), y esto es lo que el panel del
 * cable ofrece.
 *
 * Una entrada SIN puerto cuenta como la primera de la lista (set / count), así
 * que el primer puerto es también el default.
 */
export function inputPortsOf(behavior: SignalBehavior | undefined): ReadonlyArray<string> {
  switch (behavior?.kind) {
    case "latch":
      return ["set", "reset"];
    case "counter":
      return ["count", "reset"];
    default:
      return [];
  }
}

/** Puerto efectivo de un cable: el declarado, o el default del behavior destino. */
export function effectiveInputPort(behavior: SignalBehavior | undefined, toPort: string | undefined): string | undefined {
  const ports = inputPortsOf(behavior);
  return toPort ?? ports[0];
}

export type SetEdgePortIssue = "unknown-edge" | "port-not-supported";

export type SetEdgePortResult<TOwnerRef> =
  | { readonly ok: true; readonly graph: SignalGraph<TOwnerRef> }
  | { readonly ok: false; readonly issue: SetEdgePortIssue };

/**
 * Fija a qué puerto del nodo destino llega un cable ya tendido. El puerto tiene
 * que existir en el behavior VIVO del destino: no se guarda un "reset" en una
 * compuerta AND, donde nadie lo leería y el jugador creería haber cableado un
 * reinicio.
 */
export function setEdgePort<TOwnerRef>(
  graph: SignalGraph<TOwnerRef>,
  edgeId: SignalEdgeId,
  port: string,
): SetEdgePortResult<TOwnerRef> {
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return { ok: false, issue: "unknown-edge" };
  const target = graph.nodes.find((node) => node.id === edge.to);
  if (!inputPortsOf(target?.behavior).includes(port)) return { ok: false, issue: "port-not-supported" };
  if (effectiveInputPort(target?.behavior, edge.toPort) === port && edge.toPort === port) return { ok: true, graph };
  return {
    ok: true,
    graph: { ...graph, edges: graph.edges.map((candidate) => (candidate.id === edgeId ? { ...candidate, toPort: port } : candidate)) },
  };
}
