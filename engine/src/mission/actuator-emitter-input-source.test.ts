import { describe, expect, it } from "vitest";
import { actuatorEmitterInputs } from "./actuator-emitter-input-source.js";
import { allEmittersActive } from "./mission-signal-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { seedActuatorOutputNodes } from "./seed-actuator-output-nodes.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { deriveSignalNodes, actuatorOutputNodeId } from "../workbench/derive-signal-nodes.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

/**
 * Ronda 1 de playtest de 14a-4 — "cada vez que un ACT se activa, debería emitir
 * señal". La decisión que estos tests anclan es **cuál** señal: el estado REAL
 * del actuador, no la orden que lo gobierna.
 *
 * Contra el catálogo REAL: el predicado depende de que `compuerta-blindada`
 * declare `ACT` de verdad, y con una definición sintética el test probaría mi
 * aritmética en vez del contenido.
 */

const REGISTRY = buildComponentCatalog().registry;
const PUERTA = "puerta-1" as PlacedComponentInstanceId;
const SENSOR = "sensor-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-1:emitter:0" as SignalNodeId;

function shipWithDoor(): MutableShipState {
  const placement = {
    position: { x: 1, y: 0 },
    footprint: { width: 1, height: 1 },
    rotation: 0 as const,
  };
  const definition = REGISTRY.get("compuerta-blindada" as ComponentId)!;
  const blueprint: Blueprint = {
    metadata: {
      schemaVersion: 11,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: PUERTA,
        componentDefinitionId: "compuerta-blindada" as ComponentId,
        placement,
        condition: "ok",
        wear: "nuevo",
      },
      {
        instanceId: SENSOR,
        componentDefinitionId: "fotorreceptor" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR },
        ...deriveSignalNodes(definition.data.functional, PUERTA, placement),
      ],
      edges: [],
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
  return new MutableShipState(blueprint);
}

/** El id de la salida de la puerta, derivado igual que en producción. */
function outputNodeOf(shipState: MutableShipState): SignalNodeId {
  const receptor = shipState
    .get()
    .signalGraph.nodes.find((node) => node.ownerRef === PUERTA && node.role === "receptor")!;
  return actuatorOutputNodeId(receptor.id);
}

describe("actuatorEmitterInputs (14a-4 ronda 1: el ACT emite su estado REAL)", () => {
  it("una puerta realmente abierta emite", () => {
    const shipState = shipWithDoor();
    const inputs = actuatorEmitterInputs(shipState, () => true, allEmittersActive(shipState))();
    expect(inputs.get(outputNodeOf(shipState))).toBe(true);
  });

  it("una puerta a la que le ORDENAN abrirse pero está trabada NO emite", () => {
    // Es la diferencia que eligió el operador y la razón de ser de este
    // archivo: si la salida repitiera la orden, encadenar "cuando esta puerta
    // se abrió → hacé aquello" dispararía con la puerta cerrada.
    const shipState = shipWithDoor();
    const inputs = actuatorEmitterInputs(shipState, () => false, allEmittersActive(shipState))();
    expect(inputs.get(outputNodeOf(shipState))).toBe(false);
  });

  it("un actuador sin lector de estado NO queda disparado para siempre", () => {
    // El fail-open de `allEmittersActive` pone `true` a todo emisor. Sin este
    // envoltorio, la salida de una válvula emitiría para siempre — que es
    // exactamente la deuda #40 y el bug que 14a-1 arregló en el sensor térmico.
    const shipState = shipWithDoor();
    const base = allEmittersActive(shipState);
    expect(base().get(outputNodeOf(shipState))).toBe(true);

    const inputs = actuatorEmitterInputs(shipState, () => undefined, base)();
    expect(inputs.get(outputNodeOf(shipState))).toBe(false);
  });

  it("no toca los emisores que no son salidas de actuador", () => {
    // Envoltorio PARCIAL: el sensor lo resuelve otro eslabón de la cebolla.
    const shipState = shipWithDoor();
    const inputs = actuatorEmitterInputs(shipState, () => true, allEmittersActive(shipState))();
    expect(inputs.get(SENSOR_NODE)).toBe(true);
  });
});

describe("seedActuatorOutputNodes (14a-4 ronda 1: partidas ya empezadas)", () => {
  /** Una partida anterior a 14a-4 ronda 1: la puerta tiene receptor pero no salida. */
  function shipWithoutOutput(): Blueprint {
    const ship = shipWithDoor().get();
    return {
      ...ship,
      signalGraph: {
        ...ship.signalGraph,
        nodes: ship.signalGraph.nodes.filter((node) => node.ownerRef !== PUERTA || node.role !== "emitter"),
      },
    };
  }

  it("le da su salida a una puerta de una partida vieja", () => {
    const viejo = shipWithoutOutput();
    expect(viejo.signalGraph.nodes.some((node) => node.ownerRef === PUERTA && node.role === "emitter")).toBe(
      false,
    );

    const migrado = seedActuatorOutputNodes(viejo, REGISTRY);
    const salida = migrado.signalGraph.nodes.find(
      (node) => node.ownerRef === PUERTA && node.role === "emitter",
    );
    expect(salida).toBeDefined();
    // Sobre la propia puerta, no en una celda arbitraria.
    expect(salida?.position).toEqual({ x: 1, y: 0 });
  });

  it("es idempotente: correrlo dos veces no duplica el nodo", () => {
    // Corre en CADA arranque de misión, así que sin esto una partida guardada y
    // recargada varias veces acumularía un nodo por vez.
    const una = seedActuatorOutputNodes(shipWithoutOutput(), REGISTRY);
    const dos = seedActuatorOutputNodes(una, REGISTRY);
    expect(dos.signalGraph.nodes).toHaveLength(una.signalGraph.nodes.length);
  });

  it("devuelve el MISMO blueprint por identidad si no hay nada que sembrar", () => {
    // `MissionSignalRuntime.syncGraph` compara el grafo por referencia: devolver
    // un objeto nuevo cada arranque le haría reconstruir el evaluador de gusto.
    const completo = shipWithDoor().get();
    expect(seedActuatorOutputNodes(completo, REGISTRY)).toBe(completo);
  });

  it("no le inventa una salida a una pieza sin ACT", () => {
    const ship = shipWithDoor().get();
    const soloSensor: Blueprint = {
      ...ship,
      placedComponents: ship.placedComponents.filter((entry) => entry.instanceId === SENSOR),
      signalGraph: { nodes: [ship.signalGraph.nodes[0]!], edges: [] },
    };
    expect(seedActuatorOutputNodes(soloSensor, REGISTRY).signalGraph.nodes).toHaveLength(1);
  });
});
