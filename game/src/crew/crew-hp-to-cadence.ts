import type { CrewActor } from "engine";

import type { HopCadence } from "./hop-movement.js";

/**
 * Umbral bajo el cual un tripulante herido salta con la cadencia "herido"
 * (GDD 11.2: "irregular, entrecortado") en vez de la normal. Fase 9 conecta
 * el HP real del `CrewActor` (`engine/src/crew/crew-actor.types.ts`) a la
 * cadencia que ya existía desde Fase 8 esperando este gancho — sin tabla
 * numérica en el GDD, valor de referencia data-driven.
 */
export const INJURED_HP_FRACTION_THRESHOLD = 0.4;

/** Cadencia de salto que corresponde al HP actual de un tripulante (ignora `"urgente"`, decidido por el llamador). */
export function cadenceForCrewHp(actor: Pick<CrewActor, "hp" | "maxHp">): HopCadence {
  if (actor.maxHp <= 0) {
    return "normal";
  }
  return actor.hp / actor.maxHp <= INJURED_HP_FRACTION_THRESHOLD ? "herido" : "normal";
}
