import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { CrewActor, CrewActorId, CrewActorStatus } from "../crew/crew-actor.types.js";
import type { CrewTask, CrewTaskId, TaskEffect } from "./task.types.js";
import { TERMINAL_TASK_STATES } from "./task.types.js";
import type { CoreLoopDomainEvent, TaskBlockedEvent, TaskFailedEvent } from "./task-events.types.js";
import type { Tickable } from "./core-loop-mode.js";
import {
  graphHasCycle,
  validateTaskDependencies,
  type TaskDependencyIssue,
} from "./task-dependency-graph.js";
import { taskProgressKey } from "./task-progress-key.js";

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
  /**
   * Consulta si una sección NO tiene energía asignada ahora mismo (ronda 10
   * de fixes de playtest 13e). Sin esto, ninguna tarea queda gateada por
   * energía — comportamiento previo a la regla, usado por defecto en tests
   * que no ejercitan el sistema de energía.
   */
  readonly isSectionUnpowered?: (sectionId: SectionId) => boolean;
  /**
   * Consulta si una INSTANCIA concreta no tiene su demanda satisfecha
   * (Subfase 13g). Hermana de `isSectionUnpowered` pero un nivel más fino: la
   * sección puede tener unidades y aun así el triaje de prioridad dejar sin
   * energía a la máquina con la que se hace la tarea, que es exactamente para
   * lo que existe el nivel 2 del reparto de 13b. Ausente = no se gatea por
   * instancia (fixtures que no ejercitan energía).
   */
  readonly isInstanceUnpowered?: (instanceId: PlacedComponentInstanceId) => boolean;
}

interface ActorRecord {
  status: CrewActorStatus;
  currentSectionId?: SectionId;
}

/**
 * Vista mínima de un actor tal como la conoce el scheduler (id/status/sección).
 * Deliberadamente MÁS ANGOSTA que `CrewActor` completo (Fase 9: specialty,
 * tier, hp, trait) — el scheduler solo necesita saber si un actor está
 * libre/ocupado/esperando para resolver colas y dependencias (GDD §4), no el
 * perfil completo del tripulante, que vive en el roster (`crew/crew-roster.ts`).
 */
export interface SchedulerActorSnapshot {
  readonly id: CrewActorId;
  readonly status: CrewActorStatus;
  readonly currentSectionId?: SectionId;
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
  /**
   * Avance acumulado por OBJETIVO (`taskProgressKey`), no por tarea (13f ronda
   * 3). Es lo que permite el trabajo por relevos: la tarea muere con su actor,
   * el objetivo no. Se limpia solo al COMPLETAR — cancelar o morir a mitad deja
   * el avance ahí a propósito, que es justamente el relevo.
   */
  private readonly progressByObjective = new Map<string, number>();
  private readonly notifications: PlayerNotification[] = [];

  private readonly emitter?: EventEmitter<CoreLoopDomainEvent>;
  private readonly effect: TaskEffect;
  private readonly isSectionUnpowered?: (sectionId: SectionId) => boolean;
  private readonly isInstanceUnpowered?: (instanceId: PlacedComponentInstanceId) => boolean;

  constructor(options: TaskSchedulerOptions = {}) {
    this.emitter = options.emitter;
    this.effect = options.effect ?? (() => {});
    this.isSectionUnpowered = options.isSectionUnpowered;
    this.isInstanceUnpowered = options.isInstanceUnpowered;
  }

  /**
   * Registra (o actualiza) un actor, sembrando su ubicación lógica inicial.
   *
   * `dead` es TERMINAL: re-registrar a un actor dado de baja no lo resucita
   * (13f ronda 2). Sin este guard, cualquier re-registro posterior lo devolvía
   * a `idle` — que es exactamente la clase de bug que motivó este estado.
   */
  registerActor(actor: CrewActor): void {
    const wasDead = this.actors.get(actor.id)?.status === "dead";
    this.actors.set(actor.id, {
      status: wasDead ? "dead" : actor.status,
      currentSectionId: actor.currentSectionId,
    });
  }

