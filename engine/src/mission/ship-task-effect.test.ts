import { describe, expect, it } from "vitest";
import { createShipTaskEffect, InsufficientStockError } from "./ship-task-effect.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { createCrewTask } from "../tasks/task-factory.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { createPhysicalComponentFactory } from "../components/physical-component-factory.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { nameAndRegisterCreation } from "../workbench/creation-naming.js";
import type { WorkbenchPieceId } from "../workbench/workbench-state.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewTaskId } from "../tasks/task.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const ACTOR = "actor-a" as CrewActorId;

/** Registry vacío para los casos que no ejercitan la derivación de nodos. */
const EMPTY_REGISTRY: EntityRegistry<ComponentId, PhysicalComponentDefinition> = {
  get: () => undefined,
  has: () => false,
  all: () => [],
};

function fixtureShip(overrides: Partial<Blueprint> = {}): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    placedComponents: [],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
    ...overrides,
  };
}

describe("createShipTaskEffect", () => {
  it("is a no-op for a task without payload", () => {
    const shipState = new MutableShipState(fixtureShip());
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));
    const task = createCrewTask({ id: "t1" as CrewTaskId, actorId: ACTOR, type: "go-to" });
    effect(task);
    expect(shipState.get()).toEqual(fixtureShip());
  });

  it("throws when the task type does not match the payload kind", () => {
    const shipState = new MutableShipState(fixtureShip());
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR,
      type: "go-to",
      payload: { kind: "dismantle", instanceId: "x" as PlacedComponentInstanceId },
    });
    expect(() => effect(task)).toThrow(/does not match payload kind/);
  });

  it("dismantle removes the instance and everything that referenced it", () => {
    const instanceId = "valvula-1" as PlacedComponentInstanceId;
    const nodeId = "node-1" as SignalNodeId;
    const otherNodeId = "node-2" as SignalNodeId;
    const shipState = new MutableShipState(
      fixtureShip({
        placedComponents: [
          {
            instanceId,
            componentDefinitionId: "valvula-simple" as ComponentId,
            placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
            condition: "jammed",
            wear: "nuevo",
          },
          {
            instanceId: "other" as PlacedComponentInstanceId,
            componentDefinitionId: "cable-cobre" as ComponentId,
            placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
            condition: "ok",
            wear: "nuevo",
          },
        ],
        reservoirContents: [{ componentInstanceId: instanceId, substanceId: "x" as never, amount: 1 }],
        signalGraph: {
          nodes: [
            { id: nodeId, role: "receptor", position: { x: 6, y: 4 }, ownerRef: instanceId },
            { id: otherNodeId, role: "emitter", position: { x: 0, y: 0 }, ownerRef: "other" as PlacedComponentInstanceId },
          ],
          edges: [{ id: "e1" as SignalEdgeId, from: otherNodeId, to: nodeId }],
        },
      }),
    );
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR,
      type: "dismantle",
      payload: { kind: "dismantle", instanceId },
    });

    effect(task);

    const ship = shipState.get();
    expect(ship.placedComponents.map((c) => c.instanceId)).toEqual(["other"]);
    expect(ship.reservoirContents).toEqual([]);
    expect(ship.signalGraph.nodes.map((n) => n.id)).toEqual([otherNodeId]);
    expect(ship.signalGraph.edges).toEqual([]);
  });

  it("install appends a new instance with condition 'ok'", () => {
    const shipState = new MutableShipState(fixtureShip());
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));
    const instanceId = "motor-2" as PlacedComponentInstanceId;
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR,
      type: "install",
      payload: {
        kind: "install",
        instanceId,
        componentDefinitionId: "motor-pequeno" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 2, height: 2 }, rotation: 0 },
      },
    });

    effect(task);

    expect(shipState.get().placedComponents).toEqual([
      {
        instanceId,
        componentDefinitionId: "motor-pequeno" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 2, height: 2 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ]);
  });

  it("connect wires an edge between two existing nodes", () => {
    const fromId = "from" as SignalNodeId;
    const toId = "to" as SignalNodeId;
    const shipState = new MutableShipState(
      fixtureShip({
        placedComponents: [
          {
            instanceId: "a" as PlacedComponentInstanceId,
            componentDefinitionId: "comp" as ComponentId,
            placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
            condition: "ok",
            wear: "nuevo",
          },
        ],
        signalGraph: {
          nodes: [
            { id: fromId, role: "emitter", position: { x: 0, y: 0 }, ownerRef: "a" as PlacedComponentInstanceId },
            { id: toId, role: "receptor", position: { x: 1, y: 0 }, ownerRef: "a" as PlacedComponentInstanceId },
          ],
          edges: [],
        },
      }),
    );
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR,
      type: "connect",
      payload: { kind: "connect", edgeId: "e1" as SignalEdgeId, fromNodeId: fromId, toNodeId: toId },
    });

    effect(task);

    expect(shipState.get().signalGraph.edges).toEqual([
      { id: "e1" as SignalEdgeId, from: fromId, to: toId, toPort: undefined },
    ]);
  });

  it("install derives signal nodes from the definition's functional properties (11c.0)", () => {
    // El `fotorreceptor` del catálogo real es EM (emisor); instalarlo en misión
    // debe dejar un nodo `emitter` cableable en la posición de la pieza — sin
    // esto, el modo cableado (busca nodos por posición) no lo encontraría.
    const registry = buildComponentCatalog().registry;
    const shipState = new MutableShipState(fixtureShip());
    const effect = createShipTaskEffect(
      shipState,
      registry,
      new MutableAtomicStock({ ["fotorreceptor" as ComponentId]: { nuevo: 1 } }),
    );
    const instanceId = "foto-1" as PlacedComponentInstanceId;
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR,
      type: "install",
      payload: {
        kind: "install",
        instanceId,
        componentDefinitionId: "fotorreceptor" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
      },
    });

    effect(task);

    const nodes = shipState.get().signalGraph.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      role: "emitter",
      position: { x: 6, y: 4 },
      ownerRef: instanceId,
    });
  });

  it("install derives a node for a custom composite creation with an EM part (11c.1)", () => {
    // Una creación de la mesa (compuesto) con una parte EM queda cableable al
    // instalarla en misión: `nameAndRegisterCreation` agrega el EM a
    // `data.functional` del compuesto, e `installInstance` deriva su nodo.
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);
    const sensor = factory.buildAtomic({
      id: "fotorreceptor" as ComponentId,
      name: "Fotorreceptor",
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "EM", range: 10, triggerType: "optical", frequency: 1 }],
      },
    });
    registry.register(sensor.id, sensor);
    const creation = nameAndRegisterCreation(
      factory,
      registry,
      [
        {
          id: "p1" as WorkbenchPieceId,
          componentDefinitionId: "fotorreceptor" as ComponentId,
          placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        },
      ],
      { id: "sensor-improvisado" as ComponentId, name: "Sensor improvisado" },
    );

    const shipState = new MutableShipState(fixtureShip());
    const effect = createShipTaskEffect(shipState, registry, new MutableAtomicStock({}));
    const instanceId = "creacion-1" as PlacedComponentInstanceId;
    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "install",
        payload: {
          kind: "install",
          instanceId,
          componentDefinitionId: creation.id,
          placement: {
            position: { x: 3, y: 3 },
            footprint: creation.level === "composite" ? creation.data.footprint! : { width: 1, height: 1 },
            rotation: 0,
          },
        },
      }),
    );

    const nodes = shipState.get().signalGraph.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ role: "emitter", ownerRef: instanceId });
  });

  it("dismantling a compound credits its recipe ingredients to atomic stock", () => {
    const registry = buildComponentCatalog().registry;
    const instanceId = "herramientas-1" as PlacedComponentInstanceId;
    const shipState = new MutableShipState(
      fixtureShip({
        placedComponents: [
          {
            instanceId,
            componentDefinitionId: "herramientas-reparacion-externa" as ComponentId,
            placement: { position: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
            condition: "ok",
            wear: "nuevo",
          },
        ],
      }),
    );
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId },
      }),
    );

    expect(atomicStock.get()).toEqual({
      ["motor-pequeno" as ComponentId]: { nuevo: 1 },
      ["plancha-metalica" as ComponentId]: { nuevo: 1 },
      ["tornilleria-fijacion" as ComponentId]: { nuevo: 3 },
      ["cable-cobre" as ComponentId]: { nuevo: 1 },
    });
  });

  it("dismantling an atomic piece recovers the piece itself to atomic stock (12c.7, obs #4)", () => {
    const registry = buildComponentCatalog().registry;
    const instanceId = "valvula-1" as PlacedComponentInstanceId;
    const shipState = new MutableShipState(
      fixtureShip({
        placedComponents: [
          {
            instanceId,
            componentDefinitionId: "valvula-simple" as ComponentId,
            placement: { position: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
            condition: "ok",
            wear: "nuevo",
          },
        ],
      }),
    );
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    const result = effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId },
      }),
    );

    // La pieza atómica vuelve al stock como su propia pieza, y el desmontaje la
    // reporta en `obtained` (para el coleccionable + notificación de `/game`).
    expect(atomicStock.get()).toEqual({ ["valvula-simple" as ComponentId]: { nuevo: 1 } });
    expect(result?.obtained).toEqual([
      // `degraded: false` — sin `RandomSource` inyectado el desmontaje nunca degrada.
      { componentId: "valvula-simple" as ComponentId, quantity: 1, wear: "nuevo", degraded: false },
    ]);
    expect(shipState.get().placedComponents).toEqual([]);
  });

  it("installing an atomic component consumes one unit of stock", () => {
    const registry = buildComponentCatalog().registry;
    const shipState = new MutableShipState(fixtureShip());
    const atomicStock = new MutableAtomicStock({ ["motor-pequeno" as ComponentId]: { nuevo: 1 } });
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "install",
        payload: {
          kind: "install",
          instanceId: "motor-2" as PlacedComponentInstanceId,
          componentDefinitionId: "motor-pequeno" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        },
      }),
    );

    expect(atomicStock.get()).toEqual({ ["motor-pequeno" as ComponentId]: {} });
  });

  it("refuses to install an atomic component with no stock and leaves the ship untouched", () => {
    const registry = buildComponentCatalog().registry;
    const shipState = new MutableShipState(fixtureShip());
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    expect(() =>
      effect(
        createCrewTask({
          id: "t1" as CrewTaskId,
          actorId: ACTOR,
          type: "install",
          payload: {
            kind: "install",
            instanceId: "motor-2" as PlacedComponentInstanceId,
            componentDefinitionId: "motor-pequeno" as ComponentId,
            placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          },
        }),
      ),
    ).toThrow(InsufficientStockError);
    expect(shipState.get().placedComponents).toEqual([]);
  });

  it("installing a compound creation does not touch atomic stock", () => {
    const registry = buildComponentCatalog().registry;
    const shipState = new MutableShipState(fixtureShip());
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "install",
        payload: {
          kind: "install",
          instanceId: "herr-1" as PlacedComponentInstanceId,
          componentDefinitionId: "herramientas-reparacion-externa" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        },
      }),
    );

    expect(atomicStock.get()).toEqual({});
    expect(shipState.get().placedComponents).toHaveLength(1);
  });

  it("cut-power drops the section allocation to zero (13d, asegurado eléctrico)", () => {
    const sectionId = "bodega" as SectionId;
    const shipState = new MutableShipState(
      fixtureShip({
        powerState: {
          sectionAllocations: [
            { sectionId, units: 3 },
            { sectionId: "puente" as SectionId, units: 2 },
          ],
          instancePriorities: [],
          permanentlyDisconnectedSectionIds: [],
        },
      }),
    );
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));

    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "cut-power",
        payload: { kind: "cut-power", sectionId },
      }),
    );

    // Quitar la entrada equivale a 0 unidades (mismo criterio que `setSectionPowerUnits`).
    expect(shipState.get().powerState.sectionAllocations).toEqual([{ sectionId: "puente", units: 2 }]);
  });

  it("purge-reservoir empties the instance contents without spilling anything (13d)", () => {
    const instanceId = "tanque-1" as PlacedComponentInstanceId;
    const shipState = new MutableShipState(
      fixtureShip({
        reservoirContents: [
          { componentInstanceId: instanceId, substanceId: "acido" as ChemicalSubstanceId, amount: 8 },
          {
            componentInstanceId: "otro" as PlacedComponentInstanceId,
            substanceId: "agua" as ChemicalSubstanceId,
            amount: 2,
          },
        ],
      }),
    );
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, atomicStock);

    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "purge-reservoir",
        payload: { kind: "purge-reservoir", instanceId },
      }),
    );

    expect(shipState.get().reservoirContents).toEqual([
      { componentInstanceId: "otro", substanceId: "agua", amount: 2 },
    ]);
    // La sustancia se ventea: no vuelve al inventario (deuda #9 sigue en 13e).
    expect(atomicStock.get()).toEqual({});
  });

  it("analyze-substance reveals the substance id and touches nothing else (Fase 11e)", () => {
    const shipState = new MutableShipState(fixtureShip());
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, atomicStock);
    const substanceId = "reaction:unidentified:VOLAT" as ChemicalSubstanceId;

    const result = effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "analyze-substance",
        payload: { kind: "analyze-substance", substanceId },
      }),
    );

    expect(result).toEqual({ analyzedSubstanceId: substanceId });
    expect(shipState.get()).toEqual(fixtureShip());
    expect(atomicStock.get()).toEqual({});
  });
});
