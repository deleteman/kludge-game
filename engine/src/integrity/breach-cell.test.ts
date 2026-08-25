import { describe, expect, it } from "vitest";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { hullBreachCell, isHullEdgeCell } from "./breach-cell.js";

const SECTION = "bodega" as SectionId;

/**
 * Sección de 5×5 dentro de un grid de 5×5: TODAS sus celdas del anillo exterior
 * tocan el borde del plano, y solo el interior 3×3 queda protegido.
 */
function floorplan(): ShipFloorplan {
  const cells = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      cells.push({ x, y });
    }
  }
  return {
    id: "fixture",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 5, height: 5 },
    sections: [{ id: SECTION, nameKey: "s", cells }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

describe("hullBreachCell (13f, ronda 1: la brecha se abre pegada al casco)", () => {
  const plan = floorplan();
  const section = plan.sections[0]!;

  it("el interior de la sección no toca el casco; el anillo exterior sí", () => {
    expect(isHullEdgeCell(plan, { x: 2, y: 2 })).toBe(false);
    expect(isHullEdgeCell(plan, { x: 0, y: 2 })).toBe(true);
    expect(isHullEdgeCell(plan, { x: 4, y: 4 })).toBe(true);
  });

  /**
   * REGRESIÓN de la ronda 1 de playtest: "la celda en la que hice click, no
   * queda marcada". La brecha se abría en el centroide geométrico de la
   * sección — en medio del piso, lejos del daño, y físicamente imposible.
   */
  it("un daño en el centro exacto NO abre la brecha en el centro", () => {
    const cell = hullBreachCell(plan, section, { x: 2, y: 2 });
    expect(cell).not.toEqual({ x: 2, y: 2 });
    expect(isHullEdgeCell(plan, cell)).toBe(true);
  });

  it("elige la celda de casco más cercana al origen del daño", () => {
    expect(hullBreachCell(plan, section, { x: 4, y: 3 })).toEqual({ x: 4, y: 3 });
    // Desde (3,3) hay empate a distancia 1 entre (4,3) y (3,4): desempata `y`.
    expect(hullBreachCell(plan, section, { x: 3, y: 3 })).toEqual({ x: 4, y: 3 });
  });

  it("dos daños en extremos opuestos abren brechas distintas", () => {
    const izquierda = hullBreachCell(plan, section, { x: 0, y: 2 });
    const derecha = hullBreachCell(plan, section, { x: 4, y: 2 });
    expect(izquierda).not.toEqual(derecha);
  });

  it("es determinista: el mismo daño abre siempre la misma celda", () => {
    const origin = { x: 2, y: 2 };
    expect(hullBreachCell(plan, section, origin)).toEqual(hullBreachCell(plan, section, origin));
  });

  it("sin celdas de borde cae a la celda de la sección más cercana al origen", () => {
    // Sección envuelta por otra: ninguna de sus celdas toca el exterior.
    const inner = { id: "nucleo" as SectionId, nameKey: "n", cells: [{ x: 2, y: 2 }] };
    const wrapped: ShipFloorplan = { ...plan, sections: [...plan.sections, inner] };
    expect(hullBreachCell(wrapped, inner, { x: 0, y: 0 })).toEqual({ x: 2, y: 2 });
  });
});
