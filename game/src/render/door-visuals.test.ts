import { describe, expect, it } from "vitest";
import { withDoorState, type WalkableGrid } from "./walkable-grid.js";

/**
 * Smoke tests de la capa visual/navegación de puertas (Subfase 13h).
 *
 * Estándar laxo de `/game` (CLAUDE.md: smoke visual, no cobertura exhaustiva).
 * Lo que se cubre acá es lo que NO se ve a ojo aunque se rompa: que el grid
 * decorado siga leyendo el estado vivo, y que la dirección del flujo sea la
 * correcta. Que la barra de la puerta se dibuje bonita se verifica jugando.
 */
function grid(walkable: (x: number, y: number) => boolean): WalkableGrid {
  return { width: 4, height: 1, isWalkable: walkable };
}

describe("withDoorState (13h)", () => {
  it("bloquea la celda de una puerta cerrada sin tocar el resto del plano", () => {
    const decorated = withDoorState(
      grid(() => true),
      (x, y) => x === 2 && y === 0,
    );
    expect(decorated.isWalkable(1, 0)).toBe(true);
    expect(decorated.isWalkable(2, 0)).toBe(false);
    expect(decorated.isWalkable(3, 0)).toBe(true);
  });

  it("consulta el estado VIVO en cada llamada, no una copia", () => {
    // Es la razón de ser de decorar en vez de copiar: la grilla base es un
    // snapshot inmutable del tilemap y una puerta cambia varias veces por
    // minuto. Si esto se rompiera, el pathfinding usaría un estado viejo y
    // nadie lo notaría hasta ver a un tripulante atravesar una puerta cerrada.
    let closed = true;
    const decorated = withDoorState(
      grid(() => true),
      () => closed,
    );
    expect(decorated.isWalkable(2, 0)).toBe(false);
    closed = false;
    expect(decorated.isWalkable(2, 0)).toBe(true);
  });

  it("una pared sigue siendo pared aunque no haya puerta", () => {
    const decorated = withDoorState(
      grid((x) => x !== 1),
      () => false,
    );
    expect(decorated.isWalkable(1, 0)).toBe(false);
  });
});
