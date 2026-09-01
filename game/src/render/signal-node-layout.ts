import { GRID_CELL_SIZE_PX } from "engine";
import type { GridPosition, SignalNode, SignalNodeId } from "engine";

/**
 * Dónde se dibuja —y dónde se clickea— cada nodo de señal (Subfase 14a-4,
 * ronda 1 de playtest).
 *
 * Hasta acá los nodos se pintaban en el centro exacto de su celda y el modo
 * cableado los buscaba por celda. Funcionaba porque `deriveSignalNodes` repartía
 * un nodo por celda del footprint… salvo cuando había más nodos que celdas, caso
 * que su propio docblock ya admitía como agujero: los sobrantes caían en la
 * última celda, se dibujaban uno encima de otro y **solo el primero era
 * clickeable**.
 *
 * 14a-4 lo volvió la norma en vez de la excepción: un `ACT` ahora expone entrada
 * y salida en la misma celda, así que toda puerta de 1 celda tiene dos nodos
 * superpuestos. También arregla a `torreta-automatizada` y `dron-reconocimiento`,
 * que ya tenían `EM` + `ACT` y un nodo oculto desde siempre.
 *
 * Es una función pura y compartida a propósito: el dibujo y el hit-test tienen
 * que estar de acuerdo sobre dónde está cada punto, y dos cálculos separados se
 * desincronizan en cuanto uno cambie de criterio.
 */

/** Radio del círculo de un nodo, en píxeles. */
export const SIGNAL_NODE_RADIUS_PX = 7;

/**
 * Cuánto se separan del centro los nodos que comparten celda. Es poco más que
 * el radio: lo justo para que los dos círculos se distingan y sigan cayendo
 * dentro de su celda, sin que parezcan estar en la celda de al lado.
 */
const SHARED_CELL_OFFSET_PX = 8;

export interface PositionedSignalNode {
  readonly id: SignalNodeId;
  readonly role: SignalNode["role"];
  readonly cell: GridPosition;
  /** Centro en píxeles donde se dibuja y contra el que se mide el click. */
  readonly x: number;
  readonly y: number;
}

/**
 * Reparte los nodos en píxeles. Los que están solos en su celda quedan en el
 * centro exacto (idéntico a antes de 14a-4: una nave sin actuadores cableables
 * se ve igual que siempre); los que comparten celda se abren en abanico.
 */
export function layoutSignalNodes(
  nodes: ReadonlyArray<SignalNode<unknown>>,
): ReadonlyArray<PositionedSignalNode> {
  const byCell = new Map<string, SignalNode<unknown>[]>();
  for (const node of nodes) {
    const key = `${node.position.x},${node.position.y}`;
    const bucket = byCell.get(key);
    if (bucket) {
      bucket.push(node);
    } else {
      byCell.set(key, [node]);
    }
  }

  const positioned: PositionedSignalNode[] = [];
  for (const bucket of byCell.values()) {
    const centerX = bucket[0]!.position.x * GRID_CELL_SIZE_PX + GRID_CELL_SIZE_PX / 2;
    const centerY = bucket[0]!.position.y * GRID_CELL_SIZE_PX + GRID_CELL_SIZE_PX / 2;
    for (const [index, node] of bucket.entries()) {
      // Un solo nodo: centro exacto, sin desvío.
      if (bucket.length === 1) {
        positioned.push({ id: node.id, role: node.role, cell: node.position, x: centerX, y: centerY });
        continue;
      }
      // Varios: abanico regular alrededor del centro. Arranca a la izquierda
      // (ángulo π) para que en el caso de DOS —el habitual desde 14a-4: entrada
      // y salida de un actuador— queden repartidos en horizontal, que es como
      // se leen las dos caras de una pieza.
      const angle = Math.PI + (index * 2 * Math.PI) / bucket.length;
      positioned.push({
        id: node.id,
        role: node.role,
        cell: node.position,
        x: centerX + Math.cos(angle) * SHARED_CELL_OFFSET_PX,
        y: centerY + Math.sin(angle) * SHARED_CELL_OFFSET_PX,
      });
    }
  }
  return positioned;
}

/**
 * Nodo bajo un punto del mundo, o `undefined` si no hay ninguno cerca.
 *
 * Sustituye al `find` por celda del modo cableado: con dos nodos en una celda,
 * buscar por celda devolvía siempre el primero y el segundo era inalcanzable.
 * Se elige el MÁS CERCANO dentro del radio de click, así que el jugador apunta
 * al punto que ve, no a la celda que lo contiene.
 */
export function signalNodeAtPoint(
  positioned: ReadonlyArray<PositionedSignalNode>,
  worldX: number,
  worldY: number,
  /** Radio de tolerancia. Algo más generoso que el círculo para no exigir precisión de píxel. */
  radiusPx = SIGNAL_NODE_RADIUS_PX + 3,
): PositionedSignalNode | undefined {
  let best: PositionedSignalNode | undefined;
  let bestDistance = radiusPx;
  for (const node of positioned) {
    const distance = Math.hypot(node.x - worldX, node.y - worldY);
    if (distance <= bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}
