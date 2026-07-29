import { describe, expect, it } from "vitest";
import { PRESSURE_SENSOR_TRIGGER_KPA, pressureAwareEmitterInputs } from "./pressure-emitter-input-source.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";

const SENSOR_INSTANCE = "sensor-instance" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const SECTION = "seccion-fuga" as SectionId;

function buildFixtureBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "sensor-presion" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        {
          id: SENSOR_NODE,
          role: "emitter",
          position: { x: 0, y: 0 },
          ownerRef: SENSOR_INSTANCE,
        },
      ],
      edges: [],
    },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
  };
}

function buildFixtureFloorplan(): ShipFloorplan {
  return {
    id: "fixture-floorplan",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 1, height: 1 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function standardAtmosphere(pressureKpa: number): SectionAtmosphere {
  return { gases: new Map([[GAS.OXYGEN, 0.21]]), temperatureCelsius: 21, pressureKpa };
}

describe("mission: pressureAwareEmitterInputs (Subfase 11h, caso 19)", () => {
  it("el sensor de presión se dispara cuando la sección cae bajo la atmósfera estándar", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const floorplan = buildFixtureFloorplan();
    let pressureKpa = PRESSURE_SENSOR_TRIGGER_KPA;
    const inputs = pressureAwareEmitterInputs(
      shipState,
      floorplan,
      (sectionId) => (sectionId === SECTION ? standardAtmosphere(pressureKpa) : undefined),
      () => new Map(),
    );

    expect(inputs().get(SENSOR_NODE)).toBe(false);

    pressureKpa = 95;
    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });

  it("sin dato de atmósfera para la sección, el sensor no se da por disparado", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const floorplan = buildFixtureFloorplan();
    const inputs = pressureAwareEmitterInputs(
      shipState,
      floorplan,
      () => undefined,
      () => new Map(),
    );

    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("preserva las entradas de la fuente base para emisores que no son sensores de presión", () => {
    const OTHER_NODE = "other-node" as SignalNodeId;
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const floorplan = buildFixtureFloorplan();
    const inputs = pressureAwareEmitterInputs(
      shipState,
      floorplan,
      () => standardAtmosphere(80),
      () => new Map([[OTHER_NODE, true]]),
    );

    expect(inputs().get(OTHER_NODE)).toBe(true);
    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });
});
