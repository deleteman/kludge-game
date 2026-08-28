import { describe, expect, it } from "vitest";
import { createShipTaskEffect, InsufficientStockError } from "./ship-task-effect.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { createCrewTask } from "../tasks/task-factory.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { MutableElementStock } from "../inventory/mutable-element-stock.js";
import { EXTRACTION_BATCH_UNITS } from "../reservoir/reservoir-parameters.js";
import { TransientGasInjection } from "./section-gas-injection.js";
import { UnanalyzedSubstanceError } from "../reservoir/substance-composition.js";
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
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
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
  });

  it("installing a catalog composite with consumeRecipe consumes its ingredients (ronda 7)", () => {
    const registry = buildComponentCatalog().registry;
    const shipState = new MutableShipState(fixtureShip());
    const atomicStock = new MutableAtomicStock({
      ["tubo-flexible" as ComponentId]: { nuevo: 1 },
      ["valvula-simple" as ComponentId]: { nuevo: 1 },
      ["junta-hermetica" as ComponentId]: { nuevo: 2 },
    });
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "install",
        payload: {
          kind: "install",
          instanceId: "reservorio-2" as PlacedComponentInstanceId,
          componentDefinitionId: "reservorio-agua-reciclada" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 2, height: 2 }, rotation: 0 },
          consumeRecipe: true,
        },
      }),
    );

    expect(atomicStock.get()).toEqual({
      ["tubo-flexible" as ComponentId]: {},
      ["valvula-simple" as ComponentId]: {},
      ["junta-hermetica" as ComponentId]: {},
    });
    expect(
      shipState.get().placedComponents.find((entry) => entry.instanceId === "reservorio-2"),
    ).toBeDefined();
  });

  it("refuses to install a catalog composite missing recipe stock and leaves the ship untouched (ronda 7)", () => {
    const registry = buildComponentCatalog().registry;
    const shipState = new MutableShipState(fixtureShip());
    const atomicStock = new MutableAtomicStock({
      ["tubo-flexible" as ComponentId]: { nuevo: 1 },
      // Falta valvula-simple y junta-hermetica.
    });
    const effect = createShipTaskEffect(shipState, registry, atomicStock);

    expect(() =>
      effect(
        createCrewTask({
          id: "t1" as CrewTaskId,
          actorId: ACTOR,
          type: "install",
          payload: {
            kind: "install",
            instanceId: "reservorio-2" as PlacedComponentInstanceId,
            componentDefinitionId: "reservorio-agua-reciclada" as ComponentId,
            placement: { position: { x: 6, y: 4 }, footprint: { width: 2, height: 2 }, rotation: 0 },
            consumeRecipe: true,
          },
        }),
      ),
    ).toThrow(InsufficientStockError);
    expect(shipState.get().placedComponents).toEqual([]);
    expect(atomicStock.get()).toEqual({ ["tubo-flexible" as ComponentId]: { nuevo: 1 } });
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
          dischargedSourceIds: [],
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

  /**
   * 13e ronda 2: la purga dejó de ventear a la nada. Lo purgado se vuelca sobre
   * la atmósfera de la sección — el mismo destino que `apply-substance`, porque
   * es el mismo fenómeno físico con otra intención. Sigue sin volver al
   * inventario: purgar es tirar la carga, no cosecharla.
   */
  it("purge-reservoir vacía la instancia y vuelca el contenido en la sección (13e ronda 2)", () => {
    const instanceId = "tanque-1" as PlacedComponentInstanceId;
    const acido = "acido" as ChemicalSubstanceId;
    const purgeSection = "bodega" as SectionId;
    const shipState = new MutableShipState(
      fixtureShip({
        reservoirContents: [
          { componentInstanceId: instanceId, substanceId: acido, amount: 8 },
          {
            componentInstanceId: "otro" as PlacedComponentInstanceId,
            substanceId: "agua" as ChemicalSubstanceId,
            amount: 2,
          },
        ],
      }),
    );
    const atomicStock = new MutableAtomicStock({});
    const gasInjection = new TransientGasInjection();
    const effect = createShipTaskEffect(
      shipState,
      EMPTY_REGISTRY,
      atomicStock,
      undefined,
      {},
      {},
      { gasInjection },
    );

    const result = effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "purge-reservoir",
        payload: { kind: "purge-reservoir", instanceId, sectionId: purgeSection },
      }),
    );

    expect(shipState.get().reservoirContents).toEqual([
      { componentInstanceId: "otro", substanceId: "agua", amount: 2 },
    ]);
    expect(gasInjection.asInjectionSource()().get(purgeSection)?.get(acido)).toBeGreaterThan(0);
    // Se informa lo perdido para que `/game` pueda avisarlo: purgar 8 unidades
    // en silencio es lo que hizo que el operador tirara su única materia prima.
    expect(result).toEqual({ pouredSubstanceId: acido, pouredAmount: 8 });
    // Purgar NO devuelve nada al inventario: para cosechar está `extract-elements`.
    expect(atomicStock.get()).toEqual({});
  });

  it("purge-reservoir sobre un reservorio ya vacío no falla ni inyecta nada", () => {
    const shipState = new MutableShipState(fixtureShip({ reservoirContents: [] }));
    const gasInjection = new TransientGasInjection();
    const effect = createShipTaskEffect(
      shipState,
      EMPTY_REGISTRY,
      new MutableAtomicStock({}),
      undefined,
      {},
      {},
      { gasInjection },
    );

    const result = effect(
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR,
        type: "purge-reservoir",
        payload: {
          kind: "purge-reservoir",
          instanceId: "tanque-1" as PlacedComponentInstanceId,
          sectionId: "bodega" as SectionId,
        },
      }),
    );

    expect(result).toBeUndefined();
    expect(gasInjection.asInjectionSource()().size).toBe(0);
  });

  it("discharge-source records the source and is idempotent (13d, fix ronda 1)", () => {
    const instanceId = "bateria-1" as PlacedComponentInstanceId;
    const shipState = new MutableShipState(fixtureShip());
    const effect = createShipTaskEffect(shipState, EMPTY_REGISTRY, new MutableAtomicStock({}));
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR,
      type: "discharge-source",
      payload: { kind: "discharge-source", instanceId },
    });

    effect(task);
    effect(task);

    // Descargar dos veces no duplica la entrada (el jugador puede encolarla dos veces).
    expect(shipState.get().powerState.dischargedSourceIds).toEqual([instanceId]);
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