  /**
   * Encola una tarea al final de la cola de su actor. Valida el grafo de
   * dependencias ANTES de aceptarla (GDD §4: rechazo de ciclos al encolar) y
   * lanza `TaskDependencyError` si es inválida — la tarea no se añade.
   */
  enqueue(task: CrewTask): void {
    // Defensa en profundidad (13f ronda 2): un actor dado de baja no acepta
    // trabajo. No debería llegar acá —la UI no deja seleccionar a un muerto— y
    // por eso se descarta en silencio en vez de lanzar: hacer reventar una
    // escena por un camino que ya está cerrado es peor que no encolar.
    if (this.isDead(task.actorId)) {
      return;
    }
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

  /**
   * Hace FALLAR una tarea por una causa del mundo, no por decisión del jugador
   * (Subfase 13g). Hermana de `cancel()`: mismo esqueleto, distinto significado
   * — cancelar es del jugador, fallar le pasa a pesar del jugador, y por eso el
   * aviso es de error y lleva el motivo.
   *
   * El estado `failed` y el evento `task-failed` existían desde la Fase 6 sin un
   * solo escritor: "ya está implementado" significaba "ya se ve" (patrón 32).
   * Este es su primer disparador real.
   *
   * A diferencia de cancelar, ESTO SÍ borra el avance por objetivo: el trabajo
   * se echó a perder, no quedó a medias esperando un relevo (principio 5).
   */
  fail(taskId: CrewTaskId, reason: TaskFailedEvent["reason"], tick: TickContext): void {
    const task = this.tasksById.get(taskId);
    if (!task || TERMINAL_TASK_STATES.has(task.state)) {
      return;
    }
    task.state = "failed";
    this.lastBlockReason.delete(taskId);
    const progressKey = taskProgressKey(task);
    if (progressKey) {
      this.progressByObjective.delete(progressKey);
    }
    this.emitter?.emit({
      kind: "task-failed",
      taskId: task.id,
      actorId: task.actorId,
      reason,
      elapsedSeconds: tick.elapsedSeconds,
    });
    this.refreshActorStatus(task.actorId);
    this.cascadeDependents(taskId, "dependency-failed", tick);
  }

  /**
   * Da de baja a un actor: lo marca `dead` y cancela todo lo que tenía
   * encolado (ronda 2 de playtest de 13f — permadeath, GDD 6.1).
   *
   * Reusa `cancel()` pieza por pieza en vez de vaciar la cola a mano: eso ya
   * emite `task-cancelled` y ya cascadea `dependency-cancelled` a los
   * dependientes, que es exactamente lo que tiene que pasar cuando el que iba a
   * hacer el paso 2 se murió — el jugador tiene que enterarse de que la cadena
   * quedó rota, no descubrirlo cuando nada avanza.
   *
   * El orden importa: primero se cancela (con el actor todavía vivo, para que
   * `refreshActorStatus` funcione normal) y al final se marca `dead`, que es
   * terminal.
   */
  standDown(actorId: CrewActorId, tick: TickContext): void {
    const record = this.actorRecord(actorId);
    if (record.status === "dead") {
      return;
    }
    for (const task of this.queueFor(actorId)) {
      this.cancel(task.id, tick);
    }
    record.status = "dead";
  }

  tick(ctx: TickContext): void {
    // Fase A — avanzar las tareas en curso; completar las que alcanzan su duración.
    for (const actorId of this.queuesByActor.keys()) {
      if (this.isDead(actorId)) {
        continue;
      }
      const task = this.activeTaskOf(actorId);
      if (task && task.state === "in-progress") {
        // Subfase 13g: hasta acá la Fase A no miraba el mundo — una tarea ya
        // arrancada llegaba a completarse pasara lo que pasara con la energía,
        // porque `resolveBlockingReason` solo corría en la Fase B, o sea solo
        // para las que todavía no habían empezado. Quedarse sin energía a mitad
        // de una síntesis ahora CUESTA (principio 5): la tarea falla, no se
        // pausa esperando que vuelva la luz.
        if (this.resolveBlockingReason(task)?.reason === "no-power") {
          this.fail(task.id, "no-power", ctx);
          continue;
        }
        task.elapsedSeconds += ctx.dtSeconds;
        this.recordProgress(task);
        if (task.elapsedSeconds >= task.estimatedDurationSeconds) {
          this.completeTask(task, ctx);
        }
      }
    }

    // Fase B — arrancar/bloquear la siguiente tarea de cada actor. Se hace tras
    // la Fase A para que una dependencia completada en este mismo tick libere a
    // su dependiente en el mismo tick (determinista, sin orden entre actores).
    for (const actorId of this.queuesByActor.keys()) {
      if (this.isDead(actorId)) {
        continue;
      }
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

  /** `false` para un actor dado de baja: no tiene sentido encolarle nada (13f ronda 2). */
  canAcceptTasks(id: CrewActorId): boolean {
    return !this.isDead(id);
  }

  getActor(id: CrewActorId): SchedulerActorSnapshot | undefined {
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
    // El trabajo está hecho: el objetivo deja de acumular avance, o el
    // siguiente que instale algo en esa misma celda empezaría medio terminado.
    const progressKey = taskProgressKey(task);
    if (progressKey) {
      this.progressByObjective.delete(progressKey);
    }
    // Ubicación lógica: al terminar un desplazamiento, el actor pasa a estar allí.
    if (task.type === "go-to" && task.targetSectionId !== undefined) {
      this.actorRecord(task.actorId).currentSectionId = task.targetSectionId;
    }
    // Efecto de dominio ANTES del evento (orden correcto del patrón Observer):
    // el efecto muta el estado (ej. instala el componente en el `Blueprint`) y
    // recién después se notifica, para que los observadores (el redibujo del
    // overlay en `/game`) vean el estado ya mutado — si no, el objeto recién
    // instalado aparecía un evento tarde (desfase de uno, playtest #8).
    const result = this.effect(task);
    this.emitter?.emit({
      kind: "task-completed",
      taskId: task.id,
      actorId: task.actorId,
      type: task.type,
      elapsedSeconds: ctx.elapsedSeconds,
      obtained: result?.obtained,
      analyzedSubstanceId: result?.analyzedSubstanceId,
      obtainedElements: result?.obtainedElements,
      overflowAmount: result?.overflowAmount,
      pouredSubstanceId: result?.pouredSubstanceId,
      pouredAmount: result?.pouredAmount,
    });
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
    // Trabajo por relevos (13f ronda 3): si alguien ya avanzó sobre este mismo
    // objetivo y no pudo terminarlo —lo cancelaron, o se murió a mitad— esta
    // tarea arranca desde donde quedó, no desde cero.
    const inherited = this.inheritedProgressFor(task);
    if (inherited > task.elapsedSeconds) {
      task.elapsedSeconds = inherited;
    }
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
   * Evalúa el estado de las dependencias de una tarea (prioridad) y, si están
   * resueltas, si su sección tiene energía (ronda 10). Una dependencia
   * cancelada/fallada es un bloqueo permanente y tiene prioridad sobre la
   * espera normal a una dependencia aún en curso; el bloqueo por energía se
   * evalúa último porque es reversible sin acción del jugador sobre la tarea
   * misma (alcanza con reasignar energía a la sección).
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
    // Ronda 11: gating explícito por `powerSectionIds`, no por tipo de tarea
    // — evita una lista de exclusión que hay que recordar ampliar cada vez
    // que aparece un tipo nuevo, y permite declarar MÁS de una sección (una
    // tarea que mueve sustancia entre dos secciones distintas gatea ambas).
    // Ausente/vacío = trabajo manual del tripulante, nunca se gatea.
    for (const sectionId of task.powerSectionIds ?? []) {
      if (this.isSectionUnpowered?.(sectionId)) {
        return { reason: "no-power" };
      }
    }
    // Subfase 13g: además de la sección, la MÁQUINA concreta. Una sección puede
    // tener unidades y el triaje de prioridad dejar igual sin energía a la mesa
    // con la que se hace la tarea — que es justamente para lo que existe el
    // nivel 2 del reparto. Ausente/vacío = trabajo manual, nunca se gatea.
    for (const instanceId of task.powerInstanceIds ?? []) {
      if (this.isInstanceUnpowered?.(instanceId)) {
        return { reason: "no-power" };
      }
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

  /** Avance ya acumulado sobre el objetivo de esta tarea por intentos anteriores. */
  private inheritedProgressFor(task: CrewTask): number {
    const key = taskProgressKey(task);
    return key ? (this.progressByObjective.get(key) ?? 0) : 0;
  }

  /** Deja constancia del avance en el OBJETIVO, para que sobreviva a esta tarea. */
  private recordProgress(task: CrewTask): void {
    const key = taskProgressKey(task);
    if (key) {
      this.progressByObjective.set(key, task.elapsedSeconds);
    }
  }

  /** `dead` es terminal: ni el tick ni `refreshActorStatus` pueden sacar de ahí. */
  private isDead(actorId: CrewActorId): boolean {
    return this.actors.get(actorId)?.status === "dead";
  }

  private refreshActorStatus(actorId: CrewActorId): void {
    const record = this.actorRecord(actorId);
    if (record.status === "dead") {
      return;
    }
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
