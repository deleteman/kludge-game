import { describe, expect, it } from "vitest";
import { CANONICAL_SHIP_FLOORPLANS } from "../floorplan/canonical-ships.js";
import { validateBlueprintIntegrity } from "../blueprint/blueprint-integrity.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { installCreationInFloorplan } from "./installation.js";

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

function emptyBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    },
    placedComponents: [],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

describe("workbench: installation", () => {
  it("installs a creation that fits in the target section, adding it to the blueprint", () => {
    const result = installCreationInFloorplan(
      emptyBlueprint(),
      rectSection,
      "mi-creacion" as ComponentId,
      { width: 2, height: 1 },
      { x: 0, y: 0 },
      0,
      "instance-1" as PlacedComponentInstanceId,
    );

    expect(result.outcome).toBe("installed");
    if (result.outcome === "installed") {
      expect(result.blueprint.placedComponents).toHaveLength(1);
      expect(result.blueprint.placedComponents.at(0)?.instanceId).toBe("instance-1");
      expect(validateBlueprintIntegrity(result.blueprint)).toEqual([]);
    }
  });

  it("rejects a creation whose footprint does not fit in the section", () => {
    const result = installCreationInFloorplan(
      emptyBlueprint(),
      rectSection,
      "mi-creacion" as ComponentId,
      { width: 10, height: 1 },
      { x: 0, y: 0 },
      0,
      "instance-1" as PlacedComponentInstanceId,
    );

    expect(result.outcome).toBe("rejected");
    if (result.outcome === "rejected") {
      expect(result.issues.some((issue) => issue.kind === "footprint-outside-section-shape")).toBe(
        true,
      );
    }
  });

  it("does not mutate the original blueprint", () => {
    const original = emptyBlueprint();
    installCreationInFloorplan(
      original,
      rectSection,
      "mi-creacion" as ComponentId,
      { width: 1, height: 1 },
      { x: 0, y: 0 },
      0,
      "instance-1" as PlacedComponentInstanceId,
    );
    expect(original.placedComponents).toEqual([]);
  });

  it("installs into a real canonical ship section (integration with Fase 5 floorplan data)", () => {
    const investigacion = CANONICAL_SHIP_FLOORPLANS.investigacion;
    const targetSection = investigacion.sections.at(0);
    if (!targetSection) throw new Error("Fixture floorplan has no sections");
    const anchorCell = targetSection.cells.at(0);
    if (!anchorCell) throw new Error("Fixture section has no cells");

    const result = installCreationInFloorplan(
      emptyBlueprint(),
      targetSection,
      "mi-creacion" as ComponentId,
      { width: 1, height: 1 },
      anchorCell,
      0,
      "instance-1" as PlacedComponentInstanceId,
    );

    expect(result.outcome).toBe("installed");
    if (result.outcome === "installed") {
      expect(validateBlueprintIntegrity(result.blueprint)).toEqual([]);
    }
  });
});
