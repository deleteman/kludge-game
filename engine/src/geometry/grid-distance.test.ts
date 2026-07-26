import { describe, expect, it } from "vitest";
import { manhattanDistance } from "./grid-distance.js";

describe("geometry: manhattanDistance", () => {
  it("returns 0 for the same cell", () => {
    expect(manhattanDistance({ x: 4, y: 7 }, { x: 4, y: 7 })).toBe(0);
  });

  it("counts cells along a straight rail (the coilgun case)", () => {
    expect(manhattanDistance({ x: 0, y: 3 }, { x: 5, y: 3 })).toBe(5);
    expect(manhattanDistance({ x: 2, y: 1 }, { x: 2, y: 9 })).toBe(8);
  });

  it("sums both axes on a diagonal — no euclidean shortcut", () => {
    // Euclídea daría 5 (3-4-5); Manhattan da 7. La métrica elegida es la que
    // el jugador puede contar celda a celda sobre el plano.
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it("is symmetric and never negative", () => {
    const a = { x: 8, y: 2 };
    const b = { x: 1, y: 6 };
    expect(manhattanDistance(a, b)).toBe(manhattanDistance(b, a));
    expect(manhattanDistance(a, b)).toBeGreaterThan(0);
  });
});
