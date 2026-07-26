import { nextChapterAfter } from "engine";
import type { CampaignSaveState, CrisisDefinitionId } from "engine";

/**
 * Resumen que `crisis-result-scene.ts` necesita para mostrar el resultado de
 * una crisis. `buildCrisisOutcome` lo produce desde la resolución REAL (el
 * `outcome` del evento `crisis-resolved`, playtest #8), que `floorplan-scene.ts`
 * pasa a la escena de resultado vía `setPendingCrisisOutcome` (Fase 10e).
 */
export type CrisisOutcomeKind = "success" | "failure" | "partial";

export interface CrisisOutcome {
  readonly kind: CrisisOutcomeKind;
  readonly summaryLines: ReadonlyArray<string>;
  readonly nextChapterId?: string;
}

const OUTCOME_KIND_BY_RESOLUTION: Readonly<
  Record<"resolved-success" | "resolved-failure" | "resolved-partial", CrisisOutcomeKind>
> = {
  "resolved-success": "success",
  "resolved-failure": "failure",
  "resolved-partial": "partial",
};

/**
 * Outcome real derivado del `outcome` del evento `crisis-resolved` + datos de la
 * partida. `save` es el estado YA actualizado post-misión (nave/tripulación
 * reflejadas por `MissionRuntime.toUpdatedSave`, 10f), así que el resumen lee el
 * estado final, no el previo. `resolvedChapterId` es el capítulo que se acaba de
 * resolver (`mission.crisisDefinition.id`): sobre él se calcula si hay un
 * capítulo siguiente para habilitar "Siguiente capítulo" — NO sobre
 * `save.chapterProgress.currentChapterId`, que en éxito ya avanzó al siguiente y
 * daría el capítulo posterior (o `undefined`).
 */
export function buildCrisisOutcome(
  save: CampaignSaveState,
  resolution: "resolved-success" | "resolved-failure" | "resolved-partial",
  resolvedChapterId: CrisisDefinitionId,
): CrisisOutcome {
  const activeCrew = save.crew.filter((actor) => save.activeCrewIds.includes(actor.id));
  const deadCount = activeCrew.filter((actor) => actor.hp <= 0).length;
  const injuredCount = activeCrew.filter((actor) => actor.hp > 0 && actor.hp < actor.maxHp).length;
  // Solo un éxito habilita el siguiente capítulo; un fallo se reintenta desde el menú.
  const nextChapterId =
    resolution === "resolved-success"
      ? nextChapterAfter(resolvedChapterId, save.metadata.archetype)
      : undefined;
  return {
    kind: OUTCOME_KIND_BY_RESOLUTION[resolution],
    summaryLines: [
      `Tripulación activa: ${activeCrew.length}`,
      `Bajas: ${deadCount}`,
      `Heridos: ${injuredCount}`,
      `Componentes en el plano: ${save.shipState.placedComponents.length}`,
    ],
    nextChapterId,
  };
}

/**
 * Holder de módulo para pasar el outcome real de la escena de misión a la de
 * resultado (la `MissionRuntime` se destruye en la transición de escena, así
 * que no se puede recomputar desde ella en la escena de resultado).
 */
let pendingOutcome: CrisisOutcome | undefined;

export function setPendingCrisisOutcome(outcome: CrisisOutcome): void {
  pendingOutcome = outcome;
}

/** Devuelve y limpia el outcome pendiente (o `undefined` si se llegó por la tecla dev). */
export function takePendingCrisisOutcome(): CrisisOutcome | undefined {
  const outcome = pendingOutcome;
  pendingOutcome = undefined;
  return outcome;
}

