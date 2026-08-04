import { describe, expect, it } from "vitest";
import { MissionProjectileWorld } from "./mission-projectile-world.js";
import { MissionSignalRuntime, allEmittersActive } from "./mission-signal-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type {
  ComponentId,
  PhysicalComponentDefinition,
} from "../components/physical-component.types.js";
import type {
  Blueprint,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
} from "../blueprint/blueprint.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { SignalNode, SignalNodeId } from "../signals/signal-node.types.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;
const instance = (value: string): PlacedComponentInstanceId => value as PlacedComponentInstanceId;
const componentId = (value: string): ComponentId => value as ComponentId;

/** Electroimán: núcleo ferromagnético (MAG) + conducción eléctrica — el criterio del caso 9. */
const ELECTROMAGNET: PhysicalComponentDefinition = {
  id: componentId("electroiman"),
  name: "Electroimán improvisado",
  level: "atomic",
  data: {
    footprint: { width: 1, height: 1 },
    functional: [{ tag: "COND", resourceType: "E", maxCapacity: 100 }],
    material: { MAG: true, CE: "A" },
  },
};

/** Imán permanente: ferromagnético pero SIN conducción — no es una bobina. */
const PERMANENT_MAGNET: PhysicalComponentDefinition = {
  id: componentId("iman-permanente"),
  name: "Imán permanente",
  level: "atomic",
  data: { footprint: { width: 1, height: 1 }, material: { MAG: true } },
};

const BATTERY: PhysicalComponentDefinition = {
  id: componentId("bateria"),
  name: "Batería",
  level: "atomic",
  data: {
    footprint: { width: 1, height: 1 },
    functional: [{ tag: "RES", resourceType: "E", capacity: 60, dischargeRate: 5 }],
  },
};

const BIG_BATTERY: PhysicalComponentDefinition = {
  id: componentId("bateria-industrial"),
  name: "Batería industrial",
  level: "atomic",
  data: {
    footprint: { width: 2, height: 2 },
    functional: [{ tag: "RES", resourceType: "E", capacity: 400, dischargeRate: 20 }],
  },
};

function registryOf(
  ...definitions: PhysicalComponentDefinition[]
): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  for (const definition of definitions) {
    registry.register(definition.id, definition);
  }
  return registry;
}

function placed(
  instanceId: string,
  definitionId: string,
  x: number,
  y: number,
  footprint = { width: 1, height: 1 },
): PlacedComponentInstance {
  return {
    instanceId: instance(instanceId),
    componentDefinitionId: componentId(definitionId),
    placement: { position: { x, y }, footprint, rotation: 0 },
    condition: "ok",
  };
}

function node(raw: string, role: SignalNode["role"]): SignalNode<PlacedComponentInstanceId> {
  return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: instance(raw) };
}

function blueprintOf(
  placedComponents: PlacedComponentInstance[],
  signalGraph: SignalGraph<PlacedComponentInstanceId>,
): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-07-17",
      updatedAt: "2026-07-17",
    },
    placedComponents,
    reservoirContents: [],
    signalGraph,
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

/** Batería (emisor, siempre activa) → bobina. Es el circuito mínimo del caso 17. */
function poweredCoil(batteryDefinition = "bateria") {
  const blueprint = blueprintOf(
    [placed("bateria", batteryDefinition, 0, 5), placed("bobina", "electroiman", 3, 0)],
    {
      nodes: [node("bateria", "emitter"), node("bobina", "receptor")],
      edges: [{ id: "e1" as SignalEdgeId, from: id("bateria"), to: id("bobina") }],
    },
  );
  const ship = new MutableShipState(blueprint);
  const signals = new MissionSignalRuntime(ship, allEmittersActive(ship));
  const world = new MissionProjectileWorld(
    ship,
    signals,
    registryOf(ELECTROMAGNET, PERMANENT_MAGNET, BATTERY, BIG_BATTERY),
  );
  // Dos ticks: un hop para energizar la batería, otro para que llegue a la bobina.
  signals.tick({ dtSeconds: 1, elapsedSeconds: 1 });
  signals.tick({ dtSeconds: 1, elapsedSeconds: 2 });
  return { ship, world };
}

