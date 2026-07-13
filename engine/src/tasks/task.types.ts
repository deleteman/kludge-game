import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";

export type CrewTaskId = Brand<string, "CrewTaskId">;

/**
 * Tipos de tarea encolables (GDD §4.2, ejemplos de la secuencia: "ir a la
 * sección X → desmontar componente Y → transportarlo a la mesa → combinarlo →
 * reinstalarlo → conectar").
 *
 * ABSTRACTOS por decisión de alcance: Fase 6 entrega el MECANISMO del core loop
 * (scheduling, dependencias, pausa/reanudación, cancelación). El EFECTO físico
 * real de cada tipo se difiere — desmontaje y recuperación de material (Fase 7
 * mesa de creación / Fase 9 recuperación por tier, GDD 6.5), síntesis (Fase 7),
 * reinstalación/conexión en el plano (Fase 7) — y se conecta vía el hook
 * `TaskEffect`, no aquí.
 */
export type TaskType = "go-to" | "dismantle" | "transport" | "combine" | "install" | "connect";

/**
 * Máquina de estados explícita de una tarea (CLAUDE.md: "State machine
 * explícita … no banderas booleanas sueltas"). Transiciones válidas:
 *
 *   pending ──(deps cumplidas)──▶ in-progress ──(duración alcanzada)──▶ completed
 *      │                              │
 *      └──(deps sin cumplir)──▶ blocked ──(deps cumplidas)──▶ in-progress
 *
 * `cancelled` y `failed` son terminales y alcanzables desde cualquier estado no
 * terminal: `cancelled` por acción del jugador (GDD §4.5), `failed` reservado
 * para cuando el efecto de una tarea (Fase 7/9/10) reporte un fallo.
 */
export type TaskState =
  "pending" | "in-progress" | "blocked" | "completed" | "cancelled" | "failed";

/** Estados de los que ninguna transición sale (la tarea ya terminó su vida). */
export const TERMINAL_TASK_STATES: ReadonlySet<TaskState> = new Set<TaskState>([
  "completed",
  "cancelled",
  "failed",
]);

export interface CrewTask {
  readonly id: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly type: TaskType;
  /** Sección donde ocurre la tarea (Fase 5). Opcional para tareas sin lugar fijo. */
  readonly targetSectionId?: SectionId;
  /** Duración estimada, en segundos simulados. Debe ser > 0 (GDD §4.2: no instantánea). */
  readonly estimatedDurationSeconds: number;
  /**
   * Ids de tareas (posiblemente de OTRO actor) que deben completar antes de
   * arrancar ésta. Mutable: el jugador puede vincular dependencias nuevas en
   * planificación (GDD §4.3), vía `TaskScheduler.linkDependency`, que revalida
   * ciclos antes de aceptar la vinculación.
   */
  dependsOn: CrewTaskId[];
  state: TaskState;
  /** Segundos de ejecución ya transcurridos mientras estuvo `in-progress`. */
  elapsedSeconds: number;
}

/**
 * Gancho de efecto invocado UNA vez al completar la tarea. Fase 6 lo deja
 * vacío/no-op; Fases 7/9/10 inyectan aquí la mutación real (desmontar el
 * compuesto, materializar la síntesis, instalar en el plano). Mantener el
 * efecto fuera del scheduler preserva la responsabilidad única: el scheduler
 * mide tiempo y resuelve dependencias, no conoce la semántica de cada tipo.
 */
export type TaskEffect = (task: CrewTask) => void;
