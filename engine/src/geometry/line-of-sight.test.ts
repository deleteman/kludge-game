import { describe, expect, it } from "vitest";
import { hasLineOfSight, type CellBlockedQuery } from "./line-of-sight.js";
import type { GridPosition } from "./grid-position.types.js";

function blockedSet(...cells: GridPosition[]): CellBlockedQuery {
  const keys = new Set(cells.map((c) => `${c.x},${c.y}`));
  return { isBlocked: (cell) => keys.has(`${cell.x},${cell.y}`) };
}

describe("geometry: hasLineOfSight", () => {
  it("sees along a clear straight rail", () => {
    expect(hasLineOfSight({ x: 0, y: 3 }, { x: 5, y: 3 }, blockedSet())).toBe(true);
  });

  it("is blocked by a wall cell sitting between the two endpoints", () => {
    const blocked = blockedSet({ x: 2, y: 0 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, blocked)).toBe(false);
  });

  it("sees adjacent cells regardless of what's blocked (only the path in between counts)", () => {
    const blocked = blockedSet({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 1, y: 0 }, blocked)).toBe(true);
  });

  it("ignores blocked cells at the endpoints themselves, only the intermediate path", () => {
    const blocked = blockedSet({ x: 0, y: 0 }, { x: 4, y: 0 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, blocked)).toBe(true);
  });

  it("diagonal trajectory: a true diagonal step does not check the two orthogonal corner cells", () => {
    // Criterio fijado por el algoritmo (Bresenham simple, no supercover): de
    // (0,0) a (2,2) el paso diagonal visita (0,0)->(1,1)->(2,2), nunca (1,0)
    // ni (0,1) — aunque esas dos "esquinas" estén bloqueadas, la LOS diagonal
    // se considera despejada mientras la celda intermedia real (1,1) lo esté.
    const blocked = blockedSet({ x: 1, y: 0 }, { x: 0, y: 1 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 2, y: 2 }, blocked)).toBe(true);
  });

  it("diagonal trajectory is still blocked if the intermediate diagonal cell itself is blocked", () => {
    const blocked = blockedSet({ x: 1, y: 1 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 2, y: 2 }, blocked)).toBe(false);
  });

  it("works symmetrically regardless of direction", () => {
    const blocked = blockedSet({ x: 3, y: 3 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 6, y: 6 }, blocked)).toBe(false);
    expect(hasLineOfSight({ x: 6, y: 6 }, { x: 0, y: 0 }, blocked)).toBe(false);
  });

  it("returns true for the same cell", () => {
    expect(hasLineOfSight({ x: 2, y: 2 }, { x: 2, y: 2 }, blockedSet())).toBe(true);
  });
});
