// GDD 9, caso 2 — "Cortocircuito en bahía de carga": refrigerante conductor + nitrógeno líquido + panel eléctrico → propiedades de material, conductividad eléctrica variable con temperatura (GDD 5.2).
import { describe, expect, it } from "vitest";
import {
  MissionOverloadRuntime,
  MutableShipState,
  THERMAL_CONDUCTIVITY_PARAMETERS,
  buildComponentCatalog,
  type Blueprint,
  type ComponentId,
  type PlacedComponentInstanceId,
  type SectionId,
  type ShipFloorplan,
  type SignalEdgeId,
  type SignalNodeId,
  type TickContext,
} from "../index.js";

/**
 * Reescrito en la Subfase 14a-4.
 *
 * Hasta acá este caso se probaba con funciones puras y un `panel-electrico`
 * inventado de `maxCapacity: 20` — una pieza que **no existe en el catálogo** y
 * un número de una escala que 14a-2 dejó obsoleta (los conductores reales pasaron
 * a 3/6/9/12, en unidades de `powerDraw`). O sea que el caso de validación
 * afirmaba algo sobre un mundo que ya no era el del juego.
 *
 * Ahora corre sobre la pila real: el conductor de la bahía es un CABLE que el
 * jugador tendió (14a-4), su capacidad sale del catálogo de verdad, su carga se
 * deriva de las piezas colgadas, y quien decide es `MissionOverloadRuntime`. El
 * `panel-electrico` se descartó como pieza (decisión del operador, 2026-09-01):
 * los conductos `senal` del plano ya cumplen la función de "por dónde pasan los
 * cables".
 *
 * La cadena COMPLETA con el derrame real de nitrógeno —tanque criogénico →
 * atmósfera → temperatura → corte— vive en
 * `mission/thermal-coupling.integration.test.ts`; acá se aísla la afirmación del
 * caso: **la misma carga es segura templada y mortal en frío**.
 */

const BAHIA = "bahia-carga" as SectionId;
const FUENTE = "reactor" as PlacedComponentInstanceId;
const FUENTE_NODE = "reactor-em" as SignalNodeId;
const CARGA = "grua" as PlacedComponentInstanceId;
const CARGA_NODE = "grua-rec" as SignalNodeId;
const TENDIDO = "tendido-bahia" as SignalEdgeId;
const AUXILIARES = ["aux-1", "aux-2"] as PlacedComponentInstanceId[];

const REGISTRY = buildComponentCatalog().registry;
const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "nave-caso-02",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 4, height: 1 },
    sections: [
      {
        id: BAHIA,
        nameKey: "section.bahia-carga",
        cells: Array.from({ length: 4 }, (_, x) => ({ x, y: 0 })),
      },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

/** Bahía con un tendido de cobre alimentando el equipamiento de carga. */
function bahiaCableada(): MutableShipState {
  const blueprint: Blueprint = {
    metadata: {
      schemaVersion: 11,
      id: "caso-02",
      name: "Caso 02",
      engineVersion: "0.0.0",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: FUENTE,
        componentDefinitionId: "fotorreceptor" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
      {
        instanceId: CARGA,
        componentDefinitionId: "compuerta-blindada" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
      // Dos indicadores más colgados del mismo tendido: es lo que pone la carga
      // en la franja que el caso necesita — segura a 20 °C, mortal a -70. Con
      // una sola pieza la bahía nunca correría riesgo y el caso sería
      // inalcanzable.
      ...AUXILIARES.map((instanceId, index) => ({
        instanceId,
        componentDefinitionId: "indicador-led" as ComponentId,
        placement: {
          position: { x: index + 2, y: 0 },
          footprint: { width: 1, height: 1 },
          rotation: 0 as const,
        },
        condition: "ok" as const,
        wear: "nuevo" as const,
      })),
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: FUENTE_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: FUENTE },
        { id: CARGA_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: CARGA },
        ...AUXILIARES.map((instanceId, index) => ({
          id: `${instanceId}-rec` as SignalNodeId,
          role: "receptor" as const,
          position: { x: index + 2, y: 0 },
          ownerRef: instanceId,
        })),
      ],
      edges: [
        {
          id: TENDIDO,
          from: FUENTE_NODE,
          to: CARGA_NODE,
          conductorId: "cable-cobre" as ComponentId,
        },
        ...AUXILIARES.map((instanceId) => ({
          id: `rama-${instanceId}` as SignalEdgeId,
          from: CARGA_NODE,
          to: `${instanceId}-rec` as SignalNodeId,
          conductorId: "cable-cobre" as ComponentId,
        })),
      ],
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

function runtimeAt(shipState: MutableShipState, temperatureCelsius: number) {
  return new MissionOverloadRuntime(shipState, REGISTRY, [], undefined, floorplan(), () => ({
    temperatureCelsius,
  }) as never);
}

describe("case 2 — Cortocircuito en bahía de carga", () => {
  it("enfriar la bahía con nitrógeno reduce la capacidad segura del tendido y lo cortocircuita", () => {
    // Bahía a temperatura de trabajo: el tendido aguanta su carga habitual.
    const templada = bahiaCableada();
    runtimeAt(templada, 20).tick(tickOf(0));
    expect(templada.get().overloadedRefs).toEqual([]);

    // El nitrógeno líquido derramado enfría el tendido por debajo del umbral:
    // la conductividad efectiva sube, y la MISMA carga habitual ahora excede la
    // capacidad segura → cortocircuito derivado, sin que nadie recablee nada.
    const enfriada = bahiaCableada();
    runtimeAt(enfriada, THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius - 20).tick(tickOf(1));
    expect(enfriada.get().overloadedRefs).toEqual([TENDIDO]);
  });

  it("el material del cable decide: el mismo montaje en fibra óptica sobrevive al frío", () => {
    // Lo que hace del caso 2 una DECISIÓN y no un evento: el jugador puede
    // pagar la receta cara y comprar margen. Ojo con el mecanismo — acá lo que
    // salva a la fibra es su CAPACIDAD (12 contra 6: la mitad de 12 sigue
    // cubriendo la carga), no su `CT`, que solo desplaza el umbral CALIENTE.
    // Contra el frío, los tres cables cruzan el mismo -50 °C.
    const conFibra = bahiaCableada();
    const ship = conFibra.get();
    conFibra.set({
      ...ship,
      signalGraph: {
        ...ship.signalGraph,
        edges: ship.signalGraph.edges.map((edge) => ({
          ...edge,
          conductorId: "cable-fibra-optica" as ComponentId,
        })),
      },
    });

    runtimeAt(conFibra, THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius - 20).tick(tickOf(1));
    expect(conFibra.get().overloadedRefs).toEqual([]);
  });
});
