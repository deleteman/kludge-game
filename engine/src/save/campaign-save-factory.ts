import type { ShipArchetype } from "../floorplan/floorplan.types.js";
import { INITIAL_SHIP_STATE_BY_ARCHETYPE } from "../floorplan/initial-ship-state.js";
import { CREW_CAPACITY_BY_ARCHETYPE, selectActiveCrew, type CrewRoster } from "../crew/crew-roster.js";
import type { CrewActor } from "../crew/crew-actor.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import {
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_01_INITIAL_ATOMIC_STOCK,
  CHAPTER_01_UNPOWERED_SECTION_ID_BY_ARCHETYPE,
} from "../crisis/campaign/chapter-01-primer-aviso.js";
import { BASE_COMPONENT_SEEDS_BY_ARCHETYPE, CHAPTER_SEED_BY_ID } from "./chapter-progression.js";
import type { CampaignSaveId, CampaignSaveState } from "./campaign-save.types.js";

export interface CreateNewCampaignSaveInput {
  readonly id: CampaignSaveId;
  readonly name: string;
  readonly archetype: ShipArchetype;
  readonly roster: CrewRoster;
  /** Selección pre-misión inicial (GDD 6.2); debe respetar `CREW_CAPACITY_BY_ARCHETYPE`. */
  readonly chosenCrewIds: ReadonlyArray<CrewActor["id"]>;
  /** `ENGINE_VERSION` (exportado desde `index.ts`) — el llamador lo provee, `/engine` no se auto-importa. */
  readonly engineVersion: string;
  readonly now?: string;
}

/**
 * Arranca una `CampaignSaveState` nueva: la nave parte del kit mínimo
 * placeholder de `initial-ship-state.ts` (sin modo dev real todavía, Fase 11)
 * más el actuador atascado del capítulo 1 para el arquetipo elegido (10c,
 * `chapter-01-primer-aviso.ts`) — toda campaña nueva arranca en el capítulo 1
 * con su disparador ya en el plano, listo para que el jugador lo encuentre.
 * La tripulación activa se valida contra la capacidad real del arquetipo
 * reutilizando `selectActiveCrew` (Fase 9), no reimplementada aquí.
 */
export function createNewCampaignSave(input: CreateNewCampaignSaveInput): CampaignSaveState {
  const now = input.now ?? new Date().toISOString();

  // Valida capacidad/existencia de los ids elegidos (lanza si no cumple GDD 6.2).
  selectActiveCrew(input.roster, input.archetype, input.chosenCrewIds);

  // El disparador del capítulo 1 (válvula atascada + sensor/panel sin cable) se
  // siembra reutilizando la MISMA tabla data-driven que usa el avance de
  // capítulo (`CHAPTER_SEED_BY_ID`, `chapter-progression.ts`), para no duplicar
  // la construcción del estado inicial en dos sitios.
  const chapter01Seed = CHAPTER_SEED_BY_ID.get(CHAPTER_01_BY_ARCHETYPE[input.archetype].id);

  const shipState: Blueprint = {
    metadata: {
      schemaVersion: 5,
      id: `${input.id}-ship`,
      name: `${input.name} — nave`,
      engineVersion: input.engineVersion,
      createdAt: now,
      updatedAt: now,
    },
    placedComponents: [
      ...INITIAL_SHIP_STATE_BY_ARCHETYPE[input.archetype],
      // Attrezzo ambiental de la nave (capa Tiled `semillas`, sin `chapterId`):
      // objetos compuestos desarmables presentes desde el arranque, algunos
      // resuelven crisis futuras, otros son solo exploración libre.
      ...BASE_COMPONENT_SEEDS_BY_ARCHETYPE[input.archetype],
      // Válvula atascada + sensor + panel de compuerta (dueños de los nodos del 2º paso).
      ...(chapter01Seed?.components ?? []),
    ],
    reservoirContents: [],
    // Nodos emisor/receptor SIN cable — el jugador los conecta con el modo cableado.
    signalGraph: { nodes: [...(chapter01Seed?.signalNodes ?? [])], edges: [] },
    // Sin snapshot todavía: `MissionAtmosphereRuntime` siembra aire estándar por
    // sección al no encontrar una entrada (Fase 11b).
    sectionAtmospheres: [],
    // Fase 12a: sección sembrada sin energía (attrezzo, solo Exploración por
    // ahora) — cicatriz REAL desde el arranque, para que la luz ambiental de
    // "sección sin energía" sea verificable jugando, no solo en tests.
    unpoweredSectionIds: CHAPTER_01_UNPOWERED_SECTION_ID_BY_ARCHETYPE[input.archetype]
      ? [CHAPTER_01_UNPOWERED_SECTION_ID_BY_ARCHETYPE[input.archetype]!]
      : [],
    overloadedRefs: [],
  };

  return {
    metadata: {
      schemaVersion: 3,
      id: input.id,
      name: input.name,
      archetype: input.archetype,
      engineVersion: input.engineVersion,
      createdAt: now,
      updatedAt: now,
    },
    shipState,
    crew: input.roster.available,
    activeCrewIds: input.chosenCrewIds,
    chapterProgress: {
      currentChapterId: CHAPTER_01_BY_ARCHETYPE[input.archetype].id,
      completedChapterIds: [],
    },
    // Toda campaña nueva arranca en capítulo 1 (comentario de arriba): su
    // stock inicial (vacío a propósito, rework "sin stock → desarmar →
    // reutilizar") es directamente el stock con el que arranca la partida.
    atomicStock: CHAPTER_01_INITIAL_ATOMIC_STOCK,
  };
}

export { CREW_CAPACITY_BY_ARCHETYPE };
