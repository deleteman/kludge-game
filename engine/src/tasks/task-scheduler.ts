import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewActor, CrewActorId, CrewActorStatus } from "../crew/crew-actor.types.js";
import type { CrewTask, CrewTaskId, TaskEffect } from "./task.types.js";
import { TERMINAL_TASK_STATES } from "./task.types.js";
import type { CoreLoopDomainEvent, TaskBlockedEvent } from "./task-events.types.js";
import type { Tickable } from "./core-loop-mode.js";
import {
  graphHasCycle,
  validateTaskDependencies,
  type TaskDependencyIssue,
} from "./task-dependency-graph.js";

/** Motivo por el que una tarea quedó bloqueada de forma no transitoria (dependencia terminal). */
export type BlockingReason = TaskBlockedEvent["reason"];

/**
 * Notificación para el jugador que se acumula durante la ejecución y se expone
 * al repausar (GDD §4: "si una tarea de la que otra depende se cancela o falla,
 * la dependiente debe marcarse como bloqueada y notificar al jugador al
 * repausar"). Solo se generan por bloqueos por dependencia cancelada/fallada,
 * no por la espera normal a una dependencia aún en curso.
 */
export interface PlayerNotification {
  readonly taskId: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly reason: "dependency-cancelled" | "dependency-failed";
  readonly blockingTaskId: CrewTaskId;
}

/** Se lanza al encolar una tarea que viola la integridad del grafo de dependencias. */
export class TaskDependencyError extends Error {
  constructor(readonly issues: ReadonlyArray<TaskDependencyIssue>) {
    super(`Task dependency validation failed: ${JSON.stringify(issues)}`);
    this.name = "TaskDependencyError";
  }
}

export interface TaskSchedulerOptions {
  readonly emitter?: EventEmitter<CoreLoopDomainEvent>;
  /** Hook de efecto invocado al completar cada tarea (Fases 7/9/10). Por defecto no-op. */
  readonly effect?: TaskEffect;
}

interface ActorRecord {
  status: CrewActorStatus;
  currentSectionId?: SectionId;
}

/**
 * Scheduler de tareas del core loop (Fase 6). Clase con estado + `tick(ctx)`,
 * mismo patrón que `HazardAccumulator`/`StructuralIntegrity`. Implementa
 * `Tickable`: se registra en `CoreLoopModeMachine`, que solo la avanza en modo
 * ejecución (la pausa la congela sin que el scheduler conozca el modo).
 *
 * Responsabilidad única: mide el tiempo de ejecución de las tareas y resuelve
 * las dependencias entre colas de distintos tripulantes (GDD §4). NO conoce la
 * semántica de cada tipo de tarea — el efecto físico se delega al hook
 * `TaskEffect` que rellenan Fases 7/9/10.
 */
export class TaskScheduler implements Tickable {
  private readonly tasksById = new Map<CrewTaskId, CrewTask>();
  private readonly queuesByActor = new Map<CrewActorId, CrewTaskId[]>();
  private readonly actors = new Map<CrewActorId, ActorRecord>();
  /** Último motivo de bloqueo emitido por tarea, para emitir solo en transición/cambio de motivo. */
  private readonly lastBlockReason = new Map<CrewTaskId, BlockingReason>();
  private readonly notifications: PlayerNotification[] = [];

  private readonly emitter?: EventEmitter<CoreLoopDomainEvent>;
  private readonly effect: TaskEffect;

  constructor(options: TaskSchedulerOptions = {}) {
    this.emitter = options.emitter;
    this.effect = options.effect ?? (() => {});
  }

  /** Registra (o actualiza) un actor, sembrando su ubicación lógica inicial. */
  registerActor(actor: CrewActor): void {
    this.actors.set(actor.id, {
      status: actor.status,
      currentSectionId: actor.currentSectionId,
    });
  }

  /**
   * Encola una tarea al final de la cola de su actor. Valida el grafo de
   * dependencias ANTES de aceptarla (GDD §4: rechazo de ciclos al encolar) y
   * lanza `TaskDependencyError` si es inválida — la tarea no se añade.
   */
  enqueue(task: CrewTask): void {
    const issues = validateTaskDependencies(task, this.tasksById);
    if (issues.length > 0) {
      throw new TaskDependencyError(issues);
    }
    this.tasksById.set(task.id, task);
    this.actorRecord(task.actorId); // crea el registro del actor si no existía
    let queue = this.queuesByActor.get(task.actorId);
    if (!queue) {
      queue = [];
      this.queuesByActor.set(task.actorId, queue);
    }
    queue.push(task.id);
  }

