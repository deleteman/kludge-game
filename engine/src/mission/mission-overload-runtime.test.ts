import { describe, expect, it } from "vitest";
import { MissionOverloadRuntime } from "./mission-overload-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ScriptedOverloadSubject } from "../crisis/crisis-definition.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import { EventEmitter } from "../simulation/event-emitter.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const CONDUCTOR_INSTANCE = "panel-bahia-carga" as PlacedComponentInstanceId;
const RESERVOIR_INSTANCE = "tanque-refrigerante" as PlacedComponentInstanceId;

function componentRegistry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  registry.register("panel-electrico" as ComponentId, {
    level: "atomic",
    id: "panel-electrico" as ComponentId,
    name: "Panel eléctrico (fixture)",
    data: { footprint: { width: 1, height: 1 }, functional: [{ tag: "COND", resourceType: "E", maxCapacity: 20 }] },
  });
  registry.register("tanque" as ComponentId, {
    level: "atomic",
    id: "tanque" as ComponentId,
    name: "Tanque (fixture)",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "RES", resourceType: "G", capacity: 10, dischargeRate: 1 }],
    },
  });
  return registry;
}

function blueprintWith(instanceId: PlacedComponentInstanceId, componentDefinitionId: ComponentId): Blueprint {
  return {
    metadata: {
      schemaVersion: 5,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-07-28",
      updatedAt: "2026-07-28",
    },
    placedComponents: [
      {
        instanceId,
        componentDefinitionId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

describe("MissionOverloadRuntime (Fase 12a, cicatriz de sobrecarga scripteada por contenido)", () => {
  it("marks a conductor's ref as overloaded (electrical -> cut) and emits the failure event exactly once", () => {
    const shipState = new MutableShipState(blueprintWith(CONDUCTOR_INSTANCE, "panel-electrico" as ComponentId));
    const scripted: ScriptedOverloadSubject[] = [{ instanceId: CONDUCTOR_INSTANCE, load: 25 }];
    const emitter = new EventEmitter<FailureDomainEvent>();
    const events: FailureDomainEvent[] = [];
    emitter.onAny((event) => events.push(event));

    const runtime = new MissionOverloadRuntime(shipState, componentRegistry(), scripted, emitter);

    runtime.tick(tickOf(0));
    runtime.tick(tickOf(1));
    runtime.tick(tickOf(2));

    expect(shipState.get().overloadedRefs).toEqual([CONDUCTOR_INSTANCE]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "overload", failureMode: "cut", ref: CONDUCTOR_INSTANCE });
  });

  it("does not scar a reservoir overload (gas -> explosion), only electrical cuts leave a persistent scar", () => {
    const shipState = new MutableShipState(blueprintWith(RESERVOIR_INSTANCE, "tanque" as ComponentId));
    const scripted: ScriptedOverloadSubject[] = [{ instanceId: RESERVOIR_INSTANCE, load: 15 }];

    const runtime = new MissionOverloadRuntime(shipState, componentRegistry(), scripted);
    runtime.tick(tickOf(0));

    expect(shipState.get().overloadedRefs).toEqual([]);
  });

  it("does nothing when the load never exceeds capacity", () => {
    const shipState = new MutableShipState(blueprintWith(CONDUCTOR_INSTANCE, "panel-electrico" as ComponentId));
    const scripted: ScriptedOverloadSubject[] = [{ instanceId: CONDUCTOR_INSTANCE, load: 10 }];

    const runtime = new MissionOverloadRuntime(shipState, componentRegistry(), scripted);
    runtime.tick(tickOf(0));

    expect(shipState.get().overloadedRefs).toEqual([]);
  });
});
