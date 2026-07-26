import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import {
  candidateCellsInSection,
  findFittingInstallPlacement,
  rotateExteriorFootprint,
} from "./installation-placement.js";

function section(cells: ReadonlyArray<GridPosition>): FloorplanSection {
  return { id: "soporte-vital" as SectionId, nameKey: "section.soporte-vital", cells };
}

function placedAt(
  instanceId: string,
  position: GridPosition,
  footprint: { width: number; height: number },
): PlacedComponentInstance {
  return {
    instanceId: instanceId as PlacedComponentInstanceId,
    componentDefinitionId: "panel-fijo" as ComponentId,
    placement: { position, footprint, rotation: 0 },
    condition: "ok",
  };
}

function rectangleCells(x0: number, y0: number, width: number, height: number): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let x = x0; x < x0 + width; x += 1) {
    for (let y = y0; y < y0 + height; y += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

describe("workbench: installation placement", () => {
  it("leaves 0/180 rotation unaffecting the exterior footprint", () => {
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 0)).toEqual({ width: 2, height: 1 });
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 180)).toEqual({ width: 2, height: 1 });
  });

  it("swaps width/height for 90/270 rotation", () => {
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 90)).toEqual({ width: 1, height: 2 });
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 270)).toEqual({ width: 1, height: 2 });
  });

  it("computes the absolute cells a footprint would occupy anchored at a position", () => {
    const cells = candidateCellsInSection({ width: 2, height: 1 }, { x: 3, y: 4 }, 0);
    expect(cells).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
  });

  it("applies rotation before computing candidate cells", () => {
    const cells = candidateCellsInSection({ width: 2, height: 1 }, { x: 0, y: 0 }, 90);
    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  describe("findFittingInstallPlacement", () => {
    it("anchors exactly at the clicked cell when the footprint already fits there (1×1 case, comportamiento actual)", () => {
      const result = findFittingInstallPlacement(section(rectangleCells(5, 5, 6, 4)), [], { width: 1, height: 1 }, {
        x: 6,
        y: 6,
      });
      expect(result).toEqual({ x: 6, y: 6 });
    });

    it("finds the nearest free cell when the anchor is blocked by a fixed neighbor and a seeded compound (caso real capítulo 1)", () => {
      // Sección 6×4 (x:5-10, y:5-8), panel fijo en (7,6), semilla 1×2 en (5,5)-(5,6),
      // semilla 2×2 en (8,5)-(9,6), semilla 2×1 en (8,7)-(9,7) — mismo layout que
      // `soporte-vital` en nave-exploracion.json.
      const existing = [
        placedAt("gate-panel", { x: 7, y: 6 }, { width: 1, height: 1 }),
        placedAt("radio-largo-alcance", { x: 5, y: 5 }, { width: 1, height: 2 }),
        placedAt("reservorio-agua", { x: 8, y: 5 }, { width: 2, height: 2 }),
        placedAt("herramientas-reparacion", { x: 8, y: 7 }, { width: 2, height: 1 }),
      ];
      const result = findFittingInstallPlacement(
        section(rectangleCells(5, 5, 6, 4)),
        existing,
        { width: 2, height: 2 },
        { x: 6, y: 6 },
      );
      // (6,6) mismo no entra (pisa el panel fijo en (7,6)); la celda libre más
      // cercana es (6,7) o (5,7) — ambas a distancia Chebyshev 1 del ancla,
      // el desempate por (y,x) se resuelve a (5,7).
      expect(result).toEqual({ x: 5, y: 7 });
    });

    it("returns undefined when no cell in the section fits the footprint", () => {
      const existing = [placedAt("blocker", { x: 0, y: 0 }, { width: 2, height: 2 })];
      const result = findFittingInstallPlacement(section(rectangleCells(0, 0, 2, 2)), existing, { width: 2, height: 2 }, {
        x: 0,
        y: 0,
      });
      expect(result).toBeUndefined();
    });
  });
});
