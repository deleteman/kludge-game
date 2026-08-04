import { describe, expect, it } from "vitest";
import { MissionSignalRuntime, allEmittersActive } from "./mission-signal-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNode } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;
const owner = (value: string): PlacedComponentInstanceId => value as PlacedComponentInstanceId;

function node(
  raw: string,
  role: SignalNode["role"],
  behavior?: SignalNode["behavior"],
): SignalNode<PlacedComponentInstanceId> {
  return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: owner(raw), behavior };
}

function blueprintWith(graph: SignalGraph<PlacedComponentInstanceId>): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "test",
      name: "test",
      engineVersion: "0.0.0",
      createdAt: "2026-07-17",
      updatedAt: "2026-07-17",
    },
    placedComponents: [],
    reservoirContents: [],
    signalGraph: graph,
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

describe("mission: MissionSignalRuntime", () => {
  it("mantiene el estado de señales VIVO entre ticks (un hop de propagación por tick)", () => {
    const ship = new MutableShipState(
      blueprintWith({
        nodes: [node("sensor", "emitter"), node("lampara", "receptor")],
        edges: [{ id: "e1" as SignalEdgeId, from: id("sensor"), to: id("lampara") }],
      }),
    );
    const runtime = new MissionSignalRuntime(ship, allEmittersActive(ship));

    runtime.tick(tickOf(1));
    expect(runtime.outputOf(id("sensor"))).toBe(true);
    // Circuito síncrono: la señal llega al receptor en el tick siguiente.
    expect(runtime.outputOf(id("lampara"))).toBe(false);

    runtime.tick(tickOf(2));
    expect(runtime.outputOf(id("lampara"))).toBe(true);
  });

  it("devuelve false para un nodo que no existe (cableado a medias)", () => {
    const ship = new MutableShipState(blueprintWith({ nodes: [], edges: [] }));
    const runtime = new MissionSignalRuntime(ship, allEmittersActive(ship));

    expect(runtime.outputOf(id("fantasma"))).toBe(false);
  });

  it("adopta el grafo nuevo cuando el jugador re-cablea durante la misión", () => {
    const sensor = node("sensor", "emitter");
    const lampara = node("lampara", "receptor");
    const ship = new MutableShipState(blueprintWith({ nodes: [sensor, lampara], edges: [] }));
    const runtime = new MissionSignalRuntime(ship, allEmittersActive(ship));

    runtime.tick(tickOf(1));
    runtime.tick(tickOf(2));
    expect(runtime.outputOf(id("lampara"))).toBe(false); // sin cable, no llega

    // El jugador tiende el cable (queueConnect produce un Blueprint nuevo).
    ship.set(
      blueprintWith({
        nodes: [sensor, lampara],
        edges: [{ id: "e1" as SignalEdgeId, from: id("sensor"), to: id("lampara") }],
      }),
    );
    runtime.tick(tickOf(3));
    runtime.tick(tickOf(4));

    expect(runtime.outputOf(id("lampara"))).toBe(true);
  });

  it("conserva la memoria del latch de los nodos que sobreviven al re-cableado", () => {
    const sensor = node("sensor", "emitter");
    const memoria = node("memoria", "receptor", { kind: "latch" });
    const extra = node("extra", "receptor");
    const wired: SignalGraph<PlacedComponentInstanceId> = {
      nodes: [sensor, memoria],
      edges: [{ id: "e1" as SignalEdgeId, from: id("sensor"), to: id("memoria") }],
    };
    const ship = new MutableShipState(blueprintWith(wired));
    const runtime = new MissionSignalRuntime(ship, allEmittersActive(ship));

    runtime.tick(tickOf(1));
    runtime.tick(tickOf(2));
    expect(runtime.outputOf(id("memoria"))).toBe(true);

    // El jugador añade un componente en otra parte de la nave: el latch NO
    // debe olvidarse solo porque la topología cambió en otro sitio.
    ship.set(blueprintWith({ nodes: [...wired.nodes, extra], edges: wired.edges }));
    runtime.tick(tickOf(3));

    expect(runtime.outputOf(id("memoria"))).toBe(true);
  });

  it("fuerza output=false en un nodo cuya sección quedó sin energía (Fase 11b, cicatriz)", () => {
    const sensor = node("sensor", "emitter");
    const lampara = node("lampara", "receptor");
    const wired: SignalGraph<PlacedComponentInstanceId> = {
      nodes: [sensor, lampara],
      edges: [{ id: "e1" as SignalEdgeId, from: id("sensor"), to: id("lampara") }],
    };
    const ship = new MutableShipState(blueprintWith(wired));
    const SECTION = "bahia-carga" as SectionId;
    const shipFloorplan: ShipFloorplan = {
      id: "fixture",
      archetype: "investigacion",
      nameKey: "ship.fixture",
      gridSize: { width: 1, height: 1 },
      sections: [{ id: SECTION, nameKey: "section.fixture", cells: [{ x: 0, y: 0 }] }],
      conduits: [],
      anchors: [],
    componentSeeds: [],
    };
    const runtime = new MissionSignalRuntime(ship, allEmittersActive(ship), undefined, {
      shipFloorplan,
      unpoweredSections: () => new Set([SECTION]),
    });

    runtime.tick(tickOf(1));
    runtime.tick(tickOf(2));

    // Sin la cicatriz, este circuito resolvería a `true` (mismo caso que el
    // primer test de este archivo) — la cicatriz lo fuerza a `false`.
    expect(runtime.outputOf(id("sensor"))).toBe(false);
    expect(runtime.outputOf(id("lampara"))).toBe(false);
  });

  it("no fuerza nada cuando la sección no está en la cicatriz", () => {
    const sensor = node("sensor", "emitter");
    const ship = new MutableShipState(blueprintWith({ nodes: [sensor], edges: [] }));
    const SECTION = "bahia-carga" as SectionId;
    const OTHER = "invernadero" as SectionId;
    const shipFloorplan: ShipFloorplan = {
      id: "fixture",
      archetype: "investigacion",
      nameKey: "ship.fixture",
      gridSize: { width: 1, height: 1 },
      sections: [{ id: SECTION, nameKey: "section.fixture", cells: [{ x: 0, y: 0 }] }],
      conduits: [],
      anchors: [],
    componentSeeds: [],
    };
    const runtime = new MissionSignalRuntime(ship, allEmittersActive(ship), undefined, {
      shipFloorplan,
      unpoweredSections: () => new Set([OTHER]),
    });

    runtime.tick(tickOf(1));
    expect(runtime.outputOf(id("sensor"))).toBe(true);
  });

  it("fuerza output=false para una instancia sin alimentación por triaje de prioridad (Fase 13b), aunque su sección tenga presupuesto", () => {
    const sensor = node("sensor", "emitter");
    const ship = new MutableShipState(blueprintWith({ nodes: [sensor], edges: [] }));
    const SECTION = "bahia-carga" as SectionId;
    const shipFloorplan: ShipFloorplan = {
      id: "fixture",
      archetype: "investigacion",
      nameKey: "ship.fixture",
      gridSize: { width: 1, height: 1 },
      sections: [{ id: SECTION, nameKey: "section.fixture", cells: [{ x: 0, y: 0 }] }],
      conduits: [],
      anchors: [],
      componentSeeds: [],
    };
    const runtime = new MissionSignalRuntime(
      ship,
      allEmittersActive(ship),
      undefined,
      { shipFloorplan, unpoweredSections: () => new Set() },
      { isInstancePowered: (instanceId) => instanceId !== owner("sensor") },
    );

    runtime.tick(tickOf(1));

    expect(runtime.outputOf(id("sensor"))).toBe(false);
  });

  it("allEmittersActive activa todos los emisores y ningún receptor", () => {
    const ship = new MutableShipState(
      blueprintWith({
        nodes: [node("s1", "emitter"), node("s2", "emitter"), node("r1", "receptor")],
        edges: [],
      }),
    );

    const inputs = allEmittersActive(ship)();

    expect(inputs.get(id("s1"))).toBe(true);
    expect(inputs.get(id("s2"))).toBe(true);
    expect(inputs.has(id("r1"))).toBe(false);
  });
});
