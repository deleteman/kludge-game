import { describe, expect, it } from "vitest";
import { MissionPowerRuntime } from "./mission-power-runtime.js";
import { MutableShipState } from "../mission/mutable-ship-state.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const SECTION_A = "puente" as SectionId;
const SECTION_B = "bahia-carga" as SectionId;

function floorplan(): ShipFloorplan {
  return {
    id: "fixture-ship",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: SECTION_A, nameKey: "fixture.a", cells: [{ x: 0, y: 0 }] },
      { id: SECTION_B, nameKey: "fixture.b", cells: [{ x: 2, y: 0 }] },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function registry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const reg = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  reg.register("bateria" as ComponentId, {
    level: "atomic",
    id: "bateria" as ComponentId,
    name: "Batería (fixture)",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "RES", resourceType: "E", capacity: 40, dischargeRate: 0, powerUnits: 3 }],
    },
  });
  reg.register("torreta" as ComponentId, {
    level: "atomic",
    id: "torreta" as ComponentId,
    name: "Torreta (fixture)",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "ACT", power: 1, cadence: 1, directional: false, powerDraw: 2 }],
    },
  });
  reg.register("sensor" as ComponentId, {
    level: "atomic",
    id: "sensor" as ComponentId,
    name: "Sensor (fixture)",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "ACT", power: 1, cadence: 1, directional: false, powerDraw: 2 }],
    },
  });
  return reg;
}

const BATTERY = "i-bateria" as PlacedComponentInstanceId;
const TORRETA = "i-torreta" as PlacedComponentInstanceId;
const SENSOR = "i-sensor" as PlacedComponentInstanceId;

function baseBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  return {
    metadata: { schemaVersion: 6, id: "t", name: "t", engineVersion: "0.0.0", createdAt: "x", updatedAt: "x" },
    placedComponents: [
      {
        instanceId: BATTERY,
        componentDefinitionId: "bateria" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: TORRETA,
        componentDefinitionId: "torreta" as ComponentId,
        placement: { position: { x: 2, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: SENSOR,
        componentDefinitionId: "sensor" as ComponentId,
        placement: { position: { x: 2, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
    ...overrides,
  };
}

describe("MissionPowerRuntime (Fase 13b, presupuesto de energía en vivo)", () => {
  it("una sección sin asignación queda a oscuras en unpoweredSectionIds", () => {
    const shipState = new MutableShipState(
      baseBlueprint({
        powerState: {
          sectionAllocations: [{ sectionId: SECTION_A, units: 1 }],
          instancePriorities: [],
          permanentlyDisconnectedSectionIds: [],
        },
      }),
    );
    const runtime = new MissionPowerRuntime(shipState, floorplan(), registry());

    runtime.tick(tickOf(0));

    expect(shipState.get().unpoweredSectionIds).toEqual([SECTION_B]);
  });

  it("triaje interno: prioridad decide qué instancia se apaga cuando el pool de la sección no alcanza", () => {
    const shipState = new MutableShipState(
      baseBlueprint({
        powerState: {
          sectionAllocations: [
            { sectionId: SECTION_A, units: 1 },
            { sectionId: SECTION_B, units: 2 },
          ],
          instancePriorities: [
            { instanceId: TORRETA, priority: 0 },
            { instanceId: SENSOR, priority: 1 },
          ],
          permanentlyDisconnectedSectionIds: [],
        },
      }),
    );
    const runtime = new MissionPowerRuntime(shipState, floorplan(), registry());

    runtime.tick(tickOf(0));

    expect(shipState.get().unpoweredSectionIds).toEqual([]);
    expect(runtime.isInstancePowered(TORRETA)).toBe(true);
    expect(runtime.isInstancePowered(SENSOR)).toBe(false);
  });

  it("no reescribe el blueprint si el resultado no cambia entre ticks", () => {
    const shipState = new MutableShipState(baseBlueprint());
    const runtime = new MissionPowerRuntime(shipState, floorplan(), registry());

    runtime.tick(tickOf(0));
    const afterFirst = shipState.get();
    runtime.tick(tickOf(1));

    expect(shipState.get()).toBe(afterFirst);
  });

  it("reconciliación: la cicatriz permanente nunca se pierde ni el déficit táctico se vuelve permanente", () => {
    const shipState = new MutableShipState(
      baseBlueprint({
        powerState: {
          sectionAllocations: [],
          instancePriorities: [],
          permanentlyDisconnectedSectionIds: [SECTION_A],
        },
      }),
    );
    const runtime = new MissionPowerRuntime(shipState, floorplan(), registry());

    runtime.tick(tickOf(0));
    expect([...shipState.get().unpoweredSectionIds].sort()).toEqual([SECTION_A, SECTION_B].sort());

    // El jugador asigna presupuesto a B en la siguiente pasada de planificación.
    const withAllocation = {
      ...shipState.get(),
      powerState: {
        ...shipState.get().powerState,
        sectionAllocations: [{ sectionId: SECTION_B, units: 3 }],
      },
    };
    shipState.set(withAllocation);
    runtime.tick(tickOf(1));

    expect(shipState.get().unpoweredSectionIds).toEqual([SECTION_A]);
  });
});
