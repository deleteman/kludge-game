import { describe, expect, it } from "vitest";
import { INITIAL_SHIP_STATE_BY_ARCHETYPE } from "./initial-ship-state.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { totalPowerBudget } from "../power/power-source.js";
import { occupiedCells } from "../workbench/workbench-state.types.js";

const { registry: componentRegistry } = buildComponentCatalog();

describe("INITIAL_SHIP_STATE_BY_ARCHETYPE (Fase 13b, ronda 3: presupuesto real de energía)", () => {
  it("Exploración arranca con 10 unidades de presupuesto (5× celula-fotovoltaica)", () => {
    const placed = INITIAL_SHIP_STATE_BY_ARCHETYPE.exploracion;
    expect(placed).toHaveLength(5);
    expect(totalPowerBudget(placed, componentRegistry)).toBe(10);
  });

  it("las fuentes sembradas no se solapan entre sí", () => {
    const seen = new Set<string>();
    for (const instance of INITIAL_SHIP_STATE_BY_ARCHETYPE.exploracion) {
      for (const cell of occupiedCells(instance.placement)) {
        const key = `${cell.x},${cell.y}`;
        expect(seen.has(key), `celda duplicada en ${key}`).toBe(false);
        seen.add(key);
      }
    }
    // 5 piezas de footprint 1×2 → 10 celdas distintas.
    expect(seen.size).toBe(10);
  });

  it("los demás arquetipos siguen con kit vacío (sus mapas no están verificados)", () => {
    expect(INITIAL_SHIP_STATE_BY_ARCHETYPE.guerra).toEqual([]);
    expect(INITIAL_SHIP_STATE_BY_ARCHETYPE.investigacion).toEqual([]);
    expect(INITIAL_SHIP_STATE_BY_ARCHETYPE.medica).toEqual([]);
  });
});
