// GDD 9, caso 14 — "Cadena de Montaje bajo Presión": dependencias entre colas de
// tripulantes. El Ingeniero desmonta un componente en la Sección A y el Médico usa una
// de esas piezas para fabricar algo en la Sección B; el Médico encola su tarea con
// dependencia explícita a la del Ingeniero y espera en su sitio hasta que la pieza está
// disponible (GDD §4.3). Ejercita el core loop de Fase 6 a través de su API pública.
import { describe, expect, it } from "vitest";
import {
  CoreLoopModeMachine,
  TaskScheduler,
  TaskDependencyError,
  createCrewTask,
  EventEmitter,
} from "../index.js";
import type { CoreLoopDomainEvent, CrewActorId, CrewTaskId, SectionId } from "../index.js";

const INGENIERO = "ingeniero" as CrewActorId;
const MEDICO = "medico" as CrewActorId;
const SECCION_A = "seccion-a" as SectionId;
const SECCION_B = "seccion-b" as SectionId;
const id = (raw: string): CrewTaskId => raw as CrewTaskId;

/** Motor del core loop cableado como en juego: máquina de modo + scheduler registrado. */
function buildCoreLoop(): {
  machine: CoreLoopModeMachine;
  scheduler: TaskScheduler;
  events: CoreLoopDomainEvent[];
  /** Ids de tareas cuyo efecto se ejecutó, en orden de completado. */
  completed: string[];
} {
  const emitter = new EventEmitter<CoreLoopDomainEvent>();
  const events: CoreLoopDomainEvent[] = [];
  emitter.onAny((e) => events.push(e));
  const completed: string[] = [];
  const scheduler = new TaskScheduler({
    emitter,
    effect: (t) => {
      completed.push(t.id);
    },
  });
  const machine = new CoreLoopModeMachine(emitter);
  machine.registerTickable(scheduler);
  return { machine, scheduler, events, completed };
}

describe("case 14 — Cadena de Montaje bajo Presión", () => {
  it("el Médico espera a que el Ingeniero termine antes de fabricar, y ambos completan", () => {
    const { machine, scheduler, completed } = buildCoreLoop();

    // Planificación (pausa): se encolan ambas tareas; la del Médico depende de la del Ingeniero.
    scheduler.enqueue(
      createCrewTask({
        id: id("desmontar"),
        actorId: INGENIERO,
        type: "dismantle",
        targetSectionId: SECCION_A,
        estimatedDurationSeconds: 3,
      }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: id("fabricar"),
        actorId: MEDICO,
        type: "combine",
        targetSectionId: SECCION_B,
        estimatedDurationSeconds: 2,
        dependsOn: [id("desmontar")],
      }),
    );

    // Nada avanza mientras está en planificación (GDD §4.2).
    machine.tick(1);
    expect(scheduler.getTask(id("desmontar"))?.state).toBe("pending");

    // Play: ambas colas ejecutan en paralelo en tiempo real (GDD §4.4).
    machine.play();

    machine.tick(1); // Ingeniero arranca; Médico bloqueado esperando en su sitio
    expect(scheduler.getTask(id("desmontar"))?.state).toBe("in-progress");
    expect(scheduler.getTask(id("fabricar"))?.state).toBe("blocked");
    expect(scheduler.getActor(MEDICO)?.status).toBe("waiting");
    expect(completed).toEqual([]);

    machine.tick(1); // Ingeniero elapsed 1
    machine.tick(1); // Ingeniero elapsed 2
    machine.tick(1); // Ingeniero elapsed 3 → completa; Médico arranca en el mismo tick
    expect(scheduler.getTask(id("desmontar"))?.state).toBe("completed");
    expect(scheduler.getTask(id("fabricar"))?.state).toBe("in-progress");

    machine.tick(1); // Médico elapsed 1
    machine.tick(1); // Médico elapsed 2 → completa
    expect(scheduler.getTask(id("fabricar"))?.state).toBe("completed");
    // El efecto se ejecutó una vez por tarea, en orden de completado.
    expect(completed).toEqual(["desmontar", "fabricar"]);
  });

  it("rechaza vincular una dependencia circular (A espera a B, B espera a A)", () => {
    const { scheduler } = buildCoreLoop();
    // b ya depende de a (a existe primero, se construye de abajo hacia arriba).
    scheduler.enqueue(createCrewTask({ id: id("a"), actorId: INGENIERO, type: "dismantle" }));
    scheduler.enqueue(
      createCrewTask({ id: id("b"), actorId: MEDICO, type: "combine", dependsOn: [id("a")] }),
    );
    // Vincular ahora a→b cerraría el ciclo; se rechaza sin efecto.
    expect(() => scheduler.linkDependency(id("a"), id("b"))).toThrow(TaskDependencyError);
    expect(scheduler.getTask(id("a"))?.dependsOn).toEqual([]);
  });

  it("si la tarea del Ingeniero se cancela, la del Médico queda bloqueada y notifica al repausar", () => {
    const { machine, scheduler } = buildCoreLoop();
    scheduler.enqueue(
      createCrewTask({
        id: id("desmontar"),
        actorId: INGENIERO,
        type: "dismantle",
        estimatedDurationSeconds: 5,
      }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: id("fabricar"),
        actorId: MEDICO,
        type: "combine",
        estimatedDurationSeconds: 2,
        dependsOn: [id("desmontar")],
      }),
    );

    machine.play();
    machine.tick(1); // Ingeniero arranca; Médico esperando

    // El jugador repausa y cancela la tarea del Ingeniero (GDD §4.5).
    machine.pause();
    scheduler.cancel(id("desmontar"), { dtSeconds: 1, elapsedSeconds: machine.elapsed });

    expect(scheduler.getTask(id("fabricar"))?.state).toBe("blocked");
    const notifications = scheduler.drainNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      taskId: "fabricar",
      reason: "dependency-cancelled",
      blockingTaskId: "desmontar",
    });
  });
});
