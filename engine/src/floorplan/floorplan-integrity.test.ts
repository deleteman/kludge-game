import { describe, expect, it } from "vitest";

import type { SectionId } from "../atmosphere/section.types.js";
import { validateFloorplanIntegrity } from "./floorplan-integrity.js";
import type {
  AnchorId,
  AnchorPoint,
  ComponentSeedId,
  ComponentSeedPoint,
  ConduitConnection,
  FloorplanSection,
  ShipFloorplan,
} from "./floorplan.types.js";

function section(id: string, cells: [number, number][]): FloorplanSection {
  return {
    id: id as SectionId,
    nameKey: `section.${id}`,
    cells: cells.map(([x, y]) => ({ x, y })),
  };
}

function ventConduit(a: string, b: string, aperture = 1): ConduitConnection {
  return {
    id: `ventilacion:${a}:${b}` as ConduitConnection["id"],
    a: a as SectionId,
    b: b as SectionId,
    kind: "ventilacion",
    position: { x: 0, y: 0 },
    initialAperture: aperture,
  };
}

function anchor(id: string, sectionId: string, x: number, y: number): AnchorPoint {
  return { id: id as AnchorId, sectionId: sectionId as SectionId, position: { x, y } };
}

function componentSeed(id: string, sectionId: string, x: number, y: number, componentId: string): ComponentSeedPoint {
  return { id: id as ComponentSeedId, sectionId: sectionId as SectionId, position: { x, y }, componentId };
}

function floorplan(overrides: Partial<ShipFloorplan> = {}): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 8, height: 8 },
    sections: [
      section("alfa", [
        [0, 0],
        [1, 0],
      ]),
      section("beta", [
        [2, 0],
        [3, 0],
      ]),
    ],
    conduits: [ventConduit("alfa", "beta")],
    anchors: [anchor("alfa-a1", "alfa", 0, 0)],
    componentSeeds: [],
    doors: [],
    ...overrides,
  };
}

describe("validateFloorplanIntegrity", () => {
  it("un plano válido no produce issues", () => {
    expect(validateFloorplanIntegrity(floorplan())).toEqual([]);
  });

  it("detecta celdas solapadas entre secciones", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({
        sections: [
          section("alfa", [
            [0, 0],
            [1, 0],
          ]),
          section("beta", [
            [1, 0],
            [2, 0],
          ]),
        ],
      }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("overlapping-section-cells");
  });

  it("detecta un conducto hacia una sección inexistente", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({ conduits: [ventConduit("alfa", "gamma")] }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("conduit-unknown-section");
  });

  it("detecta un conducto de una sección consigo misma", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({ conduits: [ventConduit("alfa", "alfa")] }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("conduit-self-reference");
  });

  it("detecta un conducto entre secciones que no comparten arista", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({
        sections: [
          section("alfa", [[0, 0]]),
          // Solo contacto diagonal con alfa: no es adyacencia por arista.
          section("beta", [[1, 1]]),
        ],
        conduits: [ventConduit("alfa", "beta")],
        anchors: [anchor("alfa-a1", "alfa", 0, 0)],
      }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("conduit-sections-not-adjacent");
  });

  it("detecta una apertura de válvula fuera de [0, 1]", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({ conduits: [ventConduit("alfa", "beta", 1.5)] }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("invalid-conduit-aperture");
  });

  it("detecta un anclaje huérfano (fuera de su sección declarada)", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({ anchors: [anchor("alfa-a1", "alfa", 5, 5)] }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("anchor-outside-section");
  });

  it("detecta ids de anclaje duplicados", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({
        anchors: [anchor("a1", "alfa", 0, 0), anchor("a1", "beta", 2, 0)],
      }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("duplicate-anchor-id");
  });

  it("detecta una semilla de componente fuera de su sección declarada", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({ componentSeeds: [componentSeed("semilla-1", "alfa", 5, 5, "x")] }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("component-seed-outside-section");
  });

  it("detecta ids de semilla de componente duplicados", () => {
    const issues = validateFloorplanIntegrity(
      floorplan({
        componentSeeds: [
          componentSeed("s1", "alfa", 0, 0, "x"),
          componentSeed("s1", "beta", 2, 0, "y"),
        ],
      }),
    );
    expect(issues.map((issue) => issue.kind)).toContain("duplicate-component-seed-id");
  });
});
