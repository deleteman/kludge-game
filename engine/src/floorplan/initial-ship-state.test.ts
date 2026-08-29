import { describe, expect, it } from "vitest";
import { INITIAL_SHIP_STATE_BY_ARCHETYPE } from "./initial-ship-state.js";
import { SHIP_ARCHETYPES } from "./floorplan.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { findFabricators } from "../components/fabricator-query.js";
import { totalPowerBudget } from "../power/power-source.js";
import { occupiedCells } from "../workbench/workbench-state.types.js";
import type { ComponentId } from "../components/physical-component.types.js";

const { registry: componentRegistry } = buildComponentCatalog();

const FABRICATOR_IDS = new Set<string>(["banco-de-trabajo", "estacion-quimica"]);

describe("INITIAL_SHIP_STATE_BY_ARCHETYPE (Fase 13b, ronda 3: presupuesto real de energía)", () => {
  /**
   * Recalibrado en la Subfase 13g (deuda #39): 10 → 38 unidades. Las 5 células
   * fotovoltaicas (10) se conservan y se suman 4× `reactor-alto-amperaje` (24)
   * + 1× `bateria-gran-capacidad` (4) en `propulsion`. El número sale de cruzar
   * la oferta contra la demanda REAL del catálogo, que hasta 13g era 0 porque
   * nadie declaraba `powerDraw` — ver `power/initial-power-budget.test.ts`,
   * que es donde vive esa relación (acá solo se ancla la oferta).
   */
  it("Exploración arranca con 38 unidades de presupuesto", () => {
    const sources = INITIAL_SHIP_STATE_BY_ARCHETYPE.exploracion.filter(
      (instance) => !FABRICATOR_IDS.has(instance.componentDefinitionId),
    );
    expect(sources).toHaveLength(10);
    expect(totalPowerBudget(sources, componentRegistry)).toBe(38);
  });

  it("los aparatos de fabricación no aportan presupuesto de energía", () => {
    // La estación química declara `RES` (su reservorio de salida, 13e) pero de
    // resourceType "L": no debe colarse en el presupuesto eléctrico de 13b.
    expect(totalPowerBudget(INITIAL_SHIP_STATE_BY_ARCHETYPE.exploracion, componentRegistry)).toBe(38);
  });

  it("nada sembrado se solapa entre sí", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const seen = new Set<string>();
      for (const instance of INITIAL_SHIP_STATE_BY_ARCHETYPE[archetype]) {
        for (const cell of occupiedCells(instance.placement)) {
          const key = `${cell.x},${cell.y}`;
          expect(seen.has(key), `celda duplicada en ${key} (${archetype})`).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it("Exploración: 10 fuentes 1×2 + 2 aparatos 2×2 = 28 celdas distintas", () => {
    const seen = new Set<string>();
    for (const instance of INITIAL_SHIP_STATE_BY_ARCHETYPE.exploracion) {
      for (const cell of occupiedCells(instance.placement)) {
        seen.add(`${cell.x},${cell.y}`);
      }
    }
    expect(seen.size).toBe(28);
  });

  /**
   * Subfase 13e: los 4 arquetipos SÍ siembran los dos aparatos de fabricación
   * — sin ellos no hay forma de abrir la mesa de creación, que dejó de ser un
   * botón global. Lo que sigue sin sembrarse en guerra/investigación/médica es
   * el resto del kit (fuentes de energía), porque sus mapas no tienen tile art
   * verificado.
   */
  it("los 4 arquetipos siembran banco de trabajo + estación química", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const placed = INITIAL_SHIP_STATE_BY_ARCHETYPE[archetype];
      const blueprint = { placedComponents: placed } as Parameters<typeof findFabricators>[0];
      expect(findFabricators(blueprint, componentRegistry, "fisica")).toHaveLength(1);
      expect(findFabricators(blueprint, componentRegistry, "quimica")).toHaveLength(1);
    }
  });

  it("guerra/investigación/médica no siembran nada más que los dos aparatos", () => {
    for (const archetype of ["guerra", "investigacion", "medica"] as const) {
      const ids = INITIAL_SHIP_STATE_BY_ARCHETYPE[archetype].map(
        (instance) => instance.componentDefinitionId as ComponentId as string,
      );
      expect(ids.sort()).toEqual(["banco-de-trabajo", "estacion-quimica"]);
    }
  });
});