  /**
   * Vincula `dependentId` como dependiente de `dependencyId` (GDD §4.3, "el
   * jugador puede vincular una tarea … como dependiente de la tarea de otro").
   * Ambas tareas deben existir. Revalida ciclos ANTES de aceptar la
   * vinculación; si crearía un ciclo (A espera a B, B espera a A), lanza
   * `TaskDependencyError` y NO modifica nada. Vincular una dependencia ya
   * existente es un no-op idempotente.
   */
  linkDependency(dependentId: CrewTaskId, dependencyId: CrewTaskId): void {
    const dependent = this.tasksById.get(dependentId);
    const dependency = this.tasksById.get(dependencyId);
    const issues: TaskDependencyIssue[] = [];
    if (dependentId === dependencyId) {
      issues.push({ kind: "self-dependency", detail: `Task ${dependentId} depends on itself` });
    }
    if (!dependent || !dependency) {
      issues.push({
        kind: "missing-dependency",
        detail: `linkDependency requires both tasks to exist (${dependentId} -> ${dependencyId})`,
      });
    }
    if (issues.length > 0) {
      throw new TaskDependencyError(issues);
    }
    if (dependent!.dependsOn.includes(dependencyId)) {
      return;
    }
    dependent!.dependsOn.push(dependencyId);
    if (graphHasCycle(this.tasksById)) {
      dependent!.dependsOn.pop(); // rollback: la vinculación se rechaza sin efecto
      throw new TaskDependencyError([
        {
          kind: "circular-dependency",
          detail: `Linking ${dependentId} -> ${dependencyId} would create a circular dependency`,
        },
      ]);
    }
  }

  /**
   * Cancela una tarea (GDD §4.5). Si otras tareas dependían de ella, las marca
   * bloqueadas de inmediato y encola una notificación para el jugador. No-op si
   * la tarea ya estaba en un estado terminal.
   */
  cancel(taskId: CrewTaskId, tick: TickContext): void {
    const task = this.tasksById.get(taskId);
    if (!task || TERMINAL_TASK_STATES.has(task.state)) {
      return;
    }
    task.state = "cancelled";
    this.lastBlockReason.delete(taskId);
    this.emitter?.emit({
      kind: "task-cancelled",
      taskId: task.id,
      actorId: task.actorId,
      elapsedSeconds: tick.elapsedSeconds,
    });
    this.refreshActorStatus(task.actorId);
    this.cascadeDependents(taskId, "dependency-cancelled", tick);
  }

  tick(ctx: TickContext): void {
    // Fase A — avanzar las tareas en curso; completar las que alcanzan su duración.
    for (const actorId of this.queuesByActor.keys()) {
      const task = this.activeTaskOf(actorId);
      if (task && task.state === "in-progress") {
        task.elapsedSeconds += ctx.dtSeconds;
        if (task.elapsedSeconds >= task.estimatedDurationSeconds) {
          this.completeTask(task, ctx);
        }
      }
    }

    // Fase B — arrancar/bloquear la siguiente tarea de cada actor. Se hace tras
    // la Fase A para que una dependencia completada en este mismo tick libere a
    // su dependiente en el mismo tick (determinista, sin orden entre actores).
    for (const actorId of this.queuesByActor.keys()) {
      const task = this.activeTaskOf(actorId);
      if (!task || task.state === "in-progress") {
        continue;
      }
      if (task.state === "pending" || task.state === "blocked") {
        this.scheduleTask(task, ctx);
      }
    }
  }

  // --- Lectura pública ------------------------------------------------------

  getTask(id: CrewTaskId): CrewTask | undefined {
    return this.tasksById.get(id);
  }

  getActor(id: CrewActorId): CrewActor | undefined {
    const record = this.actors.get(id);
    if (!record) {
      return undefined;
    }
    return { id, status: record.status, currentSectionId: record.currentSectionId };
  }

  queueFor(actorId: CrewActorId): ReadonlyArray<CrewTask> {
    const ids = this.queuesByActor.get(actorId) ?? [];
    return ids.map((id) => this.tasksById.get(id)).filter((t): t is CrewTask => t !== undefined);
  }

  get pendingNotifications(): ReadonlyArray<PlayerNotification> {
    return this.notifications;
  }

  /** Devuelve y vacía las notificaciones acumuladas (se llama al repausar). */
  drainNotifications(): PlayerNotification[] {
    return this.notifications.splice(0, this.notifications.length);
  }

  // --- Interno --------------------------------------------------------------

  private actorRecord(actorId: CrewActorId): ActorRecord {
    let record = this.actors.get(actorId);
    if (!record) {
      record = { status: "idle" };
      this.actors.set(actorId, record);
    }
    return record;
  }

