import { describe, expect, it } from "vitest";
import { CoreLoopModeMachine } from "../tasks/core-loop-mode.js";
import { TaskScheduler } from "../tasks/task-scheduler.js";
import { createCrewTask } from "../tasks/task-factory.js";
import type { CrewTaskId } from "../tasks/task.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { createShipTaskEffect } from "./ship-task-effect.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { CrisisRuntime } from "./crisis-runtime.js";
import {
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
} from "../crisis/rules/crisis-rule-registry.js";
import {
  CHAPTER_01_ACTUATOR_INSTANCE_ID,
  CHAPTER_01_ANCHOR_POSITION,
  CHAPTER_01_GATE_NODE_ID,
  CHAPTER_01_PRIMER_AVISO,
  CHAPTER_01_SEAL_INSTANCE_ID,
  CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
  CHAPTER_01_SENSOR_NODE_ID,
} from "../crisis/campaign/chapter-01-primer-aviso.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { CrisisDomainEvent } from "../crisis/crisis-events.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";

const ENGINEER = "engineer" as CrewActorId;

function chapter01InitialShip(): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "mision-capitulo-1",
      name: "Misión capítulo 1",
      engineVersion: "0.0.0",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: CHAPTER_01_ACTUATOR_INSTANCE_ID,
        componentDefinitionId: "valvula-simple" as ComponentId,
        placement: { position: CHAPTER_01_ANCHOR_POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "jammed",
      },
      // Sensor + panel de compuerta (dueños de los nodos de señal del 2º paso).
      ...CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE.exploracion,
    ],
    reservoirContents: [],
    // Nodos emisor/receptor sin cable — la tarea `connect` los une.
    signalGraph: { nodes: [...CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE.exploracion], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
  };
}

/**
 * Escenario de integración de la sub-fase 10b: el capítulo 1 resuelto a
 * través del pipeline REAL (CoreLoopModeMachine → TaskScheduler → TaskEffect
 * → CrisisRuntime), no invocando `evaluateCrisis` a mano como en
 * `crisis/campaign/chapter-01.test.ts` (10a). Sin caso de validación GDD §9
 * asociado, vive junto al resto de `mission/`.
 */
