import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { ScriptedRoute } from "./enemy-route.types.js";

/** Posición resuelta de una `ScriptedRoute` en un instante dado. */
export interface RouteProgress {
  readonly cell: GridPosition;
  readonly sectionId: SectionId;
  readonly waypointIndex: number;
  /** `true` cuando `elapsedSeconds` ya alcanzó (o superó) el último waypoint. */
  readonly completed: boolean;
}

/**
 * Resuelve en qué celda debería estar un enemigo a los `elapsedSeconds` de
 * misión transcurridos, dada su `ScriptedRoute`. Función pura y determinista
 * (misma entrada -> misma salida, sin `Math.random`, sin reloj real) — mismo
 * criterio que `crisis-runtime.ts::applyHazardIfDue` (deriva del tiempo
 * transcurrido, no de un contador incremental por tick, para tolerar frame
 * drops sin perder sincronía).
 *
 * Snap discreto por celda, sin interpolar píxeles entre waypoints: la
 * interpolación visual (el salto en sí) es responsabilidad de `/game`
 * (`hopMove`), igual que `ProjectileSimulation` tampoco resuelve píxeles.
 * Antes de alcanzar el primer waypoint, el enemigo se considera ya en su
 * celda (waypoint 0 es, por convención de contenido, la posición de spawn).
 */
export function cellAtElapsedSeconds(route: ScriptedRoute, elapsedSeconds: number): RouteProgress {
  const { waypoints } = route;
  if (waypoints.length === 0) {
    throw new Error(`ScriptedRoute de ${route.enemyId} no tiene waypoints`);
  }
  let index = 0;
  for (let i = 0; i < waypoints.length; i++) {
    if (elapsedSeconds >= waypoints[i]!.arrivalSeconds) {
      index = i;
    } else {
      break;
    }
  }
  const current = waypoints[index]!;
  const completed = index === waypoints.length - 1 && elapsedSeconds >= current.arrivalSeconds;
  return { cell: current.cell, sectionId: current.sectionId, waypointIndex: index, completed };
}
