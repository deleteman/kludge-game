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
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { THERMAL_CONDUCTIVITY_PARAMETERS } from "../failure/thermal-conductivity-rule.js";
import { NOMINAL_TEMPERATURE_CELSIUS } from "../atmosphere/thermal-parameters.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

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

/**
 * Subfase 14a-2. Estos casos usan el CATÁLOGO REAL y el plano real, no el
 * fixture de arriba: lo que se prueba es que la sobrecarga emerja de piezas y
 * capacidades de verdad, y un fixture propio probaría mi aritmética (patrón 50).
 */
describe("MissionOverloadRuntime (14a-2: carga emergente y acoplamiento térmico)", () => {
  const REGISTRY = buildComponentCatalog().registry;
  const SECTION = "sala" as SectionId;
  const CABLE = "cable-1" as PlacedComponentInstanceId;
  const CABLE_NODE = "cable-1-cond" as SignalNodeId;

  function floorplan(): ShipFloorplan {
    return {
      id: "nave-test",
      archetype: "investigacion",
      nameKey: "ship.test.name",
      gridSize: { width: 8, height: 1 },
      sections: [
        {
          id: SECTION,
          nameKey: "section.sala",
          cells: Array.from({ length: 8 }, (_, x) => ({ x, y: 0 })),
        },
      ],
      conduits: [],
      anchors: [],
      componentSeeds: [],
      doors: [],
    };
  }

  /** Un cable con `ledCount` indicadores LED colgando. */
  function shipWith(ledCount: number): MutableShipState {
    const base = blueprintWith(CABLE, "cable-cobre" as ComponentId);
    const leds = Array.from({ length: ledCount }, (_, index) => index + 1);
    return new MutableShipState({
      ...base,
      placedComponents: [
        ...base.placedComponents,
        ...leds.map((n) => ({
          instanceId: `led-${n}` as PlacedComponentInstanceId,
          componentDefinitionId: "indicador-led" as ComponentId,
          placement: { position: { x: n, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
          condition: "ok" as const,
          wear: "nuevo" as const,
        })),
      ],
      signalGraph: {
        nodes: [
          { id: CABLE_NODE, role: "conductor" as const, position: { x: 0, y: 0 }, ownerRef: CABLE },
          ...leds.map((n) => ({
            id: `led-${n}-rec` as SignalNodeId,
            role: "receptor" as const,
            position: { x: n, y: 0 },
            ownerRef: `led-${n}` as PlacedComponentInstanceId,
          })),
        ],
        edges: leds.map((n) => ({
          id: `e-${n}` as Blueprint["signalGraph"]["edges"][number]["id"],
          from: CABLE_NODE,
          to: `led-${n}-rec` as SignalNodeId,
        })),
      },
    });
  }

  function runtimeFor(shipState: MutableShipState, temperatureCelsius: number) {
    return new MissionOverloadRuntime(
      shipState,
      REGISTRY,
      [],
      undefined,
      floorplan(),
      () => ({ temperatureCelsius }) as never,
    );
  }

  it("una partida NUEVA, sin nada cableado, no revienta ningún conductor", () => {
    // Patrón 42: el caso por defecto es el que nadie prueba. Antes de 14a-2 el
    // runtime hacía early-return sin sujetos scripteados; ahora recorre TODO
    // conductor instalado, así que este caso pasó a ser alcanzable.
    const shipState = shipWith(0);
    runtimeFor(shipState, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).toEqual([]);
  });

  it("colgar piezas de más del cable lo revienta sin ningún guion", () => {
    const shipState = shipWith(8);
    runtimeFor(shipState, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).toEqual([CABLE]);
  });

  it("la MISMA carga es segura a temperatura nominal y mortal en frío extremo", () => {
    // El corazón del acoplamiento: nada cambia en el cableado, solo la sala.
    const ledsInSafeBand = 4;

    const templada = shipWith(ledsInSafeBand);
    runtimeFor(templada, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(templada.get().overloadedRefs).toEqual([]);

    const congelada = shipWith(ledsInSafeBand);
    runtimeFor(congelada, THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius - 10).tick(
      tickOf(0),
    );
    expect(congelada.get().overloadedRefs).toEqual([CABLE]);
  });

  it("y también en calor extremo — la rama que cierra el ciclo combustión→cortocircuito", () => {
    const ardiendo = shipWith(4);
    runtimeFor(ardiendo, THERMAL_CONDUCTIVITY_PARAMETERS.hotTriggerTemperatureCelsius + 10).tick(
      tickOf(0),
    );
    expect(ardiendo.get().overloadedRefs).toEqual([CABLE]);
  });

  it("sin lector de atmósfera se comporta como antes de 14a-2 (sin castigo silencioso)", () => {
    const shipState = shipWith(4);
    new MissionOverloadRuntime(shipState, REGISTRY, [], undefined, floorplan()).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).toEqual([]);
  });
});
