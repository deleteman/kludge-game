import type { Footprint, GridPosition } from "../geometry/grid-position.types.js";
import {
  effectiveFootprintExtent,
  occupiedCells,
  WorkbenchError,
  type WorkbenchPiece,
} from "./workbench-state.types.js";

/**
 * Rectángulo mínimo que contiene todas las piezas colocadas (GDD 10.1) — no
 * es un valor fijo por receta, sino el bounding box real de la disposición
 * elegida por el jugador. Una disposición compacta ocupa menos que una
 * dispersa.
 */
export function calculateFootprint(pieces: ReadonlyArray<WorkbenchPiece>): Footprint {
  if (pieces.length === 0) {
    throw new WorkbenchError("Cannot calculate footprint of an empty workbench");
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const piece of pieces) {
    const { width, height } = effectiveFootprintExtent(piece.placement);
    const { x, y } = piece.placement.position;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  return { width: maxX - minX, height: maxY - minY };
}

/**
 * Esquina mínima (origen) del bounding box de la disposición — el punto que
 * `calculateFootprint` descarta al devolver solo el tamaño. Necesario para
 * expresar el offset de cada pieza RELATIVO al footprint del compuesto (deuda
 * #8, Fase 12c.5), no en coordenadas absolutas de la mesa.
 */
export function calculateFootprintOrigin(pieces: ReadonlyArray<WorkbenchPiece>): GridPosition {
  if (pieces.length === 0) {
    throw new WorkbenchError("Cannot calculate footprint origin of an empty workbench");
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const piece of pieces) {
    minX = Math.min(minX, piece.placement.position.x);
    minY = Math.min(minY, piece.placement.position.y);
  }
  return { x: minX, y: minY };
}

/**
 * Todas las celdas ocupadas por la disposición completa (unión de las celdas
 * de cada pieza) — el bounding box de `calculateFootprint` puede incluir
 * huecos no ocupados por ninguna pieza; esta función devuelve la ocupación
 * real, usada por futuras validaciones que necesiten diferenciar ambas cosas.
 */
export function calculateOccupiedCells(pieces: ReadonlyArray<WorkbenchPiece>) {
  return pieces.flatMap((piece) => occupiedCells(piece.placement));
}
