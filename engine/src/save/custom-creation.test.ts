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

describe("creation layout (deuda #8)", () => {
  function buildTwoPieceDefinition(): PhysicalComponentDefinition {
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);
    const motor = factory.buildAtomic({
      id: "motor-pequeno" as ComponentId,
      name: "Motor pequeño",
      data: { footprint: { width: 1, height: 1 } },
    });
    const barra = factory.buildAtomic({
      id: "barra-metal" as ComponentId,
      name: "Barra de metal",
      data: { footprint: { width: 2, height: 1 } },
    });
    registry.register(motor.id, motor);
    registry.register(barra.id, barra);

    // Piezas colocadas lejos del origen (5,5) → el offset debe ser RELATIVO al
    // min corner, no absoluto.
    let workbench = createEmptyWorkbenchState();
    workbench = addPiece(workbench, {
      id: "p-motor" as WorkbenchPieceId,
      componentDefinitionId: "motor-pequeno" as ComponentId,
      placement: { position: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    });
    workbench = addPiece(workbench, {
      id: "p-barra" as WorkbenchPieceId,
      componentDefinitionId: "barra-metal" as ComponentId,
      placement: { position: { x: 6, y: 5 }, footprint: { width: 2, height: 1 }, rotation: 90 },
    });
    return nameAndRegisterCreation(factory, registry, workbench.pieces, {
      id: "arma-improvisada" as ComponentId,
      name: "Arma improvisada",
    });
  }

  it("stores per-piece offsets relative to the footprint origin, with rotation", () => {
    const definition = buildTwoPieceDefinition();
    expect(definition.level).toBe("composite");
    if (definition.level !== "composite") return;
    const layout = definition.data.layout;
    expect(layout).toEqual([
      { ref: "motor-pequeno", offset: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
      { ref: "barra-metal", offset: { x: 1, y: 0 }, footprint: { width: 2, height: 1 }, rotation: 90 },
    ]);
  });

  it("round-trips the layout through serialization", () => {
    const creation: CustomCreation = {
      metadata: {
        schemaVersion: 1,
        id: "creation-2" as CustomCreationId,
        engineVersion: "0.0.0",
        createdAt: "2026-07-29T00:00:00.000Z",
        updatedAt: "2026-07-29T00:00:00.000Z",
      },
      definition: buildTwoPieceDefinition(),
    };
    const restored = deserializeCustomCreation(serializeCustomCreation(creation));
    expect(restored).toEqual(creation);
  });

  it("rejects a malformed layout entry", () => {
    const creation = buildFixtureCreation();
    const broken = {
      ...creation,
      definition: {
        ...creation.definition,
        data: { footprint: { width: 1, height: 1 }, layout: [{ ref: "x" }] },
      },
    };
    expect(() => deserializeCustomCreation(JSON.stringify(broken))).toThrow(CustomCreationParseError);
  });
});
