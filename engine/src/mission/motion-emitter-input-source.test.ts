import { describe, expect, it } from "vitest";
import { motionAwareEmitterInputs } from "./motion-emitter-input-source.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { CellBlockedQuery } from "../geometry/line-of-sight.js";

const SENSOR_INSTANCE = "sensor-instance" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;

function buildFixtureBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "fotorreceptor" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
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
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

const NOTHING_BLOCKED: CellBlockedQuery = { isBlocked: () => false };

describe("mission: motionAwareEmitterInputs (Fase 13a, deuda #3)", () => {
  it("se dispara si hay un actor dentro de rango con línea de visión despejada", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [{ x: 3, y: 0 }],
      NOTHING_BLOCKED,
      () => new Map(),
    );
    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });

  it("no se dispara si el actor está dentro de rango pero detrás de una pared", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const blocked: CellBlockedQuery = { isBlocked: (cell) => cell.x === 1 && cell.y === 0 };
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [{ x: 3, y: 0 }],
      blocked,
      () => new Map(),
    );
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("no se dispara si el actor está fuera de rango, aunque tenga línea de visión", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [{ x: 20, y: 0 }],
      NOTHING_BLOCKED,
      () => new Map(),
    );
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("no se dispara si no hay ningún actor", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(shipState, () => [], NOTHING_BLOCKED, () => new Map());
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("preserva las entradas de la fuente base para emisores que no son sensores ópticos", () => {
    const OTHER_NODE = "other-node" as SignalNodeId;
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [],
      NOTHING_BLOCKED,
      () => new Map([[OTHER_NODE, true]]),
    );
    expect(inputs().get(OTHER_NODE)).toBe(true);
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });
});
