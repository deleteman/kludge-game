import { describe, expect, it } from "vitest";
import { MissionOverloadRuntime } from "./mission-overload-runtime.js";
import { MissionSignalRuntime, allEmittersActive } from "./mission-signal-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { createShipTaskEffect, InsufficientStockError } from "./ship-task-effect.js";
import { createCrewTask } from "../tasks/task-factory.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewTaskId } from "../tasks/task.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

/**
 * Integración de la Subfase 14a-4: el ciclo de vida COMPLETO de un cable, con
 * la pila real y sin ningún doble que imponga el valor del borde entre dos
 * sistemas.
 *
 * Tender (y pagar) → cargar de más → quemarlo → **la señal muere aguas abajo**
 * → retirarlo (y perder la pieza) → retender con un conductor mejor → aguanta.
 *
 * Los unitarios de cada lado ya pasan por separado; lo que ningún test cubre es
 * el pegamento, que es exactamente donde 14a-4 mete su mecánica: que el corte
 * eléctrico y el corte de SEÑAL sean el mismo hecho, no dos sistemas que se
 * parecen.
 */

const SALA = "sala" as SectionId;
const ACTOR = "actor-1" as CrewActorId;
const SENSOR = "sensor-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-1-em" as SignalNodeId;
const HUB = "chip-1" as PlacedComponentInstanceId;
const HUB_NODE = "chip-1-rec" as SignalNodeId;
const TRONCAL = "troncal" as SignalEdgeId;

