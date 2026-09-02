import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { SignalEdge } from "./signal-edge.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

/**
 * El grafo de señal MENOS los cables quemados (Subfase 14a-4).
 *
 * Desde 14a-4 una arista se puede sobrecargar y cortarse
 * (`MissionOverloadRuntime`), y `failureMode: "cut"` para un recurso `E`
 * significa literalmente eso: el cable deja de conducir. Sin este filtro la
 * cicatriz sería puramente cosmética — la señal seguiría pasando por un cable
 * carbonizado, que es la clase de mentira de la UI que este proyecto ya pagó
 * varias rondas de playtest.
 *
 * Vive como punto ÚNICO a propósito, porque lo consultan dos dominios que no se
 * conocen entre sí:
 *  - la evaluación de señal (`MissionSignalRuntime`): la señal no propaga,
 *  - la carga eléctrica (`power/conductor-load.ts`): la carga se REDISTRIBUYE,
 *    o sea que quemar un cable descarga a los demás. Es la consecuencia
 *    sistémica que hace que la cadena de fallos no sea una lista de eventos
 *    sueltos.
 *
 * Lo que NO hace es enseñarle al `SignalEvaluator` qué es una sobrecarga: el
 * evaluador sigue recibiendo un grafo y evaluándolo, sin saber por qué le
 * faltan aristas.
 */
export function activeSignalEdges(blueprint: Blueprint): ReadonlyArray<SignalEdge> {
  // Camino rápido y sin allocation para el caso abrumadoramente común: nada
  // quemado. `overloadedRefs` es heterogéneo (instancias + aristas), así que un
  // `length === 0` es el único chequeo barato que sirve.
  if (blueprint.overloadedRefs.length === 0) {
    return blueprint.signalGraph.edges;
  }
  return blueprint.signalGraph.edges.filter((edge) => !blueprint.overloadedRefs.includes(edge.id));
}

/** ¿Este cable se quemó? Consulta puntual, mismo criterio que `activeSignalEdges`. */
export function isEdgeBurned(blueprint: Blueprint, edge: SignalEdge): boolean {
  return blueprint.overloadedRefs.includes(edge.id);
}

/** El grafo completo con las aristas quemadas retiradas — para quien necesita un `SignalGraph`. */
export function activeSignalGraph(blueprint: Blueprint): SignalGraph<PlacedComponentInstanceId> {
  return { nodes: blueprint.signalGraph.nodes, edges: activeSignalEdges(blueprint) };
}

/**
 * Cuántos cables QUEMADOS tocan a una pieza, entrantes y salientes (14a-4,
 * ronda 3 de playtest).
 *
 * Existe porque una pieza perfectamente sana necesita poder decir que su
 * cableado no lo está. El operador quemó el tronco `fotorreceptor → chip`, vio
 * la cicatriz encima del chip y no tuvo desde dónde confirmar qué se había
 * roto: *"el tooltip del fotorreceptor no muestra nada mal con él"* — correcto,
 * porque no le pasaba nada, y aun así lo dejaba sin camino hacia la causa.
 *
 * **Las dos direcciones importan.** Ese tronco era saliente del fotorreceptor y
 * ENTRANTE del chip, y el chip fue justo la pieza que pareció rota: contar solo
 * salientes habría dejado mudo al caso reportado.
 *
 * Recorre `signalGraph.edges` y no `activeSignalEdges` a propósito: ese conjunto
 * es precisamente el que EXCLUYE los quemados, que son los que hay que contar.
 */
export function burnedWiresTouching(
  blueprint: Blueprint,
  instanceId: PlacedComponentInstanceId,
): number {
  const ownNodeIds = new Set(
    blueprint.signalGraph.nodes.filter((node) => node.ownerRef === instanceId).map((node) => node.id),
  );
  if (ownNodeIds.size === 0) return 0;
  let count = 0;
  for (const edge of blueprint.signalGraph.edges) {
    if (!ownNodeIds.has(edge.from) && !ownNodeIds.has(edge.to)) continue;
    if (isEdgeBurned(blueprint, edge)) count += 1;
  }
  return count;
}
