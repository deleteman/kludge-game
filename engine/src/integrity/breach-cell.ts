import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { FloorplanSection, ShipFloorplan } from "../floorplan/floorplan.types.js";
import { manhattanDistance } from "../geometry/grid-distance.js";
import type { GridPosition } from "../geometry/grid-position.types.js";

const ORTHOGONAL_NEIGHBOURS: ReadonlyArray<GridPosition> = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * ¿Esta celda toca el exterior de la nave?
 *
 * Criterio: tiene al menos un vecino ortogonal que no pertenece a NINGUNA
 * sección del plano — o porque cae fuera del grid, o porque ahí no hay nave.
 * `sectionContainingCell` ya devuelve `undefined` en ambos casos, así que no
 * hace falta conocer el tamaño del grid.
 */
export function isHullEdgeCell(floorplan: ShipFloorplan, cell: GridPosition): boolean {
  return ORTHOGONAL_NEIGHBOURS.some(
    (offset) => !sectionContainingCell(floorplan, { x: cell.x + offset.x, y: cell.y + offset.y }),
  );
}

/**
 * Dónde se abre la brecha de una sección que colapsa (ronda 1 de playtest de
 * 13f).
 *
 * La primera versión de 13f la abría en el centroide de la sección. Dos
 * problemas: el operador clickeaba una celda y la brecha aparecía en otra, y
 * un agujero al vacío en medio del piso es físicamente falso — el casco está
 * en el borde.
 *
 * Se elige, entre las celdas de la sección que TOCAN el exterior, la más
 * cercana al origen del daño. Así el impacto cinético abre el agujero donde
 * pegó, y una explosión —que no trae celda propia— lo abre en la pared más
 * cercana a donde reventó, no en el medio de la sala.
 *
 * Desempate determinista por `(y, x)`: dos partidas con el mismo daño abren la
 * brecha en la misma celda, que es lo que hace testeable la persistencia de la
 * cicatriz.
 *
 * Sin ninguna celda de borde (imposible en el mapa real, pero el código no lo
 * asume) cae a la celda de la sección más cercana al origen.
 */
export function hullBreachCell(
  floorplan: ShipFloorplan,
  section: FloorplanSection,
  origin: GridPosition,
): GridPosition {
  const edge = section.cells.filter((cell) => isHullEdgeCell(floorplan, cell));
  const candidates = edge.length > 0 ? edge : section.cells;
  const first = candidates[0];
  if (!first) {
    return origin;
  }
  return candidates.reduce((best, cell) => {
    const distance = manhattanDistance(cell, origin);
    const bestDistance = manhattanDistance(best, origin);
    if (distance !== bestDistance) {
      return distance < bestDistance ? cell : best;
    }
    if (cell.y !== best.y) {
      return cell.y < best.y ? cell : best;
    }
    return cell.x < best.x ? cell : best;
  }, first);
}
