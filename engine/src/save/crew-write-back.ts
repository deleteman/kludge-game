import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CampaignSaveState } from "./campaign-save.types.js";

/**
 * Estado VIVO de un tripulante durante la misión, tal como lo ven los dos
 * sistemas que lo llevan. Está partido porque el HP y el status viven en sitios
 * distintos a propósito: el scheduler no modela HP (`SchedulerActorSnapshot`
 * solo lleva id/status/sección) y `MutableCrewState` no modela colas.
 */
export interface LiveCrewSnapshot {
  /** De `MutableCrewState`: HP, celda y el `dead` del permadeath. */
  readonly damaged?: Pick<CrewActor, "hp" | "status" | "currentCell">;
  /** De `TaskScheduler`: qué está haciendo y dónde. */
  readonly scheduled?: Pick<CrewActor, "status" | "currentSectionId">;
}

export interface CrewWriteBack {
  readonly crew: ReadonlyArray<CrewActor>;
  readonly activeCrewIds: ReadonlyArray<CrewActorId>;
}

/**
 * Vuelca el estado vivo de la tripulación sobre el save (10f), incluida la
 * BAJA DEFINITIVA de los muertos (permadeath, GDD 6.1 — ronda 2 de playtest de
 * 13f).
 *
 * Vive en `/engine` y no dentro de `MissionRuntime` porque es lógica de forma
 * del save, no de Phaser, y porque el bug que motivó esta función —"el
 * tripulante no muere, sigo usándolo para todo"— sobrevivía en parte a que este
 * volcado no tuviera ningún test: instanciar un `MissionRuntime` completo pide
 * plano, assets y registros enteros.
 *
 * Un muerto **sigue en `crew`** (el roster conserva a quien fue, y los logros
 * de GDD 6.8 dependen de eso) y **sale de `activeCrewIds`**, que es la lista de
 * a quién se puede desplegar. `assertCampaignSaveIntegrity` exige justamente
 * esa relación: todo id activo tiene que existir en `crew`, no al revés.
 */
export function writeBackCrew(
  base: CampaignSaveState,
  liveOf: (actorId: CrewActorId) => LiveCrewSnapshot,
): CrewWriteBack {
  const crew = base.crew.map((actor) => {
    const { damaged, scheduled } = liveOf(actor.id);
    if (!damaged && !scheduled) {
      return actor;
    }
    // `dead` gana sobre lo que diga el scheduler y es definitivo: sin esto, un
    // tripulante que murió en la misión volvía entero en la siguiente.
    if (damaged?.status === "dead") {
      return { ...actor, hp: 0, status: "dead" as const };
    }
    return {
      ...actor,
      hp: damaged?.hp ?? actor.hp,
      status: scheduled?.status ?? actor.status,
      currentSectionId: scheduled?.currentSectionId ?? actor.currentSectionId,
      currentCell: damaged?.currentCell ?? actor.currentCell,
    };
  });

  const deadIds = new Set(crew.filter((actor) => actor.status === "dead").map((actor) => actor.id));
  return {
    crew,
    activeCrewIds: base.activeCrewIds.filter((id) => !deadIds.has(id)),
  };
}