describe("Misión capítulo 1 — pipeline real (CoreLoopModeMachine + TaskScheduler + CrisisRuntime)", () => {
  it("dispara al iniciar la ejecución y resuelve tras desmontar+instalar el reemplazo", () => {
    const shipState = new MutableShipState(chapter01InitialShip());
    const componentRegistry = buildComponentCatalog().registry;
    const sealSeed = CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE.exploracion.find(
      (entry) => entry.instanceId === CHAPTER_01_SEAL_INSTANCE_ID,
    )!;
    // Stock disponible del reemplazo que instala este escenario (no ejercita
    // la escasez del capítulo 1 — eso lo cubre `chapter-01-primer-aviso.test.ts`).
    // Subfase 11h: también 1 junta hermética de repuesto, para sellar la fuga.
    const atomicStock = new MutableAtomicStock({
      ["motor-pequeno" as ComponentId]: 1,
      ["junta-hermetica" as ComponentId]: 1,
    });
    const scheduler = new TaskScheduler({
      effect: createShipTaskEffect(shipState, componentRegistry, atomicStock),
    });
    const crisisEvents: CrisisDomainEvent[] = [];
    const crisisEmitter = new EventEmitter<CrisisDomainEvent>();
    crisisEmitter.onAny((event) => crisisEvents.push(event));
    const crisisRuntime = new CrisisRuntime({
      definition: CHAPTER_01_PRIMER_AVISO,
      shipState,
      componentRegistry,
      registries: {
        triggerRules: createDefaultCrisisTriggerRegistry(),
        resolutionRules: createDefaultCrisisResolutionRegistry(),
      },
      emitter: crisisEmitter,
    });

    const mode = new CoreLoopModeMachine();
    mode.registerTickable(scheduler);
    mode.registerTickable(crisisRuntime);

    // En planificación no pasa nada (GDD §4.2), aunque encolemos tareas.
    scheduler.enqueue(
      createCrewTask({
        id: "dismantle-valvula" as CrewTaskId,
        actorId: ENGINEER,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: CHAPTER_01_ACTUATOR_INSTANCE_ID },
      }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: "install-motor" as CrewTaskId,
        actorId: ENGINEER,
        type: "install",
        dependsOn: ["dismantle-valvula" as CrewTaskId],
        payload: {
          kind: "install",
          instanceId: "motor-reemplazo" as PlacedComponentInstanceId,
          componentDefinitionId: "motor-pequeno" as ComponentId,
          placement: { position: CHAPTER_01_ANCHOR_POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
        },
      }),
    );
    // 2º paso: cablear el sensor de proximidad al panel de la compuerta.
    scheduler.enqueue(
      createCrewTask({
        id: "cablear-sensor" as CrewTaskId,
        actorId: ENGINEER,
        type: "connect",
        dependsOn: ["install-motor" as CrewTaskId],
        payload: {
          kind: "connect",
          edgeId: "cable-sensor-compuerta" as SignalEdgeId,
          fromNodeId: CHAPTER_01_SENSOR_NODE_ID,
          toNodeId: CHAPTER_01_GATE_NODE_ID,
        },
      }),
    );
    // 3er paso (Subfase 11h): sellar la fuga — desmontar la junta rota e
    // instalar la de repuesto, en paralelo a la cadena válvula→sensor.
    scheduler.enqueue(
      createCrewTask({
        id: "dismantle-junta" as CrewTaskId,
        actorId: ENGINEER,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: CHAPTER_01_SEAL_INSTANCE_ID },
      }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: "install-junta" as CrewTaskId,
        actorId: ENGINEER,
        type: "install",
        dependsOn: ["dismantle-junta" as CrewTaskId],
        payload: {
          kind: "install",
          instanceId: "junta-reemplazo" as PlacedComponentInstanceId,
          componentDefinitionId: "junta-hermetica" as ComponentId,
          placement: { position: sealSeed.placement.position, footprint: { width: 1, height: 1 }, rotation: 0 },
        },
      }),
    );
    mode.tick(1); // no-op: seguimos en "planning"
    expect(crisisRuntime.crisisState).toBe("not-triggered");

    mode.play();
    mode.tick(1); // primer tick en ejecución: el trigger ya aplica (válvula jammed desde el inicio)
    expect(crisisRuntime.crisisState).toBe("active");

    // dismantle (12s) + install (8s) + connect (5s) = 25s, a 1 tick por segundo;
    // la cadena de la junta corre en paralelo, mismo actor pero sin dependsOn
    // cruzado — el scheduler la intercala, no se suma en serie.
    for (let i = 0; i < 60 && crisisRuntime.crisisState !== "resolved-success"; i++) {
      mode.tick(1);
    }

    expect(crisisRuntime.crisisState).toBe("resolved-success");
    const finalShip = shipState.get();
    // La válvula atascada se fue; el motor reemplazo quedó "ok" en el anclaje;
    // el sensor y el panel sembrados siguen presentes.
    expect(finalShip.placedComponents).toContainEqual({
      instanceId: "motor-reemplazo" as PlacedComponentInstanceId,
      componentDefinitionId: "motor-pequeno" as ComponentId,
      placement: { position: CHAPTER_01_ANCHOR_POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
      condition: "ok",
    });
    expect(
      finalShip.placedComponents.some((c) => c.instanceId === CHAPTER_01_ACTUATOR_INSTANCE_ID),
    ).toBe(false);
    // El cable sensor→compuerta quedó tendido en el grafo de señales.
    expect(finalShip.signalGraph.edges).toContainEqual(
      expect.objectContaining({ from: CHAPTER_01_SENSOR_NODE_ID, to: CHAPTER_01_GATE_NODE_ID }),
    );
    expect(crisisEvents.map((event) => event.kind)).toEqual(["crisis-triggered", "crisis-resolved"]);
    expect(crisisEvents.at(-1)).toMatchObject({ outcome: "resolved-success" });
  });
});
