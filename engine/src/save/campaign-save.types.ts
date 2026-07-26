import type { Brand } from "../shared/brand.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { ShipArchetype } from "../floorplan/floorplan.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrisisDefinitionId } from "../crisis/crisis-definition.types.js";
import type { AtomicPartsStock } from "../inventory/inventory.types.js";

/**
 * Estado dinámico de una partida de campaña (GDD 15.4: "la instancia de una
 * partida... es estado dinámico guardado por partida"). Adelantado desde
 * Fase 11 a Fase 9.5 por decisión explícita del operador — sin esto el flujo
 * de meta-juego (guardar/cargar) no se puede probar de verdad.
 *
 * Reutiliza `Blueprint` TAL CUAL como el estado vivo de la nave dentro de la
 * partida (mismo tipo, mismo `blueprint-serializer.ts` para su sub-validación)
 * — no se inventa un segundo formato de nave. Una campaña está ligada a UN
 * arquetipo elegido al inicio (decisión confirmada, estilo FTL — cierra la
 * asunción "a confirmar" de `Primeras_8_crisis.md`).
 */
export type CampaignSaveId = Brand<string, "CampaignSaveId">;

export interface CampaignSaveMetadata {
  readonly schemaVersion: number;
  readonly id: CampaignSaveId;
  readonly name: string;
  readonly archetype: ShipArchetype;
  readonly engineVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Fase 10a: resuelto — `currentChapterId`/`completedChapterIds` ahora
 * tipan contra `CrisisDefinitionId` (`crisis/crisis-definition.types.ts`,
 * resoluble vía `crisis/campaign/chapter-registry.ts`) en vez de string
 * libre. `CampaignSaveMetadata.schemaVersion` 1→2 por este cambio, mismo
 * criterio ya aplicado a `Blueprint`.
 */
export interface ChapterProgressState {
  readonly currentChapterId: CrisisDefinitionId;
  readonly completedChapterIds: ReadonlyArray<CrisisDefinitionId>;
}

export interface CampaignSaveState {
  readonly metadata: CampaignSaveMetadata;
  readonly shipState: Blueprint;
  /** Roster completo de la partida (con HP/status actuales), no solo los activos. */
  readonly crew: ReadonlyArray<CrewActor>;
  /** Selección pre-misión vigente (GDD 6.2) — subconjunto de `crew` por id. */
  readonly activeCrewIds: ReadonlyArray<CrewActorId>;
  readonly chapterProgress: ChapterProgressState;
  /**
   * Stock de piezas atómicas disponibles para instalar (`inventory/`). Nuevo en
   * `metadata.schemaVersion` 3 — un capítulo puede fijar escasez (capítulo 1:
   * arranca vacío) reemplazando el default generoso que aplica
   * `campaign-save-factory.ts` al resto de piezas.
   */
  readonly atomicStock: AtomicPartsStock;
}
