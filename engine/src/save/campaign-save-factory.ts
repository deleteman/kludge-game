import type { ShipArchetype } from "../floorplan/floorplan.types.js";
import { INITIAL_SHIP_STATE_BY_ARCHETYPE } from "../floorplan/initial-ship-state.js";
import { CREW_CAPACITY_BY_ARCHETYPE, selectActiveCrew, type CrewRoster } from "../crew/crew-roster.js";
import type { CrewActor } from "../crew/crew-actor.types.js";
import type { Blueprint, PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import {
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_01_INITIAL_ATOMIC_STOCK,
  CHAPTER_01_INITIAL_ELEMENT_STOCK,
} from "../crisis/campaign/chapter-01-primer-aviso.js";
import {
  BASE_COMPONENT_SEEDS_BY_ARCHETYPE,
  BASE_DOOR_SEEDS_BY_ARCHETYPE,
  CHAPTER_SEED_BY_ID,
} from "./chapter-progression.js";
import type { CampaignSaveId, CampaignSaveState } from "./campaign-save.types.js";
import { emptyPowerState } from "../power/power.types.js";
import { deriveInitialReservoirContents } from "../reservoir/initial-reservoir-contents.js";
import { FACTORY_RESERVOIR_CONTENTS } from "../reservoir/factory-reservoir-contents.js";

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

  const placedComponents: ReadonlyArray<PlacedComponentInstance> = [
    ...INITIAL_SHIP_STATE_BY_ARCHETYPE[input.archetype],
    // Attrezzo ambiental de la nave (capa Tiled `semillas`, sin `chapterId`):
    // objetos compuestos desarmables presentes desde el arranque, algunos
    // resuelven crisis futuras, otros son solo exploración libre.
    ...BASE_COMPONENT_SEEDS_BY_ARCHETYPE[input.archetype],
    // Puertas del casco (13h, ronda 1 de playtest): instancias reales, no una
    // entidad aparte — de ahí salen su sprite y su nodo de señal.
    ...BASE_DOOR_SEEDS_BY_ARCHETYPE[input.archetype].components,
    // Válvula atascada + sensor + panel de compuerta (dueños de los nodos del 2º paso).
    ...(chapter01Seed?.components ?? []),
  ];

  const shipState: Blueprint = {
    metadata: {
      schemaVersion: 10,
      id: `${input.id}-ship`,
      name: `${input.name} — nave`,
      engineVersion: input.engineVersion,
      createdAt: now,
      updatedAt: now,
    },
    placedComponents,
    // Subfase 13e (fix de playtest ronda 1): los reservorios nacen LLENOS con la
    // sustancia que declara su catálogo (`contains`). Antes esto era `[]` y
    // nada lo poblaba nunca, así que el ciclo de sustancias no tenía de dónde
    // sacar materia prima en partida real.
    reservoirContents: deriveInitialReservoirContents(placedComponents, FACTORY_RESERVOIR_CONTENTS),
    // Nodos emisor/receptor SIN cable — el jugador los conecta con el modo cableado.
    signalGraph: {
      nodes: [
        ...BASE_DOOR_SEEDS_BY_ARCHETYPE[input.archetype].signalNodes,
        ...(chapter01Seed?.signalNodes ?? []),
      ],
      edges: [],
    },
    // Sin snapshot todavía: `MissionAtmosphereRuntime` siembra aire estándar por
    // sección al no encontrar una entrada (Fase 11b).
    sectionAtmospheres: [],
    // Igual que la atmósfera: sin snapshot, `MissionSectionIntegrityRuntime`
    // siembra la vida inicial de cada sección desde su área (Subfase 13f).
    sectionIntegrity: [],
    // Fase 13b: `unpoweredSectionIds` pasa a ser un campo DERIVADO, recalculado
    // por `MissionPowerRuntime` en la primera pasada síncrona al arrancar la
    // misión — refleja únicamente `powerState.permanentlyDisconnectedSectionIds`
    // (cicatriz permanente real, ninguna sembrada todavía — Cap.5 futuro). El
    // déficit vivo por sección (0 unidades otorgadas ahora) es puramente
    // cosmético y se consulta vía `MissionPowerRuntime.sectionHasNoPowerGranted`,
    // no a través de este campo (ver `power-allocation.ts`).
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: emptyPowerState(),
    // Subfase 13h: mismo criterio que la atmósfera y la integridad de sección —
    // sin snapshot, `MissionDoorRuntime`/`ValveRuntime` siembran el estado
    // inicial desde la capa Tiled `puertas` y desde `initialAperture`. Una
    // partida nueva arranca con la nave compartimentada.
    doorStates: [],
    valveApertures: [],
  };

  return {
    metadata: {
      // 3→4 (Fase 13c): `atomicStock` pasa de `{pieza: n}` a buckets por
      // desgaste `{pieza: {nuevo: n}}`, ver `inventory/inventory.types.ts`.
      // 4→5 (Subfase 13e): `elementStock` + `substanceProvenance` +
      // `analyzedSubstanceIds` — la química deja de vivir solo en memoria.
      schemaVersion: 5,
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
    // Subfase 13e: mismo criterio de escasez que el stock de piezas — los
    // elementos se extraen de los reservorios de la nave (GDD 5.4.1), no
    // aparecen de fábrica. Nada analizado ni sintetizado todavía.
    elementStock: CHAPTER_01_INITIAL_ELEMENT_STOCK,
    substanceProvenance: {},
    analyzedSubstanceIds: [],
  };
}

export { CREW_CAPACITY_BY_ARCHETYPE };
