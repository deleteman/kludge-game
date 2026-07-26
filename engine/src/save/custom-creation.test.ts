import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { createPhysicalComponentFactory } from "../components/physical-component-factory.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import {
  addPiece,
  createEmptyWorkbenchState,
  type WorkbenchPieceId,
} from "../workbench/workbench-state.types.js";
import { nameAndRegisterCreation } from "../workbench/creation-naming.js";
import {
  CustomCreationParseError,
  deserializeCustomCreation,
  serializeCustomCreation,
} from "./custom-creation-serializer.js";
import type { CustomCreation, CustomCreationId } from "./custom-creation.types.js";

function buildFixtureDefinition(): PhysicalComponentDefinition {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  const factory = createPhysicalComponentFactory(registry);
  const motor = factory.buildAtomic({
    id: "motor-pequeno" as ComponentId,
    name: "Motor pequeño",
    data: { footprint: { width: 1, height: 1 } },
  });
  registry.register(motor.id, motor);

  let workbench = createEmptyWorkbenchState();
  workbench = addPiece(workbench, {
    id: "piece-motor" as WorkbenchPieceId,
    componentDefinitionId: "motor-pequeno" as ComponentId,
    placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
  });

  return nameAndRegisterCreation(factory, registry, workbench.pieces, {
    id: "propulsor-improvisado" as ComponentId,
    name: "Propulsor improvisado",
  });
}

function buildFixtureCreation(): CustomCreation {
  return {
    metadata: {
      schemaVersion: 1,
      id: "creation-1" as CustomCreationId,
      engineVersion: "0.0.0",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    definition: buildFixtureDefinition(),
  };
}

describe("custom-creation-serializer round trip", () => {
  it("serializes and deserializes back to an equivalent creation", () => {
    const creation = buildFixtureCreation();
    const restored = deserializeCustomCreation(serializeCustomCreation(creation));
    expect(restored).toEqual(creation);
  });

  it("rejects invalid JSON", () => {
    expect(() => deserializeCustomCreation("{not json")).toThrow(CustomCreationParseError);
  });

  it("rejects a definition with level !== composite", () => {
    const creation = buildFixtureCreation();
    const broken = {
      ...creation,
      definition: { level: "atomic", id: "x", name: "x", data: {} },
    };
    expect(() => deserializeCustomCreation(JSON.stringify(broken))).toThrow(CustomCreationParseError);
  });
});
