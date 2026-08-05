import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { CrewTaskId, TaskEffectResult, TaskType } from "./task.types.js";

/**
 * Eventos de dominio del core loop (Fase 6). Único seam Observer hacia `/game`
 * (CLAUDE.md): `/engine` emite, `/game` (Fase 8) se suscribe para animar. Ver
 * `simulation/domain-event.types.ts`.
 *
 * Principio 6 (legibilidad visual total): cada evento es el gancho de un
 * fenómeno visual de Fase 8 — `task-started`/`task-completed` para la barra de
 * progreso de la tarea, `task-blocked` para la animación de espera del
 * tripulante en su sitio (GDD §4.3), `task-cancelled`/`task-failed` para el
 * feedback de interrupción, y `core-loop-mode-changed` para el cambio de chrome
 * planificación↔ejecución (pausa/play). Se declaran aquí, sin código de
 * partículas (vive en `/game`).
 */

export interface TaskStartedEvent extends DomainEventBase {
  readonly kind: "task-started";
  readonly taskId: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly type: TaskType;
}

export interface TaskCompletedEvent extends DomainEventBase {
  readonly kind: "task-completed";
  readonly taskId: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly type: TaskType;
  /**
   * Piezas acreditadas al inventario por el efecto (ej. desarmar un compuesto).
   * Se REUSA el tipo de `TaskEffectResult` en vez de repetir su forma: este
   * evento es el único camino por el que ese dato llega a `/game`, y mientras
   * estuvieron duplicados los campos nuevos (`wear` en 13c) se quedaban en el
   * motor sin que nada fallara al compilar.
   */
  readonly obtained?: TaskEffectResult["obtained"];
  /** Sustancia revelada por "Analizar Sustancia" (Fase 11e). Ver `TaskEffectResult`. */
  readonly analyzedSubstanceId?: ChemicalSubstanceId;
}

/**
 * Una tarea quedó bloqueada esperando dependencias. `reason` distingue el
 * bloqueo por dependencia aún en curso del bloqueo porque una dependencia se
 * canceló/falló (GDD §4: "si una tarea de la que otra depende se cancela o
 * falla, la dependiente debe marcarse como bloqueada y notificar al jugador").
 */
export interface TaskBlockedEvent extends DomainEventBase {
  readonly kind: "task-blocked";
  readonly taskId: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly reason: "awaiting-dependency" | "dependency-cancelled" | "dependency-failed";
  /** Dependencia que provocó el bloqueo, cuando aplica. */
  readonly blockingTaskId?: CrewTaskId;
}

export interface TaskCancelledEvent extends DomainEventBase {
  readonly kind: "task-cancelled";
  readonly taskId: CrewTaskId;
  readonly actorId: CrewActorId;
}

export interface TaskFailedEvent extends DomainEventBase {
  readonly kind: "task-failed";
  readonly taskId: CrewTaskId;
  readonly actorId: CrewActorId;
}

export type CoreLoopMode = "planning" | "execution";

export interface CoreLoopModeChangedEvent extends DomainEventBase {
  readonly kind: "core-loop-mode-changed";
  readonly mode: CoreLoopMode;
}

export type CoreLoopDomainEvent =
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskBlockedEvent
  | TaskCancelledEvent
  | TaskFailedEvent
  | CoreLoopModeChangedEvent;
