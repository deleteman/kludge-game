import { describe, expect, it, vi } from "vitest";
import { TaskScheduler, TaskDependencyError } from "./task-scheduler.js";
import { createCrewTask } from "./task-factory.js";
import type { CrewTask, CrewTaskId } from "./task.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { CoreLoopDomainEvent } from "./task-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const ENGINEER = "engineer" as CrewActorId;
const MEDIC = "medic" as CrewActorId;
const id = (raw: string): CrewTaskId => raw as CrewTaskId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("task-scheduler: single-actor execution", () => {
  it("advances an in-progress task and completes it at its estimated duration", () => {
    const scheduler = new TaskScheduler();
    const task = createCrewTask({
      id: id("t"),
      actorId: ENGINEER,
      type: "dismantle",
      estimatedDurationSeconds: 2,
    });
    scheduler.enqueue(task);

    scheduler.tick(tickOf(1)); // arranca (in-progress, elapsed 0)
    expect(scheduler.getTask(id("t"))?.state).toBe("in-progress");
    expect(scheduler.getActor(ENGINEER)?.status).toBe("busy");

    scheduler.tick(tickOf(2)); // elapsed 1
    expect(scheduler.getTask(id("t"))?.state).toBe("in-progress");

    scheduler.tick(tickOf(3)); // elapsed 2 → completa
    expect(scheduler.getTask(id("t"))?.state).toBe("completed");
    expect(scheduler.getActor(ENGINEER)?.status).toBe("idle");
  });

  it("invokes the effect hook once on completion", () => {
    const effect = vi.fn();
    const scheduler = new TaskScheduler({ effect });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "connect",
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1)); // arranca
    scheduler.tick(tickOf(2)); // completa
    scheduler.tick(tickOf(3)); // sin efecto adicional

    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect.mock.calls[0]?.[0]).toMatchObject({ id: "t", state: "completed" });
  });

  it("forwards analyzedSubstanceId from the effect result into task-completed (Fase 11e)", () => {
    const substanceId = "reaction:unidentified:VOLAT" as never;
    const effect = vi.fn(() => ({ analyzedSubstanceId: substanceId }));
    const emitter = new EventEmitter<CoreLoopDomainEvent>();
    const events: CoreLoopDomainEvent[] = [];
    emitter.onAny((e) => events.push(e));
    const scheduler = new TaskScheduler({ effect, emitter });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "analyze-substance",
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1)); // arranca
    scheduler.tick(tickOf(2)); // completa

    const completed = events.find((e) => e.kind === "task-completed");
    expect(completed).toMatchObject({ analyzedSubstanceId: substanceId });
  });

  /**
   * 13e ronda 2. Los efectos de sustancia YA devolvían estos campos y el
   * `TaskEffectResult` YA los declaraba, pero el scheduler solo copiaba
   * `obtained` y `analyzedSubstanceId` al evento — así que morían acá y
   * `/game` no tenía cómo enterarse: extraer acreditaba elementos en silencio y
   * un desborde perdía material sin avisar. Este test es el que faltaba para
   * que ese olvido no compile en verde.
   */
  it("forwards every substance result from the effect into task-completed (13e ronda 2)", () => {
    const effect = vi.fn(() => ({
      obtainedElements: ["hidrogeno", "hidrogeno", "oxigeno"] as never,
      overflowAmount: 7,
      pouredSubstanceId: "agua" as never,
      pouredAmount: 12,
    }));
    const emitter = new EventEmitter<CoreLoopDomainEvent>();
    const events: CoreLoopDomainEvent[] = [];
    emitter.onAny((e) => events.push(e));
    const scheduler = new TaskScheduler({ effect, emitter });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "extract-elements",
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));
    scheduler.tick(tickOf(2));

    expect(events.find((e) => e.kind === "task-completed")).toMatchObject({
      obtainedElements: ["hidrogeno", "hidrogeno", "oxigeno"],
      overflowAmount: 7,
      pouredSubstanceId: "agua",
      pouredAmount: 12,
    });
  });

  it("updates the actor's logical section after a go-to task", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "go-to",
        targetSectionId: "puente" as SectionId,
        estimatedDurationSeconds: 1,
      }),
    );
    scheduler.tick(tickOf(1));
    scheduler.tick(tickOf(2));
    expect(scheduler.getActor(ENGINEER)?.currentSectionId).toBe("puente");
  });
});

