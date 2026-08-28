import { describe, expect, it } from "vitest";

import type { SectionId } from "../atmosphere/section.types.js";
import { sectionContainingCell } from "./floorplan.types.js";
import type { FloorplanSection } from "./floorplan.types.js";

function section(id: string, cells: [number, number][]): FloorplanSection {
  return {
    id: id as SectionId,
    nameKey: `section.${id}`,
    cells: cells.map(([x, y]) => ({ x, y })),
  };
}

const floorplan = {
  id: "nave-test",
  archetype: "investigacion" as const,
  nameKey: "ship.test.name",
  gridSize: { width: 8, height: 8 },
  sections: [
    // Forma en L (Fase 5: varios rectángulos con el mismo id se unen) — la
    // búsqueda no puede asumir un bounding box rectangular.
    section("alfa", [
      [0, 0],
      [1, 0],
      [0, 1],
    ]),
    section("beta", [[2, 0]]),
  ],
  conduits: [],
  anchors: [],
  componentSeeds: [],
    doors: [],
};

describe("sectionContainingCell", () => {
  it("devuelve la sección cuando la celda le pertenece", () => {
    expect(sectionContainingCell(floorplan, { x: 1, y: 0 })?.id).toBe("alfa");
    expect(sectionContainingCell(floorplan, { x: 2, y: 0 })?.id).toBe("beta");
  });

  it("resuelve una celda en el brazo de una sección en forma de L", () => {
    expect(sectionContainingCell(floorplan, { x: 0, y: 1 })?.id).toBe("alfa");
  });

  it("devuelve undefined para una celda fuera de todas las secciones", () => {
    expect(sectionContainingCell(floorplan, { x: 5, y: 5 })).toBeUndefined();
  });
});