  /** Primera tarea no terminal de la cola del actor (la que está "activa"). */
  private activeTaskOf(actorId: CrewActorId): CrewTask | undefined {
    const ids = this.queuesByActor.get(actorId);
    if (!ids) {
      return undefined;
    }
    for (const id of ids) {
      const task = this.tasksById.get(id);
      if (task && !TERMINAL_TASK_STATES.has(task.state)) {
        return task;
      }
    }
    return undefined;
  }

  private completeTask(task: CrewTask, ctx: TickContext): void {
    task.state = "completed";
    this.lastBlockReason.delete(task.id);
    // Ubicación lógica: al terminar un desplazamiento, el actor pasa a estar allí.
    if (task.type === "go-to" && task.targetSectionId !== undefined) {
      this.actorRecord(task.actorId).currentSectionId = task.targetSectionId;
    }
    this.emitter?.emit({
      kind: "task-completed",
      taskId: task.id,
      actorId: task.actorId,
      type: task.type,
      elapsedSeconds: ctx.elapsedSeconds,
    });
    this.effect(task);
    this.refreshActorStatus(task.actorId);
  }

  /** Arranca la tarea si sus dependencias están listas; si no, la bloquea. */
  private scheduleTask(task: CrewTask, ctx: TickContext): void {
    const blocking = this.resolveBlockingReason(task);
    if (blocking) {
      this.blockTask(task, blocking.reason, blocking.blockingTaskId, ctx);
      return;
    }
    task.state = "in-progress";
    this.lastBlockReason.delete(task.id);
    this.actorRecord(task.actorId).status = "busy";
    this.emitter?.emit({
      kind: "task-started",
      taskId: task.id,
      actorId: task.actorId,
      type: task.type,
      elapsedSeconds: ctx.elapsedSeconds,
    });
  }

  /**
   * Evalúa el estado de las dependencias de una tarea. Una dependencia
   * cancelada/fallada es un bloqueo permanente y tiene prioridad sobre la
   * espera normal a una dependencia aún en curso.
   */
  private resolveBlockingReason(
    task: CrewTask,
  ): { reason: BlockingReason; blockingTaskId?: CrewTaskId } | undefined {
    let awaiting: CrewTaskId | undefined;
    for (const depId of task.dependsOn) {
      const dep = this.tasksById.get(depId);
      const state = dep?.state;
      if (state === "cancelled") {
        return { reason: "dependency-cancelled", blockingTaskId: depId };
      }
      if (state === "failed") {
        return { reason: "dependency-failed", blockingTaskId: depId };
      }
      if (state !== "completed" && awaiting === undefined) {
        awaiting = depId;
      }
    }
    if (awaiting !== undefined) {
      return { reason: "awaiting-dependency", blockingTaskId: awaiting };
    }
    return undefined;
  }

  /**
   * Marca una tarea como bloqueada. Emite `task-blocked` solo en la transición
   * a bloqueo o cuando cambia el motivo (evita ruido tick a tick, mismo criterio
   * de eventos discretos que el resto del motor). Un bloqueo por dependencia
   * cancelada/fallada además encola una notificación para el jugador.
   */
  private blockTask(
    task: CrewTask,
    reason: BlockingReason,
    blockingTaskId: CrewTaskId | undefined,
    tick: TickContext,
  ): void {
    task.state = "blocked";
    this.actorRecord(task.actorId).status = "waiting";
    const previous = this.lastBlockReason.get(task.id);
    if (previous === reason) {
      return;
    }
    this.lastBlockReason.set(task.id, reason);
    this.emitter?.emit({
      kind: "task-blocked",
      taskId: task.id,
      actorId: task.actorId,
      reason,
      blockingTaskId,
      elapsedSeconds: tick.elapsedSeconds,
    });
    if (
      (reason === "dependency-cancelled" || reason === "dependency-failed") &&
      blockingTaskId !== undefined
    ) {
      this.notifications.push({
        taskId: task.id,
        actorId: task.actorId,
        reason,
        blockingTaskId,
      });
    }
  }

  /** Bloquea todas las tareas no terminales que dependían de `taskId`. */
  private cascadeDependents(taskId: CrewTaskId, reason: BlockingReason, tick: TickContext): void {
    for (const task of this.tasksById.values()) {
      if (TERMINAL_TASK_STATES.has(task.state)) {
        continue;
      }
      if (task.dependsOn.includes(taskId)) {
        this.blockTask(task, reason, taskId, tick);
      }
    }
  }

  private refreshActorStatus(actorId: CrewActorId): void {
    const record = this.actorRecord(actorId);
    const active = this.activeTaskOf(actorId);
    if (!active) {
      record.status = "idle";
    } else if (active.state === "in-progress") {
      record.status = "busy";
    } else if (active.state === "blocked") {
      record.status = "waiting";
    } else {
      record.status = "idle";
    }
  }
}
