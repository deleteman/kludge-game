import { describe, expect, it } from "vitest";
import type { DoorRuntime, DoorId, GridPosition, SectionId } from "engine";
import { withDoorState, type WalkableGrid } from "./walkable-grid.js";
import { doorOpenness, doorSlideAxis, easedDoorOpenness } from "./door-visuals.js";

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

function door(overrides: Partial<DoorRuntime> = {}): DoorRuntime {
  return {
    id: "door-1" as DoorId,
    instanceId: "puerta-1" as never,
    a: "pasillo" as SectionId,
    b: "bodega" as SectionId,
    cells: [{ x: 4, y: 2 }],
    mode: "auto",
    state: "closed",
    transitionElapsedSeconds: 0,
    hp: 300,
    maxHp: 300,
    ...overrides,
  };
}

describe("easedDoorOpenness (13h, ronda 2 de playtest)", () => {
  it("respeta los extremos: la curva no adelanta ni atrasa la apertura real", () => {
    // Es la única propiedad que la curva TIENE que garantizar. El paso se
    // libera cuando el motor dice `open`, no cuando la animación llega a 1: si
    // la curva no terminara exactamente ahí, el jugador vería la hoja abierta
    // con el tripulante todavía esperando, o al revés.
    expect(easedDoorOpenness(door({ state: "closed" }), 1.5)).toBe(0);
    expect(easedDoorOpenness(door({ state: "open" }), 1.5)).toBe(1);
  });

  it("acelera y desacelera: en el medio va por el medio, y no es lineal en los cuartos", () => {
    const at = (elapsed: number): number =>
      easedDoorOpenness(door({ state: "opening", transitionElapsedSeconds: elapsed }), 1.5);
    expect(at(0.75)).toBeCloseTo(0.5, 5);
    // Arranca lento (por debajo de la recta) y llega frenando (por encima).
    expect(at(0.375)).toBeLessThan(0.25);
    expect(at(1.125)).toBeGreaterThan(0.75);
  });

  it("es monótona durante la apertura", () => {
    const at = (elapsed: number): number =>
      easedDoorOpenness(door({ state: "opening", transitionElapsedSeconds: elapsed }), 1.5);
    for (let step = 1; step <= 15; step += 1) {
      expect(at(step * 0.1)).toBeGreaterThanOrEqual(at((step - 1) * 0.1));
    }
  });

  it("cerrando recorre el camino inverso", () => {
    const closing = door({ state: "closing", transitionElapsedSeconds: 0 });
    expect(doorOpenness(closing, 1.5)).toBe(1);
    expect(doorOpenness(door({ state: "closing", transitionElapsedSeconds: 1.5 }), 1.5)).toBe(0);
  });
});

describe("doorSlideAxis (13h, ronda 2 de playtest)", () => {
  const centroids: Record<string, GridPosition> = {
    pasillo: { x: 0, y: 5 },
    bodega: { x: 10, y: 5 },
    arriba: { x: 0, y: 0 },
  };
  const lookup = (id: SectionId): GridPosition | undefined => centroids[id as string];

  it("un vano de dos celdas declara su eje con su propia forma", () => {
    const ancho = door({ cells: [{ x: 4, y: 2 }, { x: 5, y: 2 }] });
    expect(doorSlideAxis(ancho, lookup)).toBe("x");
    const alto = door({ cells: [{ x: 4, y: 2 }, { x: 4, y: 3 }] });
    expect(doorSlideAxis(alto, lookup)).toBe("y");
  });

  it("un vano de una celda deduce el eje del sentido del paso: la hoja corre PERPENDICULAR", () => {
    // Pasillo y bodega están uno al lado del otro (se pasa en x), así que la
    // hoja tiene que correr en y. Si corriera en x se movería en la dirección
    // en la que camina el tripulante, que es justo lo que no hace una puerta.
    expect(doorSlideAxis(door({ a: "pasillo" as SectionId, b: "bodega" as SectionId }), lookup)).toBe("y");
    expect(doorSlideAxis(door({ a: "pasillo" as SectionId, b: "arriba" as SectionId }), lookup)).toBe("x");
  });

  it("sin secciones resolubles no revienta: cae a un eje por defecto", () => {
    expect(doorSlideAxis(door(), () => undefined)).toBe("x");
  });
});
