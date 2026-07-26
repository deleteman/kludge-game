import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { CrewSpecialty } from "./crew-specialty.types.js";
import type { CrewTier } from "./crew-tier.types.js";
import type { PersonalityTrait } from "./personality-trait.types.js";

/**
 * Identidad de un tripulante como ACTOR del core loop (Fase 6), extendida en
 * Fase 9 con el modelo completo del GDD 6.1-6.7: especialidad, tier, HP y
 * rasgo de personalidad. `CrewActorId`/`CrewActorStatus` no cambian — son los
 * campos de los que ya depende `TaskScheduler` desde Fase 6.
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
  /** Nombre genérico de roster (GDD 6.2) — distinto de los 8 nombres de logros (GDD 6.8, Fase 11). */
  readonly name: string;
  readonly specialty: CrewSpecialty;
  readonly tier: CrewTier;
  readonly trait: PersonalityTrait;
  readonly hp: number;
  readonly maxHp: number;
  /** Ubicación lógica en el plano (Fase 5). El movimiento visual es Fase 8. */
  readonly currentSectionId?: SectionId;
  /**
   * Celda dentro de `currentSectionId` (Fase 11d, PENDIENTES_OBSERVACIONES.md
   * punto 4). Opcional y retrocompatible: la tripulación sigue registrándose
   * sin celda por defecto (`game/src/mission/mission-runtime.ts` solo asigna
   * `currentSectionId` al spawnear); un actor sin celda conocida simplemente no
   * es un `occupant` válido para un proyectil ni un objetivo válido para el
   * combate de enemigos. Mismo tipo `GridPosition` que usan los enemigos
   * (`engine/src/enemies/enemy-actor.types.ts`) — una sola noción de posición
   * por celda, no dos sistemas paralelos.
   */
  readonly currentCell?: GridPosition;
  readonly status: CrewActorStatus;
  /**
   * Cicatriz de tripulante (GDD 6.8, logro "Superviviente nato"): cuántas
   * crisis consecutivas sobrevivió este actor con herida grave. Fase 11b solo
   * declara el campo para que sobreviva al guardado (`CampaignSaveState.crew`
   * ya serializa `CrewActor` completo) — ni el incremento del contador ni el
   * -15% de probabilidad de daño futuro que el logro otorga al llegar a 3 se
   * implementan todavía; eso es del árbol de logros (Fase 11+). Ausente/0 =
   * sin cicatriz.
   */
  readonly seriousInjurySurvivalCount?: number;
}
