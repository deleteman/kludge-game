import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { EnemyActorId } from "./enemy-actor.types.js";

/**
 * Punto de una ruta scripteada (Fase 11d, alcance confirmado con el operador:
 * ruta determinista autorada por capítulo, no IA reactiva). `arrivalSeconds`
 * se mide en `TickContext.elapsedSeconds` — mismo reloj de misión que ya usan
 * `CrisisTimerConfig`/`CrisisHazardSchedule` (`crisis-definition.types.ts`).
 * Debe ser estrictamente creciente dentro de `ScriptedRoute.waypoints`.
 */
export interface RouteWaypoint {
  readonly cell: GridPosition;
  readonly sectionId: SectionId;
  readonly arrivalSeconds: number;
}

/**
 * Qué hacer al llegar al último waypoint: `"hold"` (se queda ahí, sigue
 * pudiendo atacar) o `"vanish"` (desaparece — huida narrativa o fin de
 * patrulla). Interpretado por `EnemyThreatRuntime`, no por
 * `route-progression.ts` (que solo resuelve posición, es agnóstico de qué
 * pasa después).
 */
export type RouteCompletion = "hold" | "vanish";

export interface ScriptedRoute {
  readonly enemyId: EnemyActorId;
  readonly waypoints: ReadonlyArray<RouteWaypoint>;
  readonly onComplete: RouteCompletion;
}
