import { deriveInitialReservoirContents } from "../reservoir/initial-reservoir-contents.js";
import { FACTORY_RESERVOIR_CONTENTS } from "../reservoir/factory-reservoir-contents.js";
import type { Blueprint, PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNode } from "../signals/signal-node.types.js";
import type { ShipArchetype } from "../floorplan/floorplan.types.js";
import { SHIP_ARCHETYPES } from "../floorplan/floorplan.types.js";
import { CANONICAL_SHIP_FLOORPLANS } from "../floorplan/canonical-ships.js";
import {
  baseComponentSeeds,
  componentSeedsForChapter,
  instantiateComponentSeeds,
} from "../floorplan/instantiate-component-seeds.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { CrisisDefinitionId } from "../crisis/crisis-definition.types.js";
import { nextChapterAfter } from "../crisis/campaign/chapter-sequence.js";
import {
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE,
  CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
} from "../crisis/campaign/chapter-01-primer-aviso.js";
import {
  CHAPTER_02_BY_ARCHETYPE,
  CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
} from "../crisis/campaign/chapter-02-ecos-en-el-pasillo.js";
import type { CampaignSaveState } from "./campaign-save.types.js";

/**
 * Componentes/nodos que un capítulo siembra en el `Blueprint` de la nave cuando
 * pasa a ser el capítulo activo. Ya resueltos para un arquetipo concreto (el id
 * del capítulo ya lo codifica, `capitulo-N-...-<arquetipo>`), por eso
 * `CHAPTER_SEED_BY_ID` mapea id concreto → seed sin volver a pasar el arquetipo.
 */
export interface ChapterSeed {
  readonly components: ReadonlyArray<PlacedComponentInstance>;
  readonly signalNodes: ReadonlyArray<SignalNode<PlacedComponentInstanceId>>;
}

/**
 * Registro de definiciones para resolver las semillas de la capa Tiled
 * `semillas` (`floorplan/instantiate-component-seeds.ts`) — construido una
 * sola vez a nivel de módulo, igual que `CANONICAL_SHIP_FLOORPLANS` (Fase 4:
 * "un mapa/catálogo mal formado falla en tests, no en runtime del juego").
 */
const COMPONENT_REGISTRY = buildComponentCatalog().registry;

/**
 * Semillas de un capítulo, autoradas en Tiled con `chapterId` igual al
 * `chapterOrder` de la `CrisisDefinition` (convención independiente de
 * arquetipo: "capitulo-1-primer-aviso-exploracion" y
 * "capitulo-1-primer-aviso-guerra" comparten `chapterOrder: 1`, así que el
 * mismo `chapterId: "1"` en Tiled aplica a los 4 arquetipos sin que el
 * operador tenga que conocer el id completo generado por archetype).
 */
function chapterScopedComponentSeeds(
  archetype: ShipArchetype,
  chapterOrder: number,
): ReadonlyArray<PlacedComponentInstance> {
  const seeds = componentSeedsForChapter(
    CANONICAL_SHIP_FLOORPLANS[archetype].componentSeeds,
    String(chapterOrder),
  );
  return instantiateComponentSeeds(seeds, COMPONENT_REGISTRY);
}

function buildBaseComponentSeeds(archetype: ShipArchetype): ReadonlyArray<PlacedComponentInstance> {
  return instantiateComponentSeeds(
    baseComponentSeeds(CANONICAL_SHIP_FLOORPLANS[archetype].componentSeeds),
    COMPONENT_REGISTRY,
  );
}

/**
 * Attrezzo ambiental de cada nave: semillas de la capa Tiled `semillas` SIN
 * `chapterId` (GDD 15.2/CLAUDE.md — colocación reutilizando el propio plano,
 * no un editor aparte), presentes desde el arranque de la partida. Lo
 * consume `campaign-save-factory.ts` junto al kit mínimo de
 * `initial-ship-state.ts`.
 */
export const BASE_COMPONENT_SEEDS_BY_ARCHETYPE: Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>> =
  Object.fromEntries(
    SHIP_ARCHETYPES.map((archetype) => [archetype, buildBaseComponentSeeds(archetype)]),
  ) as Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>>;