const REGISTRY = buildComponentCatalog().registry;
const tickOf = (elapsed: number, dt = 1) => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "nave-14a4",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 12, height: 1 },
    sections: [
      {
        id: SALA,
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

/** Sensor + chip + `ledCount` LEDs colgados del chip. SIN el cable troncal: lo tiende el jugador. */
function blueprintFor(ledCount: number): Blueprint {
  const leds = Array.from({ length: ledCount }, (_, index) => index + 1);
  const place = (instanceId: PlacedComponentInstanceId, definitionId: string, x: number) => ({
    instanceId,
    componentDefinitionId: definitionId as ComponentId,
    placement: { position: { x, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
    condition: "ok" as const,
    wear: "nuevo" as const,
  });

  return {
    metadata: {
      schemaVersion: 11,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    placedComponents: [
      place(SENSOR, "fotorreceptor", 0),
      place(HUB, "chip-circuito-generico", 1),
      ...leds.map((n) => place(`led-${n}` as PlacedComponentInstanceId, "indicador-led", n + 1)),
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR },
        { id: HUB_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: HUB },
        ...leds.map((n) => ({
          id: `led-${n}-rec` as SignalNodeId,
          role: "receptor" as const,
          position: { x: n + 1, y: 0 },
          ownerRef: `led-${n}` as PlacedComponentInstanceId,
        })),
      ],
      edges: leds.map((n) => ({
        id: `rama-${n}` as SignalEdgeId,
        from: HUB_NODE,
        to: `led-${n}-rec` as SignalNodeId,
        conductorId: "cable-cobre" as ComponentId,
      })),
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

function buildScene(ledCount: number, stock: Record<string, { nuevo: number }>) {
  const shipState = new MutableShipState(blueprintFor(ledCount));
  const atomicStock = new MutableAtomicStock(stock as never);
  const effect = createShipTaskEffect(shipState, REGISTRY, atomicStock, floorplan());
  const signals = new MissionSignalRuntime(shipState, allEmittersActive(shipState));
  const overload = new MissionOverloadRuntime(shipState, REGISTRY, [], undefined, floorplan());

  let nextTaskId = 0;
  const run = (type: "connect" | "disconnect", payload: Record<string, unknown>) =>
    effect(
      createCrewTask({
        id: `t${(nextTaskId += 1)}` as CrewTaskId,
        actorId: ACTOR,
        type,
        payload: { kind: type, ...payload } as never,
      }),
    );

  const tender = (edgeId: string, conductorId: string, consumeRecipe = false) =>
    run("connect", {
      edgeId: edgeId as SignalEdgeId,
      fromNodeId: SENSOR_NODE,
      toNodeId: HUB_NODE,
      conductorId: conductorId as ComponentId,
      ...(consumeRecipe ? { consumeRecipe } : {}),
    });

  const retirar = (edgeId: string) => run("disconnect", { edgeId: edgeId as SignalEdgeId });

  const tick = (elapsed: number) => {
    signals.tick(tickOf(elapsed));
    overload.tick(tickOf(elapsed));
  };

  /**
   * El jugador cuelga `count` LEDs más del chip, cada uno por su propia rama.
   * Es la acción que sobrecarga el troncal sin tocarlo: la carga de un cable no
   * es un número que alguien escribe, es lo que hay aguas abajo.
   */
  const colgar = (count: number) => {
    const ship = shipState.get();
    const base = ship.placedComponents.filter((entry) =>
      entry.componentDefinitionId === ("indicador-led" as ComponentId),
    ).length;
    const nuevos = Array.from({ length: count }, (_, index) => base + index + 1);
    shipState.set({
      ...ship,
      placedComponents: [
        ...ship.placedComponents,
        ...nuevos.map((n) => ({
          instanceId: `led-${n}` as PlacedComponentInstanceId,
          componentDefinitionId: "indicador-led" as ComponentId,
          placement: { position: { x: n + 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
          condition: "ok" as const,
          wear: "nuevo" as const,
        })),
      ],
      signalGraph: {
        nodes: [
          ...ship.signalGraph.nodes,
          ...nuevos.map((n) => ({
            id: `led-${n}-rec` as SignalNodeId,
            role: "receptor" as const,
            position: { x: n + 1, y: 0 },
            ownerRef: `led-${n}` as PlacedComponentInstanceId,
          })),
        ],
        edges: [
          ...ship.signalGraph.edges,
          ...nuevos.map((n) => ({
            id: `rama-${n}` as SignalEdgeId,
            from: HUB_NODE,
            to: `led-${n}-rec` as SignalNodeId,
            conductorId: "cable-cobre" as ComponentId,
          })),
        ],
      },
    });
  };

  return { shipState, atomicStock, signals, tender, retirar, tick, colgar };
}

describe("integración 14a-4: el cableado del jugador es el conductor", () => {
  it("tender → sobrecargar → quemar → la señal MUERE aguas abajo → retirar → retender en fibra", () => {
    const stock = {
      "cable-cobre": { nuevo: 1 },
      "lente-optica": { nuevo: 2 },
    };
    // Arranca con 3 LEDs: 3 + el chip = 4 unidades, dentro de los 6 del cobre.
    const { shipState, atomicStock, signals, tender, retirar, tick, colgar } = buildScene(3, stock);

    // 1) Tender cuesta la pieza. El stock baja ANTES de que nada se queme.
    tender(TRONCAL, "cable-cobre");
    expect(atomicStock.get()["cable-cobre" as ComponentId]?.nuevo ?? 0).toBe(0);

    // 2) Con el cable sano, la señal del sensor llega al chip. Hacen falta dos
    //    ticks: el evaluador propaga un salto por tick (cada nodo lee la salida
    //    del tick anterior), que es el retardo estructural del grafo.
    tick(0);
    tick(1);
    expect(signals.outputOf(HUB_NODE)).toBe(true);
    expect(shipState.get().overloadedRefs).toEqual([]);

    // 3) El jugador cuelga cinco piezas más del mismo chip: 8 + 1 = 9 contra los
    //    6 del cobre. Nadie tocó el cable; lo revienta lo que le colgaron.
    colgar(5);
    tick(2);
    expect(shipState.get().overloadedRefs).toEqual([TRONCAL]);

    // 4) Y el corte es REAL, no una cicatriz cosmética: la señal deja de pasar.
    //    Es lo que `failureMode: "cut"` significa, y hasta 14a-4 no ocurría.
    tick(3);
    tick(4);
    expect(signals.outputOf(HUB_NODE)).toBe(false);

    // 5) Retirarlo no devuelve nada: la pieza se perdió en el corto.
    retirar(TRONCAL);
    expect(atomicStock.get()["cable-cobre" as ComponentId]?.nuevo ?? 0).toBe(0);
    expect(shipState.get().signalGraph.edges.map((edge) => edge.id)).not.toContain(TRONCAL);
    // La cicatriz se va con el cable: el hueco queda listo para uno nuevo.
    expect(shipState.get().overloadedRefs).toEqual([]);

    // 6) Sin cobre en stock, retender con cobre es imposible: la consecuencia
    //    tiene dientes, no es solo un mensaje.
    expect(() => tender("troncal-2", "cable-cobre")).toThrow(InsufficientStockError);

    // 7) Se paga la receta de la fibra (que gasta el ÚLTIMO cable de cobre… que
    //    ya no hay) — así que primero hay que reponerlo. Es el ciclo económico
    //    que 14a-4 vino a crear.
    atomicStock.set({ ...atomicStock.get(), ["cable-cobre" as ComponentId]: { nuevo: 1 } });
    tender("troncal-2", "cable-fibra-optica", true);

    // 8) La fibra aguanta la MISMA carga que reventó al cobre: 12 contra 9.
    for (let i = 5; i < 10; i += 1) {
      tick(i);
    }
    expect(shipState.get().overloadedRefs).toEqual([]);
    expect(signals.outputOf(HUB_NODE)).toBe(true);
  });

  it("con la carga por debajo de la capacidad, el cobre no se quema nunca", () => {
    // El control del experimento: sin esto, un cable que revienta siempre daría
    // el mismo rojo y el test no probaría la capacidad.
    const { shipState, tender, tick } = buildScene(3, { "cable-cobre": { nuevo: 1 } });
    tender(TRONCAL, "cable-cobre");
    for (let i = 0; i < 20; i += 1) {
      tick(i);
    }
    expect(shipState.get().overloadedRefs).toEqual([]);
  });
});
