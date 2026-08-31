import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

/**
 * Recorridos del grafo de señal, en las dos direcciones (Subfase 14a-2).
 *
 * `upstreamNodes` vivía como función privada dentro de
 * `mission/mission-projectile-world.ts`, donde la usa `currentFeeding` para
 * encontrar el `RES(E)` que alimenta una bobina. La carga eléctrica derivada de
 * 14a-2 necesita el recorrido SIMÉTRICO (qué piezas cuelgan de un conductor), y
 * copiar el BFS habría dejado dos implementaciones del mismo recorrido con la
 * misma tolerancia a ciclos escrita dos veces — exactamente el patrón que ya
 * costó una ronda de playtest con `dynamic-light.ts`.
 *
 * Ninguna de las dos conoce roles ni energía: devuelven nodos alcanzables. Quién
 * decide qué significa eso (corriente, consumo, señal) es el llamador.
 */

/**
 * Nodos que alcanzan a `target` siguiendo las aristas hacia atrás. Incluye al
 * propio `target`. BFS con conjunto de visitados: tolera ciclos, que el grafo
 * admite a propósito desde que existe el latch (GDD 5.6, "un receptor puede
 * retroalimentar su propia salida").
 */
export function upstreamNodes(blueprint: Blueprint, target: SignalNodeId): ReadonlySet<SignalNodeId> {
  return traverse(blueprint, target, "upstream");
}

/**
 * Nodos alcanzables DESDE `source` siguiendo las aristas hacia adelante.
 * Incluye al propio `source`. Misma tolerancia a ciclos que `upstreamNodes`.
 */
export function downstreamNodes(blueprint: Blueprint, source: SignalNodeId): ReadonlySet<SignalNodeId> {
  return traverse(blueprint, source, "downstream");
}

function traverse(
  blueprint: Blueprint,
  origin: SignalNodeId,
  direction: "upstream" | "downstream",
): ReadonlySet<SignalNodeId> {
  const seen = new Set<SignalNodeId>([origin]);
  const pending: SignalNodeId[] = [origin];
  while (pending.length > 0) {
    const current = pending.pop() as SignalNodeId;
    for (const edge of blueprint.signalGraph.edges) {
      const from = direction === "upstream" ? edge.to : edge.from;
      const to = direction === "upstream" ? edge.from : edge.to;
      if (from === current && !seen.has(to)) {
        seen.add(to);
        pending.push(to);
      }
    }
  }
  return seen;
}
