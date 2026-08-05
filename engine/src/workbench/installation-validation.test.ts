import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { validateInstallation } from "./installation-validation.js";

const rectSection: FloorplanSection = {
  id: "puente" as SectionId,
  nameKey: "section.puente",
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
};

/** Forma en L: falta la celda (2,1) respecto al rectángulo 3x2. */
const lShapedSection: FloorplanSection = {
  id: "ingenieria" as SectionId,
  nameKey: "section.ingenieria",
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
};

function placed(instanceId: string, x: number, y: number, width: number, height: number): PlacedComponentInstance {
  return {
    instanceId: instanceId as PlacedComponentInstanceId,
    componentDefinitionId: "comp" as ComponentId,
    placement: { position: { x, y }, footprint: { width, height }, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  };
}

describe("workbench: installation validation", () => {
  it("accepts a footprint that fits entirely within the section and does not overlap", () => {
    const issues = validateInstallation(rectSection, [], {
      position: { x: 0, y: 0 },
      footprint: { width: 2, height: 1 },
      rotation: 0,
    });
    expect(issues).toEqual([]);
  });

  it("rejects a footprint that exceeds the section's rectangular bounds", () => {
    const issues = validateInstallation(rectSection, [], {
      position: { x: 0, y: 0 },
      footprint: { width: 4, height: 1 },
      rotation: 0,
    });
    expect(issues).toEqual([
      expect.objectContaining({ kind: "footprint-outside-section-shape" }),
    ]);
  });

  it("rejects a footprint that falls in the missing cell of an L-shaped section (not just outside its bounding box)", () => {
    const issues = validateInstallation(lShapedSection, [], {
      position: { x: 1, y: 0 },
      footprint: { width: 2, height: 2 },
      rotation: 0,
    });
    expect(issues).toEqual([
      expect.objectContaining({ kind: "footprint-outside-section-shape" }),
    ]);
  });

  it("rejects a footprint that overlaps an already-installed component", () => {
    const existing = [placed("existing-1", 0, 0, 2, 1)];
    const issues = validateInstallation(rectSection, existing, {
      position: { x: 1, y: 0 },
      footprint: { width: 2, height: 1 },
      rotation: 0,
    });
    expect(issues).toEqual([
      expect.objectContaining({ kind: "overlaps-existing-component" }),
    ]);
  });

  it("accepts a rotation that makes a footprint fit where it did not fit unrotated", () => {
    // Sección angosta y alta: 1 celda de ancho, 3 de alto.
    const narrowTallSection: FloorplanSection = {
      id: "pasillo" as SectionId,
      nameKey: "section.pasillo",
      cells: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    };
    const unrotated = validateInstallation(narrowTallSection, [], {
      position: { x: 0, y: 0 },
      footprint: { width: 3, height: 1 }, // 3 celdas de ancho, no cabe sin rotar
      rotation: 0,
    });
    expect(unrotated.some((issue) => issue.kind === "footprint-outside-section-shape")).toBe(true);

    const rotated = validateInstallation(narrowTallSection, [], {
      position: { x: 0, y: 0 },
      footprint: { width: 1, height: 3 }, // mismo footprint exterior ya rotado por el llamador
      rotation: 0,
    });
    expect(rotated).toEqual([]);
  });
});
