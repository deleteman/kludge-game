import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { CellBlockedQuery } from "../geometry/line-of-sight.js";
import {
  CHAPTER_02_GATE_PANEL_INSTANCE_ID,
  CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_02_SENSOR_A_INSTANCE_ID,
  CHAPTER_02_SENSOR_B_INSTANCE_ID,
} from "../crisis/campaign/chapter-02-ecos-en-el-pasillo.js";
import {
  emitterCoverageCells,
  emitterRangeOf,
  emitterReaches,
  PRESENCE_TRIGGER_TYPES,
} from "./emitter-sensing.js";

const REGISTRY = buildComponentCatalog().registry;
const NOTHING_BLOCKED: CellBlockedQuery = { isBlocked: () => false };
const GRID = { width: 40, height: 22 };

describe("emitter-sensing (13g ronda 1 de playtest)", () => {
  it("resuelve el alcance de un sensor atómico y de uno compuesto", () => {
    // El compuesto es lo que la búsqueda contra `ATOMIC_COMPONENT_CATALOG` no
    // veía, y por eso quedaba siempre encendido.
    expect(emitterRangeOf("fotorreceptor" as ComponentId, REGISTRY, PRESENCE_TRIGGER_TYPES)).toBe(4);
    expect(
      emitterRangeOf("sensor-movimiento-laser" as ComponentId, REGISTRY, PRESENCE_TRIGGER_TYPES),
    ).toBe(6);
  });

  it("una pieza que no es sensor de presencia no declara alcance", () => {
    expect(
      emitterRangeOf("plancha-metalica" as ComponentId, REGISTRY, PRESENCE_TRIGGER_TYPES),
    ).toBeUndefined();
    // El sensor de presión es emisor, pero de OTRO disparador.
    expect(
      emitterRangeOf("sensor-presion" as ComponentId, REGISTRY, PRESENCE_TRIGGER_TYPES),
    ).toBeUndefined();
  });

  it("el área cubierta es el rombo de Manhattan, recortado por los bordes del plano", () => {
    const cells = emitterCoverageCells({ x: 0, y: 0 }, 2, GRID, NOTHING_BLOCKED);
    // Rombo completo de radio 2 = 13 celdas; en una esquina solo entra un cuarto.
    expect(cells).toHaveLength(6);
    expect(cells.every((cell) => cell.x >= 0 && cell.y >= 0)).toBe(true);
    expect(cells).toContainEqual({ x: 0, y: 0 });
    expect(cells).toContainEqual({ x: 2, y: 0 });
    expect(cells).not.toContainEqual({ x: 3, y: 0 });
  });

  it("una pared recorta el área: lo que el sensor no ve, no se pinta", () => {
    // Es la garantía de que el área dibujada y el disparo real usan la MISMA
    // regla — si divergieran, la UI mentiría sobre el motor.
    const blocked: CellBlockedQuery = { isBlocked: (cell) => cell.x === 6 };
    const cells = emitterCoverageCells({ x: 5, y: 5 }, 4, GRID, blocked);

    expect(cells).toContainEqual({ x: 4, y: 5 });
    expect(cells).not.toContainEqual({ x: 8, y: 5 });
    expect(emitterReaches({ x: 5, y: 5 }, { x: 8, y: 5 }, 4, blocked)).toBe(false);
    expect(emitterReaches({ x: 5, y: 5 }, { x: 8, y: 5 }, 4, NOTHING_BLOCKED)).toBe(true);
  });

  it("fuera de rango no alcanza aunque haya línea de visión despejada", () => {
    expect(emitterReaches({ x: 0, y: 0 }, { x: 5, y: 0 }, 4, NOTHING_BLOCKED)).toBe(false);
    expect(emitterReaches({ x: 0, y: 0 }, { x: 4, y: 0 }, 4, NOTHING_BLOCKED)).toBe(true);
  });

  /**
   * Patrón 34: cruzar los números del propio juego antes de dar por buena una
   * constante de balance. El rango del `fotorreceptor` no es libre — el puzzle
   * del Cap.2 depende de que los DOS sensores del pasillo se solapen, porque su
   * compuerta es un AND.
   */
  it("el rango autorado sostiene el puzzle del Cap.2: las dos coberturas se solapan", () => {
    const seeded = CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE.exploracion;
    const positionOf = (instanceId: string) =>
      seeded.find((entry) => entry.instanceId === instanceId)!.placement.position;
    const sensorA = positionOf(CHAPTER_02_SENSOR_A_INSTANCE_ID);
    const sensorB = positionOf(CHAPTER_02_SENSOR_B_INSTANCE_ID);
    const gate = positionOf(CHAPTER_02_GATE_PANEL_INSTANCE_ID);
    const range = emitterRangeOf("fotorreceptor" as ComponentId, REGISTRY, PRESENCE_TRIGGER_TYPES)!;

    const a = emitterCoverageCells(sensorA, range, GRID, NOTHING_BLOCKED);
    const b = emitterCoverageCells(sensorB, range, GRID, NOTHING_BLOCKED);
    const keyed = new Set(a.map((cell) => `${cell.x},${cell.y}`));
    const overlap = b.filter((cell) => keyed.has(`${cell.x},${cell.y}`));

    // Hay un tramo del pasillo donde un intruso dispara AMBOS sensores: sin
    // solape, la compuerta AND del capítulo sería irresoluble.
    expect(overlap.length).toBeGreaterThan(0);
    expect(overlap).toContainEqual(gate);

    // Y el AND sigue significando algo: cada sensor cubre celdas que el otro
    // NO, así que estar en cualquier punto del pasillo no basta para disparar
    // los dos. Con el rango 10 anterior el solape era total y la compuerta
    // estaba permanentemente en verdadero.
    const inB = new Set(b.map((cell) => `${cell.x},${cell.y}`));
    expect(a.some((cell) => !inB.has(`${cell.x},${cell.y}`))).toBe(true);
    expect(overlap.length).toBeLessThan(a.length);
  });
});
