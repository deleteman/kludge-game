import type { Footprint, GridPosition, Rotation } from "../geometry/grid-position.types.js";
import { occupiedCells } from "./workbench-state.types.js";

/**
 * Rotación al instalar (GDD 10.1: "rotación del footprint permitida antes de
 * confirmar la colocación"). Decisión confirmada con el operador: solo afecta
 * el rectángulo EXTERIOR para el chequeo de encaje — las posiciones internas
 * de las piezas/nodos de la creación no se re-derivan aquí (la creación
 * instalada se trata como caja negra, GDD 10.1 párrafo 7); si hiciera falta
 * visualizar el interior rotado, es un problema de Fase 8.
 */
export function rotateExteriorFootprint(footprint: Footprint, rotation: Rotation): Footprint {
  return rotation === 90 || rotation === 270
    ? { width: footprint.height, height: footprint.width }
    : footprint;
}

/** Celdas absolutas que ocuparía un footprint anclado en `anchor` con la rotación dada. */
export function candidateCellsInSection(
  footprint: Footprint,
  anchor: GridPosition,
  rotation: Rotation,
): GridPosition[] {
  return occupiedCells({ position: anchor, footprint, rotation });
}
