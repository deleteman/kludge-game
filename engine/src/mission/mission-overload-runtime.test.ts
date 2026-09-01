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
import type { SignalEdgeId } from "../signals/signal-edge.types.js";

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
 * Subfase 14a-2, con el sujeto mudado a la ARISTA en 14a-4. Estos casos usan el
 * CATÁLOGO REAL y el plano real, no el fixture de arriba: lo que se prueba es
 * que la sobrecarga emerja de piezas y capacidades de verdad, y un fixture
 * propio probaría mi aritmética en vez del contenido (patrón 13).
 */
describe("MissionOverloadRuntime (14a-4: el cable del jugador es el conductor)", () => {
  const REGISTRY = buildComponentCatalog().registry;
  const SECTION = "sala" as SectionId;
  const FUENTE = "fuente-1" as PlacedComponentInstanceId;
  const FUENTE_NODE = "fuente-1-em" as SignalNodeId;
  const HUB = "chip-1" as PlacedComponentInstanceId;
  const HUB_NODE = "chip-1-rec" as SignalNodeId;
  /** El cable troncal bajo prueba: de la fuente al chip del que cuelga todo. */
  const TRONCAL = "cable-troncal" as SignalEdgeId;

  function floorplan(): ShipFloorplan {
    return {
      id: "nave-test",
      archetype: "investigacion",
      nameKey: "ship.test.name",
      gridSize: { width: 12, height: 1 },
      sections: [
        {
          id: SECTION,
          nameKey: "section.sala",
          cells: Array.from({ length: 12 }, (_, x) => ({ x, y: 0 })),
        },
      ],
      conduits: [],
      anchors: [],
      componentSeeds: [],
      doors: [],
    };
  }

  /**
   * Fuente → cable troncal → chip → `ledCount` LEDs, cada uno por su propio
   * cable corto. Es la topología real de un montaje del jugador: un tronco que
   * carga con TODO lo que cuelga aguas abajo, y ramas que solo llevan lo suyo.
   * Así el único candidato a reventar es el troncal, y el test dice qué se
   * rompió sin ambigüedad.
   */
  function shipWith(ledCount: number, conductorId = "cable-cobre"): MutableShipState {
    const base = blueprintWith(FUENTE, "fotorreceptor" as ComponentId);
    const leds = Array.from({ length: ledCount }, (_, index) => index + 1);
    return new MutableShipState({
      ...base,
      placedComponents: [
        ...base.placedComponents,
        {
          instanceId: HUB,
          componentDefinitionId: "chip-circuito-generico" as ComponentId,
          placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
          wear: "nuevo",
        },
        ...leds.map((n) => ({
          instanceId: `led-${n}` as PlacedComponentInstanceId,
          componentDefinitionId: "indicador-led" as ComponentId,
          placement: { position: { x: n + 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
          condition: "ok" as const,
          wear: "nuevo" as const,
        })),
      ],
      signalGraph: {
        nodes: [
          { id: FUENTE_NODE, role: "emitter" as const, position: { x: 0, y: 0 }, ownerRef: FUENTE },
          { id: HUB_NODE, role: "receptor" as const, position: { x: 1, y: 0 }, ownerRef: HUB },
          ...leds.map((n) => ({
            id: `led-${n}-rec` as SignalNodeId,
            role: "receptor" as const,
            position: { x: n + 1, y: 0 },
            ownerRef: `led-${n}` as PlacedComponentInstanceId,
          })),
        ],
        edges: [
          {
            id: TRONCAL,
            from: FUENTE_NODE,
            to: HUB_NODE,
            conductorId: conductorId as ComponentId,
          },
          ...leds.map((n) => ({
            id: `rama-${n}` as SignalEdgeId,
            from: HUB_NODE,
            to: `led-${n}-rec` as SignalNodeId,
            conductorId: "cable-cobre" as ComponentId,
          })),
        ],
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

  it("una partida NUEVA, sin nada colgado, no revienta ningún cable", () => {
    // El caso por defecto es el que nadie prueba: el runtime recorre TODAS las
    // aristas en cada tick, así que este camino es el más transitado del juego.
    const shipState = shipWith(0);
    runtimeFor(shipState, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).toEqual([]);
  });

  it("colgar piezas de más del cable lo revienta sin ningún guion", () => {
    const shipState = shipWith(8);
    runtimeFor(shipState, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).toEqual([TRONCAL]);
  });

  it("las ramas que llevan poco sobreviven al corte del tronco", () => {
    // Consecuencia sistémica: revienta el que está sobrecargado, no la
    // instalación entera.
    const shipState = shipWith(8);
    runtimeFor(shipState, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).not.toContain("rama-1");
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
    expect(congelada.get().overloadedRefs).toEqual([TRONCAL]);
  });

  it("y también en calor extremo — la rama que cierra el ciclo combustión→cortocircuito", () => {
    const ardiendo = shipWith(4);
    runtimeFor(ardiendo, THERMAL_CONDUCTIVITY_PARAMETERS.hotTriggerTemperatureCelsius + 10).tick(
      tickOf(0),
    );
    expect(ardiendo.get().overloadedRefs).toEqual([TRONCAL]);
  });

  it("el CT del material decide: a la misma temperatura el cobre se corta y la fibra aguanta", () => {
    // Subfase 14a-4. Hasta acá NINGÚN conductor declaraba `CT` y todos caían al
    // default "A": la tabla de offsets existía en el código y no existía en el
    // juego. Este test es lo que impide que vuelva a ser decorativa.
    const cobre = shipWith(4, "cable-cobre");
    const fibra = shipWith(4, "cable-fibra-optica");
    // Franja elegida a partir de los propios parámetros, no un literal: por
    // encima del umbral del cobre (offset 0) y por debajo del de la fibra.
    const enLaFranja =
      THERMAL_CONDUCTIVITY_PARAMETERS.hotTriggerTemperatureCelsius +
      THERMAL_CONDUCTIVITY_PARAMETERS.hotTriggerOffsetByThermalConductivity.B / 2;

    runtimeFor(cobre, enLaFranja).tick(tickOf(0));
    runtimeFor(fibra, enLaFranja).tick(tickOf(0));

    expect(cobre.get().overloadedRefs).toEqual([TRONCAL]);
    expect(fibra.get().overloadedRefs).toEqual([]);
  });

  it("un cable desgastado revienta con una carga que el mismo cable nuevo tolera", () => {
    const nuevo = shipWith(5);
    runtimeFor(nuevo, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(nuevo.get().overloadedRefs).toEqual([]);

    const gastado = shipWith(5);
    const ship = gastado.get();
    gastado.set({
      ...ship,
      signalGraph: {
        ...ship.signalGraph,
        edges: ship.signalGraph.edges.map((edge) =>
          edge.id === TRONCAL ? { ...edge, conductorWear: "critico" as const } : edge,
        ),
      },
    });
    runtimeFor(gastado, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(gastado.get().overloadedRefs).toEqual([TRONCAL]);
  });

  it("sin lector de atmósfera se comporta como antes de 14a-2 (sin castigo silencioso)", () => {
    const shipState = shipWith(4);
    new MissionOverloadRuntime(shipState, REGISTRY, [], undefined, floorplan()).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).toEqual([]);
  });

  it("una pieza COND(E) COLOCADA ya no es sujeto: el conductor es el cable", () => {
    // Cierra el doble modelado que 14a-4 vino a eliminar. Antes esta misma nave
    // habría evaluado el cable de la celda Y la arista, con dos capacidades
    // distintas para el mismo fenómeno.
    const shipState = shipWith(8);
    const ship = shipState.get();
    shipState.set({
      ...ship,
      placedComponents: [
        ...ship.placedComponents,
        {
          instanceId: "cable-en-celda" as PlacedComponentInstanceId,
          componentDefinitionId: "cable-cobre" as ComponentId,
          placement: { position: { x: 11, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
          wear: "nuevo",
        },
      ],
    });
    runtimeFor(shipState, NOMINAL_TEMPERATURE_CELSIUS).tick(tickOf(0));
    expect(shipState.get().overloadedRefs).not.toContain("cable-en-celda");
  });
});
