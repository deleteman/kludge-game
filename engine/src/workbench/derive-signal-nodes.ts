import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";
import type { FunctionalProperties, FunctionalProperty } from "../properties/functional.types.js";
import type { SignalNode, SignalNodeId, SignalNodeRole } from "../signals/signal-node.types.js";
import { occupiedCells } from "./workbench-state.types.js";

/**
 * Deriva los `SignalNode` de una pieza instalada en runtime a partir de sus
 * propiedades funcionales (decisión del operador, 11c.0): los nodos no se
 * declaran en el catálogo, emergen de EM/REC/COND (principio 1 — combinaciones
 * por propiedades, no por identidad). Es el análogo, para una instalación
 * directa de catálogo, de `translateWorkbenchNodesToBlueprint` (que traduce
 * nodos ya autorados a mano en la mesa); ambos alimentan
 * `mergeInstalledSignalGraph`.
 *
 * `ACT`/`RES`/`EST` no generan nodos: no son roles del grafo de señales, solo
 * propiedades del componente físico (ver `signals/signal-node.types.ts`).
 */
const FUNCTIONAL_TAG_TO_ROLE: Partial<Record<FunctionalProperty["tag"], SignalNodeRole>> = {
  EM: "emitter",
  REC: "receptor",
  COND: "conductor",
};

export function deriveSignalNodes(
  functional: FunctionalProperties | undefined,
  ownerRef: PlacedComponentInstanceId,
  placement: PlacedFootprint,
): SignalNode<PlacedComponentInstanceId>[] {
  if (!functional) {
    return [];
  }

  const cells = occupiedCells(placement);
  const nodes: SignalNode<PlacedComponentInstanceId>[] = [];
  let index = 0;

  for (const property of functional) {
    const role = FUNCTIONAL_TAG_TO_ROLE[property.tag];
    if (!role) {
      continue;
    }

    // Una celda distinta por nodo para que el `find` por posición del modo
    // cableado no colisione. Caso raro (más roles de señal que celdas, p. ej.
    // una pieza 1×1 con EM+REC+COND): los sobrantes caen en la última celda —
    // solo el primer nodo de esa celda sería seleccionable por posición.
    const position = cells[Math.min(index, cells.length - 1)] ?? placement.position;
    nodes.push({
      id: `${ownerRef}:${role}:${index}` as SignalNodeId,
      role,
      position,
      ownerRef,
    });
    index += 1;
  }

  return nodes;
}