describe("task-scheduler: cross-actor dependencies (GDD §4.3)", () => {
  function buildDependentPair(): {
    scheduler: TaskScheduler;
    events: CoreLoopDomainEvent[];
  } {
    const emitter = new EventEmitter<CoreLoopDomainEvent>();
    const events: CoreLoopDomainEvent[] = [];
    emitter.onAny((e) => events.push(e));
    const scheduler = new TaskScheduler({ emitter });
    scheduler.enqueue(
      createCrewTask({
        id: id("dismantle"),
        actorId: ENGINEER,
        type: "dismantle",
        estimatedDurationSeconds: 2,
      }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: id("combine"),
        actorId: MEDIC,
        type: "combine",
        estimatedDurationSeconds: 1,
        dependsOn: [id("dismantle")],
      }),
    );
    return { scheduler, events };
  }

  it("keeps the dependent task blocked until its dependency completes, then runs it", () => {
    const { scheduler } = buildDependentPair();

    scheduler.tick(tickOf(1)); // engineer arranca; medic bloqueado esperando
    expect(scheduler.getTask(id("combine"))?.state).toBe("blocked");
    expect(scheduler.getActor(MEDIC)?.status).toBe("waiting");

    scheduler.tick(tickOf(2)); // engineer elapsed 1; medic sigue bloqueado
    expect(scheduler.getTask(id("combine"))?.state).toBe("blocked");

    scheduler.tick(tickOf(3)); // engineer completa; medic arranca en el mismo tick
    expect(scheduler.getTask(id("dismantle"))?.state).toBe("completed");
    expect(scheduler.getTask(id("combine"))?.state).toBe("in-progress");

    scheduler.tick(tickOf(4)); // medic completa
    expect(scheduler.getTask(id("combine"))?.state).toBe("completed");
  });

  it("emits task-blocked once while awaiting (no per-tick noise)", () => {
    const { scheduler, events } = buildDependentPair();
    scheduler.tick(tickOf(1));
    scheduler.tick(tickOf(2));
    const blocked = events.filter((e) => e.kind === "task-blocked");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ reason: "awaiting-dependency" });
  });
});

describe("task-scheduler: cancellation and cascade (GDD §4.5)", () => {
  it("cancels an in-progress task and frees the actor", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "dismantle",
        estimatedDurationSeconds: 5,
      }),
    );
    scheduler.tick(tickOf(1)); // in-progress
    scheduler.cancel(id("t"), tickOf(1));
    expect(scheduler.getTask(id("t"))?.state).toBe("cancelled");
    expect(scheduler.getActor(ENGINEER)?.status).toBe("idle");
  });

  it("blocks dependents and queues a player notification when a dependency is cancelled", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(
      createCrewTask({
        id: id("dismantle"),
        actorId: ENGINEER,
        type: "dismantle",
        estimatedDurationSeconds: 3,
      }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: id("combine"),
        actorId: MEDIC,
        type: "combine",
        estimatedDurationSeconds: 1,
        dependsOn: [id("dismantle")],
      }),
    );

    scheduler.tick(tickOf(1)); // engineer arranca; medic bloqueado awaiting
    scheduler.cancel(id("dismantle"), tickOf(1));

    expect(scheduler.getTask(id("combine"))?.state).toBe("blocked");
    expect(scheduler.getActor(MEDIC)?.status).toBe("waiting");

    const notifications = scheduler.drainNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      taskId: "combine",
      reason: "dependency-cancelled",
      blockingTaskId: "dismantle",
    });
    // La cola se vacía tras drenar (se expone una sola vez al repausar).
    expect(scheduler.pendingNotifications).toHaveLength(0);

    // El dependiente nunca arranca: su dependencia no se completará jamás.
    scheduler.tick(tickOf(2));
    scheduler.tick(tickOf(3));
    expect(scheduler.getTask(id("combine"))?.state).toBe("blocked");
  });

  it("cancelling an already-completed task is a no-op", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "connect",
        estimatedDurationSeconds: 1,
      }),
    );
    scheduler.tick(tickOf(1));
    scheduler.tick(tickOf(2)); // completa
    scheduler.cancel(id("t"), tickOf(3));
    expect(scheduler.getTask(id("t"))?.state).toBe("completed");
  });
});

describe("task-scheduler: enqueue validation", () => {
  it("rejects enqueuing a task whose dependency does not exist yet", () => {
    const scheduler = new TaskScheduler();
    const orphan: CrewTask = createCrewTask({
      id: id("b"),
      actorId: MEDIC,
      type: "combine",
      dependsOn: [id("ghost")],
    });
    expect(() => scheduler.enqueue(orphan)).toThrow(TaskDependencyError);
    expect(scheduler.getTask(id("b"))).toBeUndefined();
  });
});

