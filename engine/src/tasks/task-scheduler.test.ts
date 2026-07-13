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
