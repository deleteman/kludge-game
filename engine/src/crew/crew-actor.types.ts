import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Identidad de un tripulante como ACTOR del core loop (Fase 6) — el mínimo que
 * el scheduler de tareas necesita para saber "quién ejecuta qué y dónde".
 *
 * ALCANCE DELIBERADO: esto NO es el modelo de tripulante completo. Tiers de
 * especialista (GDD 6.3), afinidad de especialidad y sus multiplicadores de
 * duración/riesgo (GDD 6.6), HP, personalidad (GDD 6.7) y permadeath (GDD 6.1)
 * son Fase 9. Fase 6 solo modela la identidad, la ubicación lógica y si el
 * actor está libre, ejecutando o esperando una dependencia — lo imprescindible
 * para el mecanismo de colas y dependencias del GDD §4.
 */
export type CrewActorId = Brand<string, "CrewActorId">;

/**
 * Estado operativo de un actor dentro del core loop:
 *  - `idle`    — sin tarea en curso.
 *  - `busy`    — ejecutando una tarea (avanzando su duración).
 *  - `waiting` — tiene una tarea lista pero bloqueada por una dependencia sin
 *                cumplir; "espera en su sitio" (GDD §4.3).
 */
export type CrewActorStatus = "idle" | "busy" | "waiting";

export interface CrewActor {
  readonly id: CrewActorId;
  /** Ubicación lógica en el plano (Fase 5). El movimiento visual es Fase 8. */
  readonly currentSectionId?: SectionId;
  readonly status: CrewActorStatus;
}
