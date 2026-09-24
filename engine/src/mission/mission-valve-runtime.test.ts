import { describe, expect, it } from "vitest";
import { MissionValveRuntime, VALVE_FLOW_UNITS_PER_SECOND } from "./mission-valve-runtime.js";
import type { ValvePourEvent } from "./mission-valve-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { contentOf } from "../reservoir/reservoir-ledger.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const REGISTRY = buildComponentCatalog().registry;
const CHEMICAL_REGISTRY = buildChemicalCatalog().registry;

const VALVE_INSTANCE = "valvula-1" as PlacedComponentInstanceId;
const VALVE_NODE = "valvula-1:receptor:1" as SignalNodeId;
const SENSOR_NODE = "sensor-em" as SignalNodeId;
const SECTION = "laboratorio" as SectionId;
const OXYGEN_GENERATOR = "generador-oxigeno-precision" as ComponentId;
const OXIGENO = "oxigeno" as ChemicalSubstanceId;

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "fixture",
    archetype: "investigacion",
    nameKey: "fixture",
    gridSize: { width: 2, height: 1 },
    sections: [{ id: SECTION, nameKey: "s", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function blueprint(stored: number): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-14T00:00:00.000Z",
      updatedAt: "2026-09-14T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: VALVE_INSTANCE,
        componentDefinitionId: OXYGEN_GENERATOR,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [
      { componentInstanceId: VALVE_INSTANCE, substanceId: OXIGENO, amount: stored },
    ],
    signalGraph: {
      nodes: [{ id: VALVE_NODE, role: "receptor", position: { x: 0, y: 0 }, ownerRef: VALVE_INSTANCE }],
      edges: [{ id: "cable-1" as SignalEdgeId, from: SENSOR_NODE, to: VALVE_NODE }],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

function buildRuntime(
  options: { stored?: number; signal?: () => boolean; temperatureCelsius?: number } = {},
) {
  const { stored = 100, signal = () => true, temperatureCelsius = 21 } = options;
  const shipState = new MutableShipState(blueprint(stored));
  const injected: Array<{ sectionId: SectionId; substanceId: ChemicalSubstanceId; amount: number }> = [];
  const pours: ValvePourEvent[] = [];
  const runtime = new MissionValveRuntime(shipState, {
    registry: REGISTRY,
    floorplan: floorplan(),
    isInstancePowered: () => true,
    outputOf: signal,
    gasInjection: {
      inject: (sectionId, substanceId, amount) => injected.push({ sectionId, substanceId, amount }),
    },
    frozen: {
      substanceOf: (substanceId) => CHEMICAL_REGISTRY.get(substanceId),
      sectionTemperatureOf: () => temperatureCelsius,
    },
    onPour: (event) => pours.push(event),
  });
  return { runtime, shipState, injected, pours };
}

describe("MissionValveRuntime (Subfase 14b-2)", () => {
  it("vierte a caudal constante y descuenta del reservorio", () => {
    const { runtime, shipState, injected } = buildRuntime({ stored: 100 });

    runtime.tick(tickOf(1));

    expect(injected).toEqual([
      { sectionId: SECTION, substanceId: OXIGENO, amount: VALVE_FLOW_UNITS_PER_SECOND },
    ]);
    expect(contentOf(shipState.get().reservoirContents, VALVE_INSTANCE)?.amount).toBe(
      100 - VALVE_FLOW_UNITS_PER_SECOND,
    );
  });

  it("el caudal es por SEGUNDO, no por tick", () => {
    // Si se vertiera por tick, el caudal dependería del framerate — el mismo
    // error que el resto del motor evita pasando `dtSeconds` a todas las tasas.
    const { runtime, injected } = buildRuntime();

    runtime.tick(tickOf(0.5, 0.5));

    expect(injected[0]!.amount).toBeCloseTo(VALVE_FLOW_UNITS_PER_SECOND * 0.5);
  });

  it("con la señal en bajo no vierte nada", () => {
    const { runtime, shipState, injected } = buildRuntime({ signal: () => false });

    runtime.tick(tickOf(1));

    expect(injected).toEqual([]);
    expect(contentOf(shipState.get().reservoirContents, VALVE_INSTANCE)?.amount).toBe(100);
  });

  it("para al vaciarse y deja de emitir evento (patrón 26)", () => {
    const { runtime, shipState, injected, pours } = buildRuntime({ stored: 3 });

    runtime.tick(tickOf(1)); // saca 2, queda 1
    runtime.tick(tickOf(2)); // pide 2, saca el 1 que queda (parcial válido)
    const pouredSoFar = pours.length;
    runtime.tick(tickOf(3)); // vacío: ni vierte ni emite

    expect(injected.map((entry) => entry.amount)).toEqual([2, 1]);
    expect(pours).toHaveLength(pouredSoFar);
    expect(contentOf(shipState.get().reservoirContents, VALVE_INSTANCE)).toBeUndefined();
  });

  it("no vierte con el contenido CONGELADO, igual que la tarea manual", () => {
    // Coherencia entre hermanos (eje 4): si un tripulante no puede sacar nada
    // de un tanque helado, una válvula tampoco. El oxígeno funde a -218 °C.
    const { runtime, injected } = buildRuntime({ temperatureCelsius: -250 });

    runtime.tick(tickOf(1));

    expect(injected).toEqual([]);
  });

  it("isActuatorActive devuelve undefined para lo que NO es una válvula", () => {
    // Este lector se compone con el de puertas: devolver `false` a secas
    // apagaría el emisor de salida de cada puerta de la nave.
    const { runtime } = buildRuntime();

    expect(runtime.isActuatorActive(VALVE_INSTANCE)).toBe(true);
    expect(runtime.isActuatorActive("no-existe" as PlacedComponentInstanceId)).toBeUndefined();
  });
});
