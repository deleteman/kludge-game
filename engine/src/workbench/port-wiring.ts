import type { GridPosition } from "../geometry/grid-position.types.js";
import type { SignalEdge, SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import { validateSignalGraphIntegrity } from "../signals/signal-graph-integrity.js";
import type { SignalNode, SignalNodeId } from "../signals/signal-node.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionsConnectedByConduit } from "../floorplan/conduit-connectivity.js";
import { WorkbenchError, type WorkbenchPieceId } from "./workbench-state.types.js";

/**
 * Conexión externa de puertos tras la instalación (GDD 10.1 párrafo 7):
 * instalar el compuesto en el plano NO lo conecta automáticamente — sus
 * puertos externos se cablean después, igual que cualquier componente de
 * fábrica. Reutiliza `SignalGraph<PlacedComponentInstanceId>` sin modelo
 * nuevo; es la primera implementación de "editar el signalGraph de un
 * Blueprint ya instanciado" (Fase 5 solo hizo render estático), reutilizable
 * por cualquier editor de plano futuro, no solo por la mesa de creación.
 */

/**
 * Traduce los nodos de la mesa (posición local, `ownerRef` por pieza) a
 * nodos del plano (posición global, `ownerRef` = la instancia instalada) —
 * la creación se trata como caja negra: todos sus nodos internos pasan a
 * pertenecer a la MISMA instancia instalada, sin re-derivar posiciones
 * internas por rotación (decisión confirmada, ver `installation-placement.ts`).
 */
export function translateWorkbenchNodesToBlueprint(
  workbenchGraph: SignalGraph<WorkbenchPieceId>,
  installedInstanceId: PlacedComponentInstanceId,
  installedPosition: GridPosition,
): SignalGraph<PlacedComponentInstanceId> {
  const nodes: SignalNode<PlacedComponentInstanceId>[] = workbenchGraph.nodes.map((node) => ({
    ...node,
    ownerRef: installedInstanceId,
    position: {
      x: installedPosition.x + node.position.x,
      y: installedPosition.y + node.position.y,
    },
  }));

  return { nodes, edges: workbenchGraph.edges };
}

/**
 * Incorpora el grafo de señales interno de una creación ya instalada (nodos
 * traducidos, sin edges hacia el resto del plano) al `signalGraph` del
 * `Blueprint` — paso intermedio entre instalar (`installation.ts`, que no
 * toca el grafo de señales) y cablear puertos externos (`wireExternalPort`).
 */
export function mergeInstalledSignalGraph(
  blueprint: Blueprint,
  translatedGraph: SignalGraph<PlacedComponentInstanceId>,
): Blueprint {
  const nextSignalGraph = {
    nodes: [...blueprint.signalGraph.nodes, ...translatedGraph.nodes],
    edges: [...blueprint.signalGraph.edges, ...translatedGraph.edges],
  };

  const issues = validateSignalGraphIntegrity(nextSignalGraph);
  if (issues.length > 0) {
    throw new WorkbenchError(`Invalid merged signal graph: ${JSON.stringify(issues)}`);
  }

  return { ...blueprint, signalGraph: nextSignalGraph };
}

/** Nodos de señal expuestos por una instancia recién instalada — candidatos a cablear externamente. */
export function exposeExternalPorts(
  blueprint: Blueprint,
  installedInstanceId: PlacedComponentInstanceId,
): ReadonlyArray<SignalNode<PlacedComponentInstanceId>> {
  return blueprint.signalGraph.nodes.filter((node) => node.ownerRef === installedInstanceId);
}

/**
 * El cable cruza un límite de sección sin un conducto `senal` que lo permita
 * (Fase 11f, mecánica de cableado restringido). Subclase de `WorkbenchError`
 * para que `/game` la distinga del resto de errores de cableado (nodo a sí
 * mismo, grafo inválido) y muestre un mensaje localizado propio en vez del
 * texto crudo.
 */
export class SignalWiringUnreachableError extends WorkbenchError {}

/**
 * Regla de MISIÓN sobre el cableado (Fase 11f, decisión del operador): un
 * cable de señal solo puede cruzar de una sección a otra si existe un camino
 * de conductos `senal` entre ellas (directo o multi-salto). Dentro de una
 * misma sección no hay restricción. Vive aparte de `wireExternalPort` (que es
 * una operación pura de grafo, sin geometría) porque necesita el
 * `ShipFloorplan` — y son cosas de capas distintas: el grafo no sabe de
 * conductos. La llaman los dos únicos puntos que cablean sobre el plano real:
 * el preview del controller de `/game` y el efecto de la tarea `connect`.
 *
 * Si algún extremo no cae en ninguna sección (nodo sobre una arista/pared),
 * no bloquea: no se puede afirmar que cruza un límite, así que fail-open.
 */
export function assertSignalWiringReachable(
  floorplan: ShipFloorplan,
  graph: SignalGraph<PlacedComponentInstanceId>,
  fromNodeId: SignalNodeId,
  toNodeId: SignalNodeId,
): void {
  const fromNode = graph.nodes.find((node) => node.id === fromNodeId);
  const toNode = graph.nodes.find((node) => node.id === toNodeId);
  if (!fromNode || !toNode) return; // Nodo inexistente: lo detecta la integridad del grafo.

  const sectionA = sectionContainingCell(floorplan, fromNode.position);
  const sectionB = sectionContainingCell(floorplan, toNode.position);
  if (!sectionA || !sectionB) return; // Sección indeterminable: no bloquea.
  if (sectionA.id === sectionB.id) return; // Intra-sección: libre.

  if (!sectionsConnectedByConduit(floorplan, "senal", sectionA.id, sectionB.id)) {
    throw new SignalWiringUnreachableError(
      `No hay conducto de señal entre las secciones "${sectionA.id}" y "${sectionB.id}": el cable no puede cruzar el casco.`,
    );
  }
}

/**
 * Cablea manualmente un puerto externo a otro nodo ya existente en el plano
 * — mismo gesto que cablear cualquier componente de fábrica (GDD 10.1). No
 * hay conexión implícita: el llamador elige explícitamente los dos nodos.
 */
export function wireExternalPort(
  blueprint: Blueprint,
  edgeId: SignalEdgeId,
  fromNodeId: SignalNodeId,
  toNodeId: SignalNodeId,
  toPort?: string,
): Blueprint {
  if (fromNodeId === toNodeId) {
    throw new WorkbenchError(`Cannot wire a signal node to itself: ${fromNodeId}`);
  }

  const edge: SignalEdge = { id: edgeId, from: fromNodeId, to: toNodeId, toPort };
  const nextSignalGraph = {
    ...blueprint.signalGraph,
    edges: [...blueprint.signalGraph.edges, edge],
  };

  const issues = validateSignalGraphIntegrity(nextSignalGraph);
  if (issues.length > 0) {
    throw new WorkbenchError(`Invalid external port wiring: ${JSON.stringify(issues)}`);
  }

  return { ...blueprint, signalGraph: nextSignalGraph };
}