/**
 * Tabla data-driven capítulo→seed, compartida por `campaign-save-factory.ts`
 * (siembra el capítulo 1 al crear la partida) y `advanceChapterProgress`
 * (siembra el SIGUIENTE capítulo al resolver el actual). Extraída para no
 * duplicar la construcción del estado inicial en dos sitios.
 */
export const CHAPTER_SEED_BY_ID: ReadonlyMap<CrisisDefinitionId, ChapterSeed> = new Map(
  SHIP_ARCHETYPES.flatMap((archetype: ShipArchetype): Array<[CrisisDefinitionId, ChapterSeed]> => [
    [
      CHAPTER_01_BY_ARCHETYPE[archetype].id,
      {
        components: [
          CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE[archetype],
          ...CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE[archetype],
          ...chapterScopedComponentSeeds(archetype, CHAPTER_01_BY_ARCHETYPE[archetype].chapterOrder),
        ],
        signalNodes: [...CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE[archetype]],
      },
    ],
    [
      CHAPTER_02_BY_ARCHETYPE[archetype].id,
      {
        components: [
          ...CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE[archetype],
          ...chapterScopedComponentSeeds(archetype, CHAPTER_02_BY_ARCHETYPE[archetype].chapterOrder),
        ],
        signalNodes: [...CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE[archetype]],
      },
    ],
  ]),
);

/** Añade (inmutablemente) los componentes/nodos de un seed al `Blueprint` dado. */
function applyChapterSeed(blueprint: Blueprint, seed: ChapterSeed): Blueprint {
  if (seed.components.length === 0 && seed.signalNodes.length === 0) {
    return blueprint;
  }
  return {
    ...blueprint,
    placedComponents: [...blueprint.placedComponents, ...seed.components],
    // Subfase 13e (fix de playtest ronda 1): un reservorio sembrado por un
    // capítulo nace con su contenido de fábrica, igual que los del kit inicial
    // — si no, el capítulo que lo introduce lo entregaría vacío e inservible.
    reservoirContents: [
      ...blueprint.reservoirContents,
      ...deriveInitialReservoirContents(seed.components, FACTORY_RESERVOIR_CONTENTS),
    ],
    signalGraph: {
      nodes: [...blueprint.signalGraph.nodes, ...seed.signalNodes],
      edges: [...blueprint.signalGraph.edges],
    },
  };
}

/**
 * Avanza el progreso de campaña tras resolver un capítulo con éxito (10f). Puro:
 *  - agrega `resolvedChapterId` a `completedChapterIds` (dedup),
 *  - fija `currentChapterId` al siguiente de la secuencia (o lo deja igual si
 *    `resolvedChapterId` era el último — no hay más capítulos hoy),
 *  - y SIEMBRA los componentes/nodos iniciales del próximo capítulo en
 *    `shipState` (`CHAPTER_SEED_BY_ID`), para que arranque con su disparador ya
 *    en el plano igual que hace `campaign-save-factory.ts` con el capítulo 1.
 *
 * No toca `metadata.updatedAt` (eso es plomería de sesión, `campaign-session.ts`
 * en `/game`).
 */
export function advanceChapterProgress(
  save: CampaignSaveState,
  resolvedChapterId: CrisisDefinitionId,
): CampaignSaveState {
  const alreadyCompleted = save.chapterProgress.completedChapterIds.includes(resolvedChapterId);
  const completedChapterIds = alreadyCompleted
    ? save.chapterProgress.completedChapterIds
    : [...save.chapterProgress.completedChapterIds, resolvedChapterId];

  const next = nextChapterAfter(resolvedChapterId, save.metadata.archetype);
  const currentChapterId = next ?? save.chapterProgress.currentChapterId;

  const seed = next ? CHAPTER_SEED_BY_ID.get(next) : undefined;
  const shipState = seed ? applyChapterSeed(save.shipState, seed) : save.shipState;

  return {
    ...save,
    shipState,
    chapterProgress: { currentChapterId, completedChapterIds },
  };
}
