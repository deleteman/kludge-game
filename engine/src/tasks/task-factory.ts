import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewTask, CrewTaskId, TaskType } from "./task.types.js";
import { baseDurationFor } from "./task-parameters.js";

export interface CreateCrewTaskInput {
  readonly id: CrewTaskId;
  readonly actorId: CrewActorId;
  readonly type: TaskType;
  readonly targetSectionId?: SectionId;
  readonly dependsOn?: ReadonlyArray<CrewTaskId>;
  /**
   * Duración estimada en segundos. Si se omite, se toma la base data-driven del
   * tipo (`task-parameters.ts`). Fase 9 pasará aquí la duración YA modulada por
   * tier/afinidad (GDD 6.6) sin tocar la tabla base.
   */
  readonly estimatedDurationSeconds?: number;
}

/**
 * Factory de una tarea encolable (patrón Factory, CLAUDE.md). Centraliza los
 * valores iniciales de la máquina de estados (`pending`, `elapsedSeconds: 0`) y
 * la resolución de la duración por defecto, para que ningún llamador construya
 * un `CrewTask` a mano en un estado inconsistente.
 */
export function createCrewTask(input: CreateCrewTaskInput): CrewTask {
  const duration = input.estimatedDurationSeconds ?? baseDurationFor(input.type);
  if (duration <= 0) {
    throw new Error(
      `createCrewTask: estimatedDurationSeconds must be > 0 (GDD §4.2), got ${duration}`,
    );
  }
  return {
    id: input.id,
    actorId: input.actorId,
    type: input.type,
    targetSectionId: input.targetSectionId,
    estimatedDurationSeconds: duration,
    dependsOn: input.dependsOn ? [...input.dependsOn] : [],
    state: "pending",
    elapsedSeconds: 0,
  };
}