describe("task-scheduler: linkDependency (GDD §4.3 'vincular')", () => {
  it("links a valid cross-actor dependency after both tasks exist", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(createCrewTask({ id: id("a"), actorId: ENGINEER, type: "dismantle" }));
    scheduler.enqueue(createCrewTask({ id: id("b"), actorId: MEDIC, type: "combine" }));
    scheduler.linkDependency(id("b"), id("a"));
    expect(scheduler.getTask(id("b"))?.dependsOn).toEqual([id("a")]);
  });

  it("rejects a link that would create a cycle, leaving the graph untouched", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(createCrewTask({ id: id("a"), actorId: ENGINEER, type: "dismantle" }));
    scheduler.enqueue(
      createCrewTask({ id: id("b"), actorId: MEDIC, type: "combine", dependsOn: [id("a")] }),
    );
    expect(() => scheduler.linkDependency(id("a"), id("b"))).toThrow(TaskDependencyError);
    expect(scheduler.getTask(id("a"))?.dependsOn).toEqual([]);
  });
});

/**
 * Ronda 10 de fixes de playtest 13e: "si la máquina es capaz de realizar una
 * acción, esa acción queda deshabilitada si no tiene energía para hacerlo".
 * Ronda 11: el gate pasa de "tipo exento" a `powerSectionIds` explícito por
 * tarea (opt-in) — permite declarar más de una sección (transferir/aplicar
 * sustancia gatean origen Y destino) sin un switch por tipo en el scheduler,
 * y deja fuera del gate a `go-to`/`install`/`connect` (trabajo manual del
 * tripulante) sin depender de una lista de exclusión.
 */
describe("task-scheduler: power gating (rondas 10-11 de fixes de playtest 13e)", () => {
  const SECTION = "bodega" as SectionId;
  const OTHER_SECTION = "puente" as SectionId;

  it("blocks a task with reason 'no-power' when a declared powerSectionIds section has no power granted", () => {
    const scheduler = new TaskScheduler({ isSectionUnpowered: (sectionId) => sectionId === SECTION });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "extract-elements",
        targetSectionId: SECTION,
        powerSectionIds: [SECTION],
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));

    expect(scheduler.getTask(id("t"))?.state).toBe("blocked");
    expect(scheduler.getActor(ENGINEER)?.status).toBe("waiting");
  });

  it("emits task-blocked with reason 'no-power'", () => {
    const emitter = new EventEmitter<CoreLoopDomainEvent>();
    const events: CoreLoopDomainEvent[] = [];
    emitter.onAny((e) => events.push(e));
    const scheduler = new TaskScheduler({
      emitter,
      isSectionUnpowered: (sectionId) => sectionId === SECTION,
    });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "transfer-substance",
        targetSectionId: SECTION,
        powerSectionIds: [SECTION],
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));

    expect(events.find((e) => e.kind === "task-blocked")).toMatchObject({ reason: "no-power" });
  });

  it("starts the task as soon as its section regains power, without re-enqueuing", () => {
    let unpowered = true;
    const scheduler = new TaskScheduler({ isSectionUnpowered: (sectionId) => sectionId === SECTION && unpowered });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "apply-substance",
        targetSectionId: SECTION,
        powerSectionIds: [SECTION],
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));
    expect(scheduler.getTask(id("t"))?.state).toBe("blocked");

    unpowered = false;
    scheduler.tick(tickOf(2));
    expect(scheduler.getTask(id("t"))?.state).toBe("in-progress");
  });

  it("blocks a task with two declared sections when only the SECOND one lacks power (transfer to an unpowered destination)", () => {
    const scheduler = new TaskScheduler({ isSectionUnpowered: (sectionId) => sectionId === OTHER_SECTION });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "transfer-substance",
        targetSectionId: SECTION,
        powerSectionIds: [SECTION, OTHER_SECTION],
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));

    expect(scheduler.getTask(id("t"))?.state).toBe("blocked");
  });

  it("runs a task with two declared sections when BOTH have power", () => {
    const scheduler = new TaskScheduler({ isSectionUnpowered: () => false });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "transfer-substance",
        targetSectionId: SECTION,
        powerSectionIds: [SECTION, OTHER_SECTION],
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));

    expect(scheduler.getTask(id("t"))?.state).toBe("in-progress");
  });

  it.each(["dismantle", "cut-power", "purge-reservoir", "discharge-source", "go-to", "install", "connect"] as const)(
    "does not gate task type '%s' even without power, since it never declares powerSectionIds",
    (manualType) => {
      const scheduler = new TaskScheduler({ isSectionUnpowered: () => true });
      scheduler.enqueue(
        createCrewTask({
          id: id("t"),
          actorId: ENGINEER,
          type: manualType,
          targetSectionId: SECTION,
          estimatedDurationSeconds: 1,
        }),
      );

      scheduler.tick(tickOf(1));

      expect(scheduler.getTask(id("t"))?.state).toBe("in-progress");
    },
  );

  it("does not gate a task with an empty powerSectionIds even if its targetSectionId has no power", () => {
    const scheduler = new TaskScheduler({ isSectionUnpowered: () => true });
    scheduler.enqueue(
      createCrewTask({
        id: id("t"),
        actorId: ENGINEER,
        type: "combine",
        targetSectionId: SECTION,
        estimatedDurationSeconds: 1,
      }),
    );

    scheduler.tick(tickOf(1));

    expect(scheduler.getTask(id("t"))?.state).toBe("in-progress");
  });
});

