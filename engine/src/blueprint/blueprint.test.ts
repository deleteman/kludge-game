import { describe, expect, it } from "vitest";
import {
  BlueprintParseError,
  deserializeBlueprint,
  serializeBlueprint,
} from "./blueprint-serializer.js";
import type { Blueprint, PlacedComponentInstanceId } from "./blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";

const INSTANCE_A = "instance-a" as PlacedComponentInstanceId;
const INSTANCE_B = "instance-b" as PlacedComponentInstanceId;

function buildFixtureBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture-blueprint",
      name: "Fixture Blueprint",
      engineVersion: "0.0.0",
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: INSTANCE_A,
        componentDefinitionId: "fixture-component-a" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: INSTANCE_B,
        componentDefinitionId: "fixture-component-b" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 2 }, rotation: 90 },
        condition: "ok",
        structuralResistanceOverride: "M",
      },
    ],
    reservoirContents: [
      {
        componentInstanceId: INSTANCE_B,
        substanceId: "fixture-substance-x" as ChemicalSubstanceId,
        amount: 10,
      },
    ],
    signalGraph: {
      nodes: [
        {
          id: "node-a" as SignalNodeId,
          role: "emitter",
          position: { x: 0, y: 0 },
          ownerRef: INSTANCE_A,
        },
        {
          id: "node-b" as SignalNodeId,
          role: "receptor",
          position: { x: 1, y: 0 },
          ownerRef: INSTANCE_B,
        },
      ],
      edges: [
        {
          id: "edge-ab" as SignalEdgeId,
          from: "node-a" as SignalNodeId,
          to: "node-b" as SignalNodeId,
        },
      ],
    },
    sectionAtmospheres: [
      {
        sectionId: "bahia-carga" as SectionId,
        gases: [[GAS.OXYGEN, 0.21]],
        temperatureCelsius: 21,
        pressureKpa: 101,
      },
    ],
    unpoweredSectionIds: ["invernadero" as SectionId],
    overloadedRefs: ["panel-bahia-carga" as PlacedComponentInstanceId],
    powerState: {
      sectionAllocations: [{ sectionId: "bahia-carga" as SectionId, units: 3 }],
      instancePriorities: [{ instanceId: INSTANCE_A, priority: 0 }],
      permanentlyDisconnectedSectionIds: ["taller" as SectionId],
    },
  };
}

describe("blueprint: serialize/deserialize round-trip", () => {
  it("preserves the full structure through a serialize -> deserialize round-trip", () => {
    const original = buildFixtureBlueprint();
    const json = serializeBlueprint(original);
    const restored = deserializeBlueprint(json);

    expect(restored).toEqual(original);
  });

  it("rejects malformed JSON", () => {
    expect(() => deserializeBlueprint("{ not valid json")).toThrow(BlueprintParseError);
  });

  it("rejects a structurally invalid blueprint (missing metadata field)", () => {
    const broken = JSON.stringify({ ...buildFixtureBlueprint(), metadata: { schemaVersion: 1 } });
    expect(() => deserializeBlueprint(broken)).toThrow(BlueprintParseError);
  });

  it("rejects a blueprint with broken referential integrity (dangling reservoir reference)", () => {
    const withDanglingReservoir: Blueprint = {
      ...buildFixtureBlueprint(),
      reservoirContents: [
        {
          componentInstanceId: "does-not-exist" as PlacedComponentInstanceId,
          substanceId: "fixture-substance-x" as ChemicalSubstanceId,
          amount: 1,
        },
      ],
    };

    expect(() => deserializeBlueprint(serializeBlueprint(withDanglingReservoir))).toThrow(
      BlueprintParseError,
    );
  });

  it("defaults sectionAtmospheres/unpoweredSectionIds/structuralResistanceOverride when loading a pre-11b (schema v3) save", () => {
    const v3 = buildFixtureBlueprint() as unknown as Record<string, unknown>;
    delete v3.sectionAtmospheres;
    delete v3.unpoweredSectionIds;
    const placedComponents = v3.placedComponents as Array<Record<string, unknown>>;
    delete placedComponents[1]!.structuralResistanceOverride;
    (v3.metadata as Record<string, unknown>).schemaVersion = 3;

    const restored = deserializeBlueprint(JSON.stringify(v3));
    expect(restored.sectionAtmospheres).toEqual([]);
    expect(restored.unpoweredSectionIds).toEqual([]);
    expect(restored.placedComponents[1]!.structuralResistanceOverride).toBeUndefined();
  });

  it("defaults powerState when loading a pre-13b (schema v5) save", () => {
    const v5 = buildFixtureBlueprint() as unknown as Record<string, unknown>;
    delete v5.powerState;
    (v5.metadata as Record<string, unknown>).schemaVersion = 5;

    const restored = deserializeBlueprint(JSON.stringify(v5));
    expect(restored.powerState).toEqual({
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
    });
  });

  it("rejects a powerState with a malformed sectionAllocations entry", () => {
    const broken = buildFixtureBlueprint() as unknown as Record<string, unknown>;
    broken.powerState = { ...(broken.powerState as object), sectionAllocations: [{ sectionId: "x" }] };

    expect(() => deserializeBlueprint(JSON.stringify(broken))).toThrow(BlueprintParseError);
  });

  it("rejects an invalid structuralResistanceOverride value", () => {
    const broken = { ...buildFixtureBlueprint() } as unknown as Record<string, unknown>;
    const placedComponents = (broken.placedComponents as Array<Record<string, unknown>>).map(
      (entry, index) => (index === 1 ? { ...entry, structuralResistanceOverride: "Z" } : entry),
    );
    broken.placedComponents = placedComponents;

    expect(() => deserializeBlueprint(JSON.stringify(broken))).toThrow(BlueprintParseError);
  });
});
