import type { GridPosition } from "engine";
import type { WalkableGrid } from "../render/walkable-grid.js";

/**
 * Pathfinding de tripulación sobre la grilla transitable del plano (Fase 10d,
 * ajuste post-playtest #4). BFS 4-direccional — la grilla es chica (≤880
 * celdas en la nave más grande) y el coste de todas las celdas es uniforme,
 * así que BFS da el camino más corto sin necesidad de A* ni de una librería
 * externa. Puramente visual: alimenta la animación de saltos encadenados de
 * `hop-movement.ts`, el motor no conoce celdas intermedias.
 */

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/**
 * Camino de celdas de `start` a `goal` (inclusive ambos extremos), UNA celda
 * por paso (sin simplificar tramos rectos), o `undefined` si no hay ruta
 * transitable. El consumidor (`floorplan-scene.ts`) da un salto corto por
 * celda — la sensación buscada es "caminar a saltitos", no un brinco largo que
 * cruza medio pasillo. Si `start`/`goal` caen en una celda no transitable (ej.
 * el centroide de una sección coincide con una pared), se reubican a la celda
 * transitable más cercana antes de correr el BFS.
 */
export function findPath(
  grid: WalkableGrid,
  start: GridPosition,
  goal: GridPosition,
): GridPosition[] | undefined {
  const from = grid.isWalkable(start.x, start.y) ? start : nearestWalkable(grid, start);
  const to = grid.isWalkable(goal.x, goal.y) ? goal : nearestWalkable(grid, goal);
  if (!from || !to) return undefined;

  return bfs(grid, from, to);
}

/** Flood-fill 4-direccional buscando la celda transitable más cercana a `origin`. */
function nearestWalkable(grid: WalkableGrid, origin: GridPosition): GridPosition | undefined {
  const visited = new Set<number>();
  const queue: GridPosition[] = [origin];
  visited.add(key(grid, origin));
  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (grid.isWalkable(cell.x, cell.y)) return cell;
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= grid.width || next.y >= grid.height) continue;
      const k = key(grid, next);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(next);
    }
  }
  return undefined;
}

function bfs(grid: WalkableGrid, start: GridPosition, goal: GridPosition): GridPosition[] | undefined {
  const startKey = key(grid, start);
  const goalKey = key(grid, goal);
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>([startKey]);
  const queue: GridPosition[] = [start];

  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (key(grid, cell) === goalKey) {
      return reconstruct(grid, cameFrom, start, goal);
    }
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      if (!grid.isWalkable(next.x, next.y)) continue;
      const k = key(grid, next);
      if (visited.has(k)) continue;
      visited.add(k);
      cameFrom.set(k, key(grid, cell));
      queue.push(next);
    }
  }
  return undefined;
}

function reconstruct(
  grid: WalkableGrid,
  cameFrom: Map<number, number>,
  start: GridPosition,
  goal: GridPosition,
): GridPosition[] {
  const path: GridPosition[] = [goal];
  let current = key(grid, goal);
  const startKey = key(grid, start);
  while (current !== startKey) {
    const prev = cameFrom.get(current);
    if (prev === undefined) break;
    path.push({ x: prev % grid.width, y: Math.floor(prev / grid.width) });
    current = prev;
  }
  path.reverse();
  return path;
}

function key(grid: WalkableGrid, cell: GridPosition): number {
  return cell.y * grid.width + cell.x;
}