/**
 * Permadeath (GDD 6.1) — ronda 2 de playtest de 13f. El operador reportó "el
 * tripulante no muere al llegar a 0 vida, sigo usándolo para todo sin
 * problema": `crew-death` existía desde la Fase 9 pero solo disparaba
 * partículas, y el scheduler nunca supo nada de HP.
 */
describe("task-scheduler: baja de un actor (13f ronda 2)", () => {
  it("cancela la cola del muerto y avisa a quien dependía de él", () => {
    const emitter = new EventEmitter<CoreLoopDomainEvent>();
    const events: CoreLoopDomainEvent[] = [];
    emitter.onAny((event) => events.push(event));
    const scheduler = new TaskScheduler({ emitter });

    scheduler.enqueue(
      createCrewTask({ id: id("desmontar"), actorId: ENGINEER, type: "dismantle", estimatedDurationSeconds: 5 }),
    );
    scheduler.enqueue(
      createCrewTask({ id: id("segunda"), actorId: ENGINEER, type: "install", estimatedDurationSeconds: 5 }),
    );
    scheduler.enqueue(
      createCrewTask({
        id: id("combinar"),
        actorId: MEDIC,
        type: "combine",
        estimatedDurationSeconds: 1,
        dependsOn: [id("desmontar")],
      }),
    );
    scheduler.tick(tickOf(1));

    scheduler.standDown(ENGINEER, tickOf(2));

    expect(scheduler.getTask(id("desmontar"))?.state).toBe("cancelled");
    expect(scheduler.getTask(id("segunda"))?.state).toBe("cancelled");
    expect(scheduler.getActor(ENGINEER)?.status).toBe("dead");
    // La cadena rota tiene que ser visible: el que esperaba queda bloqueado y
    // el jugador recibe la notificación, no descubre a mano que nada avanza.
    expect(scheduler.getTask(id("combinar"))?.state).toBe("blocked");
    expect(scheduler.pendingNotifications.length).toBeGreaterThan(0);
  });

  it("`dead` es terminal: el tick no lo devuelve a idle ni le arranca nada", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue(
      createCrewTask({ id: id("t"), actorId: ENGINEER, type: "dismantle", estimatedDurationSeconds: 2 }),
    );
    scheduler.standDown(ENGINEER, tickOf(1));

    for (let second = 2; second <= 10; second += 1) {
      scheduler.tick(tickOf(second));
    }
    expect(scheduler.getActor(ENGINEER)?.status).toBe("dead");
    expect(scheduler.getTask(id("t"))?.state).toBe("cancelled");
  });

  it("no acepta trabajo nuevo", () => {
    const scheduler = new TaskScheduler();
    scheduler.standDown(ENGINEER, tickOf(1));
    expect(scheduler.canAcceptTasks(ENGINEER)).toBe(false);

    scheduler.enqueue(
      createCrewTask({ id: id("nueva"), actorId: ENGINEER, type: "install", estimatedDurationSeconds: 1 }),
    );
    scheduler.tick(tickOf(2));
    expect(scheduler.getTask(id("nueva"))).toBeUndefined();
    expect(scheduler.queueFor(ENGINEER)).toHaveLength(0);
  });

  it("re-registrar a un muerto no lo resucita", () => {
    const scheduler = new TaskScheduler();
    scheduler.registerActor({
      id: ENGINEER,
      name: "Ríos",
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp: 100,
      maxHp: 100,
      status: "idle",
    });
    scheduler.standDown(ENGINEER, tickOf(1));
    scheduler.registerActor({
      id: ENGINEER,
      name: "Ríos",
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp: 100,
      maxHp: 100,
      status: "idle",
    });
    expect(scheduler.getActor(ENGINEER)?.status).toBe("dead");
  });

  it("dar de baja dos veces es idempotente", () => {
    const scheduler = new TaskScheduler();
    scheduler.standDown(ENGINEER, tickOf(1));
    scheduler.standDown(ENGINEER, tickOf(2));
    expect(scheduler.getActor(ENGINEER)?.status).toBe("dead");
  });
});