/**
 * Subfase 13e — ciclo de vida real de una sustancia. Mismo molde que los tests
 * de 13d de arriba: `MutableShipState` + `createShipTaskEffect`, aserción sobre
 * `shipState.get()`.
 */
describe("createShipTaskEffect — sustancias (13e)", () => {
  const TANQUE_A = "tanque-a" as PlacedComponentInstanceId;
  const TANQUE_B = "tanque-b" as PlacedComponentInstanceId;
  const BODEGA = "bodega" as SectionId;
  const AGUA = "agua" as ChemicalSubstanceId;
  const HIDROGENO = "hidrogeno" as ChemicalSubstanceId;
  const OXIGENO = "oxigeno" as ChemicalSubstanceId;

  const { registry: componentRegistry } = buildComponentCatalog();
  const RESERVORIO = "reservorio-agua-reciclada" as ComponentId; // RES/L, capacity 100

  function shipWithTanks(contents: Blueprint["reservoirContents"]): Blueprint {
    const tank = (instanceId: PlacedComponentInstanceId, x: number) => ({
      instanceId,
      componentDefinitionId: RESERVORIO,
      placement: { position: { x, y: 0 }, footprint: { width: 2, height: 2 }, rotation: 0 as const },
      condition: "ok" as const,
      wear: "nuevo" as const,
    });
    return fixtureShip({
      placedComponents: [tank(TANQUE_A, 0), tank(TANQUE_B, 4)],
      reservoirContents: contents,
    });
  }

  const task = (id: string, type: Parameters<typeof createCrewTask>[0]["type"], payload: unknown) =>
    createCrewTask({
      id: id as CrewTaskId,
      actorId: ACTOR,
      type,
      payload: payload as never,
    });

  describe("transfer-substance", () => {
    it("mueve contenido de un reservorio a otro", () => {
      const shipState = new MutableShipState(
        shipWithTanks([{ componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 50 }]),
      );
      const effect = createShipTaskEffect(shipState, componentRegistry, new MutableAtomicStock({}));
      const result = effect(
        task("t1", "transfer-substance", {
          kind: "transfer-substance",
          fromInstanceId: TANQUE_A,
          toInstanceId: TANQUE_B,
          amount: 20,
        }),
      );
      const contents = shipState.get().reservoirContents;
      expect(contents.find((e) => e.componentInstanceId === TANQUE_A)?.amount).toBe(30);
      expect(contents.find((e) => e.componentInstanceId === TANQUE_B)).toEqual({
        componentInstanceId: TANQUE_B,
        substanceId: AGUA,
        amount: 20,
      });
      // Ronda 7: el éxito se reporta (antes solo se exponía el desborde) —
      // sin esto, un trasvase 100% exitoso no disparaba ninguna notificación
      // ni efecto visual en `/game`.
      expect(result?.pouredSubstanceId).toBe(AGUA);
      expect(result?.pouredAmount).toBe(20);
      expect(result?.overflowAmount).toBeUndefined();
    });

    it("reporta el desborde cuando el destino no da abasto", () => {
      const shipState = new MutableShipState(
        shipWithTanks([
          { componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 50 },
          { componentInstanceId: TANQUE_B, substanceId: AGUA, amount: 95 },
        ]),
      );
      const effect = createShipTaskEffect(shipState, componentRegistry, new MutableAtomicStock({}));
      const result = effect(
        task("t1", "transfer-substance", {
          kind: "transfer-substance",
          fromInstanceId: TANQUE_A,
          toInstanceId: TANQUE_B,
          amount: 20,
        }),
      );
      // Capacity 100: entran 5, se pierden 15.
      expect(result?.overflowAmount).toBe(15);
    });

    it("un destino sin espacio libre es un no-op — no se pierde nada (fix ronda 6)", () => {
      const shipState = new MutableShipState(
        shipWithTanks([
          { componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 50 },
          { componentInstanceId: TANQUE_B, substanceId: AGUA, amount: 100 },
        ]),
      );
      const effect = createShipTaskEffect(shipState, componentRegistry, new MutableAtomicStock({}));
      const result = effect(
        task("t1", "transfer-substance", {
          kind: "transfer-substance",
          fromInstanceId: TANQUE_A,
          toInstanceId: TANQUE_B,
          amount: 50,
        }),
      );
      const contents = shipState.get().reservoirContents;
      // Destino a capacidad completa (100/100): antes se drenaba el origen
      // igual y las 50 unidades se perdían como "desborde total". Ahora la
      // tarea es un no-op — ningún reservorio cambia.
      expect(result?.overflowAmount).toBeUndefined();
      expect(contents.find((e) => e.componentInstanceId === TANQUE_A)?.amount).toBe(50);
      expect(contents.find((e) => e.componentInstanceId === TANQUE_B)?.amount).toBe(100);
    });

    it("un origen vacío es un no-op", () => {
      const ship = shipWithTanks([]);
      const shipState = new MutableShipState(ship);
      const effect = createShipTaskEffect(shipState, componentRegistry, new MutableAtomicStock({}));
      effect(
        task("t1", "transfer-substance", {
          kind: "transfer-substance",
          fromInstanceId: TANQUE_A,
          toInstanceId: TANQUE_B,
          amount: 20,
        }),
      );
      expect(shipState.get().reservoirContents).toEqual([]);
    });
  });

  describe("apply-substance", () => {
    it("saca del reservorio e inyecta en la atmósfera de la sección", () => {
      const shipState = new MutableShipState(
        shipWithTanks([{ componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 50 }]),
      );
      const gasInjection = new TransientGasInjection();
      const effect = createShipTaskEffect(
        shipState,
        componentRegistry,
        new MutableAtomicStock({}),
        undefined,
        {},
        {},
        { gasInjection },
      );
      effect(
        task("t1", "apply-substance", {
          kind: "apply-substance",
          fromInstanceId: TANQUE_A,
          sectionId: BODEGA,
          amount: 10,
        }),
      );
      expect(shipState.get().reservoirContents[0]?.amount).toBe(40);
      expect(gasInjection.asInjectionSource()().get(BODEGA)?.get(AGUA)).toBeGreaterThan(0);
    });

    it("sin fuente de inyección igual consume del reservorio (no se pierde el gesto a medias)", () => {
      const shipState = new MutableShipState(
        shipWithTanks([{ componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 50 }]),
      );
      const effect = createShipTaskEffect(shipState, componentRegistry, new MutableAtomicStock({}));
      effect(
        task("t1", "apply-substance", {
          kind: "apply-substance",
          fromInstanceId: TANQUE_A,
          sectionId: BODEGA,
          amount: 10,
        }),
      );
      expect(shipState.get().reservoirContents[0]?.amount).toBe(40);
    });
  });

  describe("extract-elements", () => {
    const { registry: chemicalRegistry } = buildChemicalCatalog();

    function extractEffect(shipState: MutableShipState, elementStock: MutableElementStock, analyzed: ChemicalSubstanceId[]) {
      return createShipTaskEffect(
        shipState,
        componentRegistry,
        new MutableAtomicStock({}),
        undefined,
        {},
        {},
        {
          elementStock,
          composition: () => ({
            registry: chemicalRegistry,
            provenance: {},
            analyzedSubstanceIds: analyzed,
          }),
        },
      );
    }

    it("descompone la sustancia y acredita sus elementos al inventario", () => {
      const shipState = new MutableShipState(
        shipWithTanks([{ componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 3 }]),
      );
      const elementStock = new MutableElementStock({});
      const result = extractEffect(shipState, elementStock, [AGUA])(
        task("t1", "extract-elements", {
          kind: "extract-elements",
          instanceId: TANQUE_A,
          amount: 2,
        }),
      );
      // Agua = 2 H + 1 O, por 2 unidades.
      expect(elementStock.get()).toEqual({ [HIDROGENO]: 4, [OXIGENO]: 2 });
      expect(result?.obtainedElements).toHaveLength(6);
      expect(shipState.get().reservoirContents[0]?.amount).toBe(1);
    });

    it("EXIGE análisis previo: sin él lanza y no toca nada", () => {
      const ship = shipWithTanks([
        { componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 3 },
      ]);
      const shipState = new MutableShipState(ship);
      const elementStock = new MutableElementStock({});
      expect(() =>
        extractEffect(shipState, elementStock, [])(
          task("t1", "extract-elements", {
            kind: "extract-elements",
            instanceId: TANQUE_A,
            amount: 2,
          }),
        ),
      ).toThrow(UnanalyzedSubstanceError);
      expect(elementStock.get()).toEqual({});
      expect(shipState.get().reservoirContents[0]?.amount).toBe(3);
    });

    it("saca solo el LOTE pedido, no el tanque entero (13e ronda 1)", () => {
      // Con los reservorios sembrados llenos, vaciar uno de un saque daría
      // materia prima infinita: la UI encola `EXTRACTION_BATCH_UNITS` por tarea.
      const shipState = new MutableShipState(
        shipWithTanks([{ componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 100 }]),
      );
      const elementStock = new MutableElementStock({});
      extractEffect(shipState, elementStock, [AGUA])(
        task("t1", "extract-elements", {
          kind: "extract-elements",
          instanceId: TANQUE_A,
          amount: EXTRACTION_BATCH_UNITS,
        }),
      );
      expect(shipState.get().reservoirContents[0]?.amount).toBe(100 - EXTRACTION_BATCH_UNITS);
      // Agua = 2 H + 1 O por unidad.
      expect(elementStock.get()).toEqual({
        [HIDROGENO]: EXTRACTION_BATCH_UNITS * 2,
        [OXIGENO]: EXTRACTION_BATCH_UNITS,
      });
    });

    it("un reservorio vacío es un no-op", () => {
      const shipState = new MutableShipState(shipWithTanks([]));
      const elementStock = new MutableElementStock({});
      extractEffect(shipState, elementStock, [AGUA])(
        task("t1", "extract-elements", { kind: "extract-elements", instanceId: TANQUE_A, amount: 2 }),
      );
      expect(elementStock.get()).toEqual({});
    });

    it("sin dependencias de 13e cableadas es un no-op (retrocompatible)", () => {
      const shipState = new MutableShipState(
        shipWithTanks([{ componentInstanceId: TANQUE_A, substanceId: AGUA, amount: 3 }]),
      );
      const effect = createShipTaskEffect(shipState, componentRegistry, new MutableAtomicStock({}));
      effect(
        task("t1", "extract-elements", { kind: "extract-elements", instanceId: TANQUE_A, amount: 2 }),
      );
      expect(shipState.get().reservoirContents[0]?.amount).toBe(3);
    });
  });
});