describe("mission: MissionProjectileWorld", () => {
  describe("occupantAt", () => {
    it("reporta la instancia que ocupa la celda", () => {
      const { world } = poweredCoil();
      expect(world.occupantAt({ x: 3, y: 0 })).toEqual({ ref: "bobina" });
    });

    it("devuelve null en una celda vacía", () => {
      const { world } = poweredCoil();
      expect(world.occupantAt({ x: 9, y: 9 })).toBeNull();
    });

    it("cubre TODAS las celdas de una pieza grande, no solo su origen", () => {
      const ship = new MutableShipState(
        blueprintOf([placed("grande", "bateria-industrial", 4, 4, { width: 2, height: 2 })], {
          nodes: [],
          edges: [],
        }),
      );
      const signals = new MissionSignalRuntime(ship, allEmittersActive(ship));
      const world = new MissionProjectileWorld(ship, signals, registryOf(BIG_BATTERY));

      expect(world.occupantAt({ x: 5, y: 5 })).toEqual({ ref: "grande" });
    });
  });

  describe("activeCoils", () => {
    it("reconoce una bobina por propiedades (MAG + COND eléctrico + energizada)", () => {
      const { world } = poweredCoil();

      expect(world.activeCoils()).toEqual([
        { ref: "bobina", position: { x: 3, y: 0 }, current: "M" },
      ]);
    });

    it("deriva la corriente del reservorio que la alimenta, no de la pieza", () => {
      const { world } = poweredCoil("bateria-industrial");

      // Misma bobina, fuente más potente (dischargeRate 20 ≥ umbral de "A").
      expect(world.activeCoils()[0]?.current).toBe("A");
    });

    it("no cuenta un imán permanente energizado: es MAG pero no conduce", () => {
      const ship = new MutableShipState(
        blueprintOf([placed("bateria", "bateria", 0, 5), placed("iman", "iman-permanente", 3, 0)], {
          nodes: [node("bateria", "emitter"), node("iman", "receptor")],
          edges: [{ id: "e1" as SignalEdgeId, from: id("bateria"), to: id("iman") }],
        }),
      );
      const signals = new MissionSignalRuntime(ship, allEmittersActive(ship));
      const world = new MissionProjectileWorld(
        ship,
        signals,
        registryOf(PERMANENT_MAGNET, BATTERY),
      );
      signals.tick({ dtSeconds: 1, elapsedSeconds: 1 });
      signals.tick({ dtSeconds: 1, elapsedSeconds: 2 });

      expect(world.activeCoils()).toEqual([]);
    });

    it("no cuenta una bobina sin señal: hierro y cobre sin corriente no hacen campo", () => {
      const ship = new MutableShipState(
        blueprintOf([placed("bateria", "bateria", 0, 5), placed("bobina", "electroiman", 3, 0)], {
          nodes: [node("bateria", "emitter"), node("bobina", "receptor")],
          edges: [], // el jugador no tendió el cable
        }),
      );
      const signals = new MissionSignalRuntime(ship, allEmittersActive(ship));
      const world = new MissionProjectileWorld(ship, signals, registryOf(ELECTROMAGNET, BATTERY));
      signals.tick({ dtSeconds: 1, elapsedSeconds: 1 });
      signals.tick({ dtSeconds: 1, elapsedSeconds: 2 });

      expect(world.activeCoils()).toEqual([]);
    });

    it("no cuenta una bobina destruida aunque siga cableada", () => {
      const { ship, world } = poweredCoil();
      const blueprint = ship.get();
      ship.set({
        ...blueprint,
        placedComponents: blueprint.placedComponents.map((component) =>
          component.instanceId === instance("bobina")
            ? { ...component, condition: "destroyed" as const }
            : component,
        ),
      });

      expect(world.activeCoils()).toEqual([]);
    });
  });
});
