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

const INSTANCE_A = "instance-a" as PlacedComponentInstanceId;
const INSTANCE_B = "instance-b" as PlacedComponentInstanceId;

function buildFixtureBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 2,
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
      },
      {
        instanceId: INSTANCE_B,
        componentDefinitionId: "fixture-component-b" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 2 }, rotation: 90 },
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
});
