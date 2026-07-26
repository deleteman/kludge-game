import type { GridPosition } from "./grid-position.types.js";

/**
 * Distancia entre dos celdas del grid, en celdas.
 *
 * Métrica Manhattan (|dx| + |dy|), decisión del operador (Fase 11a, 2026-07-17)
 * que cierra el pendiente que `kinetics/magnetic-field.ts` dejó abierto a
 * propósito hasta que existiera el primer llamador con un proyectil
 * posicionado sobre el plano (ese llamador es `kinetics/projectile-simulation.ts`).
 *
 * Razón de Manhattan sobre euclídea: el proyectil viaja por un riel recto
 * sobre el grid, y la distancia tiene que ser CONTABLE A OJO por el jugador
 * para que espaciar bobinas sea una decisión informada y no ensayo y error
 * (GDD principio de legibilidad). Una euclídea daría distancias fraccionarias
 * que nadie puede estimar mirando el plano, y el decaimiento por distancia
 * (`intensityAtDistance`) dejaría de ser predecible.
 */
export function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
