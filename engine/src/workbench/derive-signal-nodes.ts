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
 * `RES`/`EST` no generan nodos: no son roles del grafo de señales, solo
 * propiedades del componente físico (ver `signals/signal-node.types.ts`).
 *
 * `ACT` SÍ genera un receptor desde la Subfase 13h. Antes no, con el argumento
 * de que un actuador "no es un rol del grafo" — pero un actuador gobernado por
 * una señal es exactamente un receptor de señales, y sin nodo no había forma de
 * cablearlo. Es lo que dejaba al "panel de compuerta" del Cap.1 siendo un nodo
 * huérfano sin compuerta que gobernar, y lo que habría impedido que una puerta
 * instalada por el jugador se pudiera cablear a nada.
 *
 * Vale para TODO `ACT`, no solo para puertas (principio 1): una torreta
 * instalada de catálogo queda cableable a cualquier sensor por el mismo
 * mecanismo, que es literalmente el caso de validación 1.
 *
 * **Ronda 1 de playtest de 14a-4**: un `ACT` genera además un **emisor de
 * salida**. Pedido del operador: "cada vez que un ACT se activa, debería emitir
 * señal — es una buena forma de conectar triggers y encolar efectos". El motor
 * ya propagaba la salida de cualquier nodo, pero `orientSignalWiring` rechaza
 * receptor→receptor, así que no existía ninguna combinación de clicks que
 * produjera un cable SALIENDO de una puerta. Con un emisor de verdad, cablear
 * "puerta → otra cosa" es legal sin tocar la orientación.
 *
 * El valor de ese emisor es el estado **REAL** del actuador, no la orden que lo
 * gobierna (decisión del operador, 2026-09-01): una puerta trabada o sin motor
 * no emite, aunque la señal le esté ordenando abrirse. Lo resuelve
 * `actuatorEmitterInputs` (`mission/actuator-emitter-input-source.ts`) contra los
 * runtimes del mundo; sin él, el nodo caería en el fail-open de
 * `allEmittersActive` y quedaría permanentemente disparado (deuda #40).
 */
const FUNCTIONAL_TAG_TO_ROLE: Partial<Record<FunctionalProperty["tag"], SignalNodeRole>> = {
  EM: "emitter",
  REC: "receptor",
  ACT: "receptor",
  COND: "conductor",
};

/**
 * Sufijo del nodo de SALIDA de un actuador (14a-4 ronda 1). Se deriva del id del
 * nodo receptor del mismo `ACT` en vez de consumir un índice más, para que
 * agregar la salida no corra los ids de los nodos que ya existían — eso habría
 * dejado huérfana toda arista guardada que apuntara a un nodo posterior.
 */
const ACTUATOR_OUTPUT_SUFFIX = ":out";

/** Id del emisor de salida que acompaña al receptor `ACT` de `nodeId`. */
export function actuatorOutputNodeId(receptorNodeId: SignalNodeId): SignalNodeId {
  return `${receptorNodeId}${ACTUATOR_OUTPUT_SUFFIX}` as SignalNodeId;
}

/** ¿Este nodo es la SALIDA de un actuador? (la gobierna el mundo, no sus entradas). */
export function isActuatorOutputNode(nodeId: SignalNodeId): boolean {
  return nodeId.endsWith(ACTUATOR_OUTPUT_SUFFIX);
}

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
    const id = `${ownerRef}:${role}:${index}` as SignalNodeId;
    nodes.push({ id, role, position, ownerRef });
    index += 1;

    // Salida del actuador (14a-4 ronda 1). Comparte celda con su receptor a
    // propósito: son las dos caras de la MISMA pieza, y separarlas por celdas
    // haría que la salida de una puerta de 1 celda cayera fuera de la puerta.
    // Que dos nodos compartan celda lo resuelve la capa de UI, dibujándolos con
    // un desplazamiento y eligiendo el más cercano al click.
    if (property.tag === "ACT") {
      nodes.push({
        id: actuatorOutputNodeId(id),
        role: "emitter",
        position,
        ownerRef,
      });
    }
  }

  return nodes;
}
