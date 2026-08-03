import type { GridPosition } from "./grid-position.types.js";

/**
 * Puerto mínimo de "¿esta celda está bloqueada?" — deliberadamente sin
 * concepto de pared/tilemap/Tiled. El dato de paredes real hoy vive solo en
 * `/game` (tile layer `walls`, parseada vía Phaser en `walkable-grid.ts`);
 * `/engine` es TS puro (CLAUDE.md) y no puede depender de eso. Quien
 * construye la implementación concreta (típicamente `/game`, adaptando un
 * `WalkableGrid` ya cargado) decide qué significa "bloqueado".
 */
export interface CellBlockedQuery {
  isBlocked(cell: GridPosition): boolean;
}

/**
 * Línea de visión entre dos celdas del grid (Fase 13a, sensor óptico
 * simulado). Recorre las celdas intermedias con un algoritmo tipo Bresenham
 * y falla si alguna de ellas (sin contar los extremos `from`/`to`) está
 * bloqueada — un sensor puede "ver" su propia celda y la celda del objetivo
 * aunque casualmente estuvieran marcadas como bloqueadas, solo el camino
 * entremedio importa.
 */
export function hasLineOfSight(from: GridPosition, to: GridPosition, blocked: CellBlockedQuery): boolean {
  for (const cell of cellsBetween(from, to)) {
    if ((cell.x !== from.x || cell.y !== from.y) && (cell.x !== to.x || cell.y !== to.y) && blocked.isBlocked(cell)) {
      return false;
    }
  }
  return true;
}

/** Celdas visitadas por Bresenham entre `from` y `to`, incluyendo ambos extremos. */
function cellsBetween(from: GridPosition, to: GridPosition): GridPosition[] {
  const cells: GridPosition[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    cells.push({ x, y });
    if (x === to.x && y === to.y) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}
