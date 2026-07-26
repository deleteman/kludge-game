import type { ShipArchetype } from "../floorplan/floorplan.types.js";
import type { CrewActor } from "./crew-actor.types.js";

/**
 * Modelo de datos de la selección pre-misión (GDD 6.2). Deliberadamente SOLO
 * datos/tipos en Fase 9 — la UI de selección se construye en Fase 10, cuando
 * exista el primer capítulo jugable que realmente la necesite (decisión con
 * el operador).
 */
export interface CrewRoster {
  /** Tripulantes disponibles para elegir antes de la misión. */
  readonly available: ReadonlyArray<CrewActor>;
}

/**
 * Capacidad máxima de tripulantes activos por arquetipo de nave (GDD 6.2:
 * "limitado por la capacidad del arquetipo de nave"). Sin tabla numérica en
 * el GDD — valor de referencia data-driven, ajustable en playtesting, mismo
 * criterio que `THERMAL_CONDUCTIVITY_PARAMETERS`.
 */
export const CREW_CAPACITY_BY_ARCHETYPE: Record<ShipArchetype, number> = {
  investigacion: 4,
  guerra: 4,
  exploracion: 4,
  medica: 4,
};

/** Subconjunto del roster que no excede la capacidad del arquetipo elegido. */
export function selectActiveCrew(
  roster: CrewRoster,
  archetype: ShipArchetype,
  chosenIds: ReadonlyArray<CrewActor["id"]>,
): ReadonlyArray<CrewActor> {
  const capacity = CREW_CAPACITY_BY_ARCHETYPE[archetype];
  if (chosenIds.length > capacity) {
    throw new Error(
      `selectActiveCrew: ${chosenIds.length} tripulantes exceden la capacidad de ${archetype} (${capacity}, GDD 6.2)`,
    );
  }
  const byId = new Map(roster.available.map((actor) => [actor.id, actor]));
  return chosenIds.map((id) => {
    const actor = byId.get(id);
    if (!actor) {
      throw new Error(`selectActiveCrew: actor ${id} no está en el roster disponible`);
    }
    return actor;
  });
}
