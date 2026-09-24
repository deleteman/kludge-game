import { describe, expect, it } from "vitest";
import {
  activeAutomaticValves,
  isAutomaticValveActive,
  isAutomaticValveDefinition,
} from "./automatic-valve.js";
import { isThermalRegulatorDefinition } from "./thermal-regulators.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";

const REGISTRY = buildComponentCatalog().registry;

const VALVE_INSTANCE = "valvula-1" as PlacedComponentInstanceId;
const VALVE_NODE = "valvula-1:receptor:1" as SignalNodeId;
const SENSOR_NODE = "sensor-em" as SignalNodeId;
const SECTION = "laboratorio" as SectionId;

/** Pieza real del catálogo: `RES(G)` + `ACT` regulador, contiene oxígeno. */
const OXYGEN_GENERATOR = "generador-oxigeno-precision" as ComponentId;

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

function blueprint(options: { wired?: boolean; condition?: "ok" | "destroyed" } = {}): Blueprint {
  const { wired = true, condition = "ok" } = options;
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
        condition,
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [{ id: VALVE_NODE, role: "receptor", position: { x: 0, y: 0 }, ownerRef: VALVE_INSTANCE }],
      edges: wired ? [{ id: "cable-1" as SignalEdgeId, from: SENSOR_NODE, to: VALVE_NODE }] : [],
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

const POWERED = () => true;
const UNPOWERED = () => false;

describe("automatic-valve: identidad por propiedades (Subfase 14b-2)", () => {
  it("reconoce exactamente las piezas del catálogo con ACT no direccional + RES(G/L)", () => {
    // Derivado del catálogo REAL y no de una lista escrita a mano: si alguien
    // agrega una pieza con esa forma, este test lo cuenta.
    const matching = REGISTRY.all()
      .filter((definition) => isAutomaticValveDefinition(definition.data))
      .map((definition) => definition.id)
      .sort();

    expect(matching).toEqual([
      "banco-sangre-fluidos",
      "farmacia-automatizada",
      "generador-oxigeno-precision",
      "invernadero-hidroponico",
    ]);
  });

  it("una batería RES(E) no es una válvula: almacena energía, no una sustancia", () => {
    const battery = REGISTRY.get("bateria-celda-simple" as ComponentId);
    expect(isAutomaticValveDefinition(battery!.data)).toBe(false);
  });

  it("un actuador DIRECCIONAL no es una válvula aunque tenga reservorio", () => {
    expect(
      isAutomaticValveDefinition({
        functional: [
          { tag: "ACT", power: 10, cadence: 1, directional: true },
          { tag: "RES", resourceType: "L", capacity: 10, dischargeRate: 1 },
        ],
      }),
    ).toBe(false);
  });

  it("el solape con el regulador térmico es deliberado y sigue vigente", () => {
    // Decisión del operador al planificar 14b-2: un tanque de fluidos
    // refrigerado es enfriador Y válvula. Si alguien "arregla" el solape con
    // una exclusión, este test lo cuenta.
    const bank = REGISTRY.get("banco-sangre-fluidos" as ComponentId);
    expect(isAutomaticValveDefinition(bank!.data)).toBe(true);
    expect(isThermalRegulatorDefinition(bank!.data)).toBe(true);
  });
});

describe("automatic-valve: cuándo vierte (Subfase 14b-2)", () => {
  it("SIN CABLE no vierte, al revés que el regulador térmico", () => {
    // La asimetría es el punto: vaciar un tanque es irreversible, así que el
    // default de una válvula recién instalada tiene que ser no hacer nada.
    const graph = blueprint({ wired: false }).signalGraph;
    expect(isAutomaticValveActive(VALVE_INSTANCE, graph, POWERED, () => true)).toBe(false);
  });

  it("cableada, obedece a la señal", () => {
    const graph = blueprint().signalGraph;
    expect(isAutomaticValveActive(VALVE_INSTANCE, graph, POWERED, () => true)).toBe(true);
    expect(isAutomaticValveActive(VALVE_INSTANCE, graph, POWERED, () => false)).toBe(false);
  });

  it("sin energía no vierte aunque la señal lo ordene", () => {
    const graph = blueprint().signalGraph;
    expect(isAutomaticValveActive(VALVE_INSTANCE, graph, UNPOWERED, () => true)).toBe(false);
  });

  it("una válvula destruida no cuenta como activa", () => {
    const active = activeAutomaticValves(blueprint({ condition: "destroyed" }), {
      registry: REGISTRY,
      floorplan: floorplan(),
      isInstancePowered: POWERED,
      outputOf: () => true,
    });
    expect(active).toEqual([]);
  });

  it("vierte sobre SU PROPIA sección, la que ocupa en el plano", () => {
    const active = activeAutomaticValves(blueprint(), {
      registry: REGISTRY,
      floorplan: floorplan(),
      isInstancePowered: POWERED,
      outputOf: () => true,
    });
    expect(active).toEqual([{ instanceId: VALVE_INSTANCE, sectionId: SECTION }]);
  });
});
