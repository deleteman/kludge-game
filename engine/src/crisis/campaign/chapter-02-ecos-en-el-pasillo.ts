import type { GridPosition } from "../../geometry/grid-position.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../../blueprint/blueprint.types.js";
import type { ComponentId } from "../../components/physical-component.types.js";
import type { SignalNode, SignalNodeId } from "../../signals/signal-node.types.js";
import type { ShipArchetype } from "../../floorplan/floorplan.types.js";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";
import type { CrisisDefinition, CrisisDefinitionId } from "../crisis-definition.types.js";

/**
 * "Ecos en el Pasillo" (docs/Primeras_8_crisis.md, capítulo 2) — el primero que
 * enseña COMBINACIÓN de señales (la promesa "como redstone"). Disparador: dos
 * sensores de movimiento en un pasillo disparan la alarma con cualquier eco
 * aislado; hay que combinar sus señales para que la salida solo se active
 * cuando AMBOS confirman movimiento real. Solución: cablear los dos sensores
 * (emisores) al nodo combinador (compuerta AND, sembrada) del panel, de modo
 * que su salida reproduzca la tabla de verdad pedida (`signal-output-matches`).
 *
 * A diferencia del capítulo 1, ESTE tiene amenaza: timer medio + consecuencia
 * `crew-damage`. Si el timer vence con el combinador mal cableado, el sistema
 * automatizado electrocuta a un tripulante activo (daño medio, no letal desde
 * HP lleno). El daño lo aplica `CrisisRuntime` (`mission/crisis-runtime.ts`),
 * no el dominio puro `evaluateCrisis`.
 *
 * Contenido MECÁNICO (posiciones/ids), no narrativo — `docs/Primeras_8_crisis.md`
 * marca la narrativa como pendiente. Solo Exploración se verifica jugable de
 * punta a punta (celdas y=9 del pasillo-central, walkable comprobadas contra la
 * grilla del mapa); los otros 3 arquetipos son posiciones de referencia.
 */
export const CHAPTER_02_SENSOR_A_INSTANCE_ID = "capitulo-2-sensor-a" as PlacedComponentInstanceId;
export const CHAPTER_02_SENSOR_B_INSTANCE_ID = "capitulo-2-sensor-b" as PlacedComponentInstanceId;
export const CHAPTER_02_GATE_PANEL_INSTANCE_ID = "capitulo-2-panel-combinador" as PlacedComponentInstanceId;
export const CHAPTER_02_SENSOR_A_NODE_ID = "capitulo-2-nodo-sensor-a" as SignalNodeId;
export const CHAPTER_02_SENSOR_B_NODE_ID = "capitulo-2-nodo-sensor-b" as SignalNodeId;
export const CHAPTER_02_GATE_NODE_ID = "capitulo-2-nodo-combinador" as SignalNodeId;

/** Timer medio (referencia data-driven, ajustable en playtest — no hay tabla en el GDD). */
export const CHAPTER_02_SOFT_DEADLINE_SECONDS = 60;

const CHAPTER_02_BRIEFING_KEY = "crisis.briefing.capitulo-2-ecos-en-el-pasillo";
const CHAPTER_02_OBJECTIVE_KEY = "crisis.objective.capitulo-2.combinador";

interface Chapter02ArchetypeParams {
  readonly sensorAPosition: GridPosition;
  readonly sensorBPosition: GridPosition;
  readonly gatePanelPosition: GridPosition;
}

/**
 * Posiciones por arquetipo. Exploración: celdas del pasillo-central (y=9)
 * verificadas walkable contra la grilla del mapa, sin solapar los componentes
 * del capítulo 1. El resto: referencia (mismas celdas de pasillo), sin
 * verificación visual — solo Exploración se juega de punta a punta (criterio 10c).
 */
const CHAPTER_02_PARAMS_BY_ARCHETYPE: Record<ShipArchetype, Chapter02ArchetypeParams> = {
  exploracion: {
    sensorAPosition: { x: 12, y: 9 },
    gatePanelPosition: { x: 14, y: 9 },
    sensorBPosition: { x: 16, y: 9 },
  },
  guerra: {
    sensorAPosition: { x: 12, y: 9 },
    gatePanelPosition: { x: 14, y: 9 },
    sensorBPosition: { x: 16, y: 9 },
  },
  investigacion: {
    sensorAPosition: { x: 12, y: 9 },
    gatePanelPosition: { x: 14, y: 9 },
    sensorBPosition: { x: 16, y: 9 },
  },
  medica: {
    sensorAPosition: { x: 12, y: 9 },
    gatePanelPosition: { x: 14, y: 9 },
    sensorBPosition: { x: 16, y: 9 },
  },
};

function buildChapter02Definition(archetype: ShipArchetype): CrisisDefinition {
  return {
    id: `capitulo-2-ecos-en-el-pasillo-${archetype}` as CrisisDefinitionId,
    chapterOrder: 2,
    name: "Ecos en el Pasillo",
    briefingKey: CHAPTER_02_BRIEFING_KEY,
    archetypeHint: archetype,
    triggers: [
      {
        kind: "motion-sensors-active",
        sensorInstanceIds: [CHAPTER_02_SENSOR_A_INSTANCE_ID, CHAPTER_02_SENSOR_B_INSTANCE_ID],
      },
    ],
    // Tabla de verdad de un AND: la salida solo se activa con AMBOS sensores.
    // Cualquier cableado que la reproduzca resuelve (no se hardcodea el gate).
    resolutions: [
      {
        kind: "signal-output-matches",
        outputNodeId: CHAPTER_02_GATE_NODE_ID,
        objectiveKey: CHAPTER_02_OBJECTIVE_KEY,
        cases: [
          {
            inputs: [
              { nodeId: CHAPTER_02_SENSOR_A_NODE_ID, active: true },
              { nodeId: CHAPTER_02_SENSOR_B_NODE_ID, active: true },
            ],
            expected: true,
          },
          {
            inputs: [
              { nodeId: CHAPTER_02_SENSOR_A_NODE_ID, active: true },
              { nodeId: CHAPTER_02_SENSOR_B_NODE_ID, active: false },
            ],
            expected: false,
          },
          {
            inputs: [
              { nodeId: CHAPTER_02_SENSOR_A_NODE_ID, active: false },
              { nodeId: CHAPTER_02_SENSOR_B_NODE_ID, active: true },
            ],
            expected: false,
          },
          {
            inputs: [
              { nodeId: CHAPTER_02_SENSOR_A_NODE_ID, active: false },
              { nodeId: CHAPTER_02_SENSOR_B_NODE_ID, active: false },
            ],
            expected: false,
          },
        ],
      },
    ],
    timer: { softDeadlineSeconds: CHAPTER_02_SOFT_DEADLINE_SECONDS, onExpire: "resolved-failure" },
    // Castigo progresivo: pasado el 60% del tiempo, el sistema electrocuta a un
    // tripulante cada 15s (demorar CUESTA HP). No letal en este capítulo (solo
    // hiere) — el permadeath se reserva para capítulos posteriores.
    hazard: {
      kind: "periodic-crew-damage",
      startFraction: 0.6,
      intervalSeconds: 15,
      severity: "low",
      cause: "electrocution",
      lethal: false,
    },
    // Golpe final al vencer sin resolver (fallo de misión), también no letal.
    consequence: { kind: "crew-damage", severity: "medium", cause: "electrocution", lethal: false },
  };
}

export const CHAPTER_02_BY_ARCHETYPE: Record<ShipArchetype, CrisisDefinition> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter02Definition(archetype)]),
) as Record<ShipArchetype, CrisisDefinition>;

/** Dos sensores de movimiento (`fotorreceptor`) + panel combinador (`chip-circuito-generico`), por arquetipo. */
function buildChapter02SeededComponents(archetype: ShipArchetype): ReadonlyArray<PlacedComponentInstance> {
  const params = CHAPTER_02_PARAMS_BY_ARCHETYPE[archetype];
  const cell = (
    position: GridPosition,
    id: PlacedComponentInstanceId,
    definitionId: string,
  ): PlacedComponentInstance => ({
    instanceId: id,
    componentDefinitionId: definitionId as ComponentId,
    placement: { position, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  });
  return [
    cell(params.sensorAPosition, CHAPTER_02_SENSOR_A_INSTANCE_ID, "fotorreceptor"),
    cell(params.sensorBPosition, CHAPTER_02_SENSOR_B_INSTANCE_ID, "fotorreceptor"),
    cell(params.gatePanelPosition, CHAPTER_02_GATE_PANEL_INSTANCE_ID, "chip-circuito-generico"),
  ];
}

/**
 * Nodos del capítulo 2, SIN cable: dos emisores (sensores) y el nodo combinador
 * (receptor con comportamiento `gate` AND, ya configurado — el jugador solo
 * cablea ambos sensores hacia él). Que la compuerta esté pre-configurada como
 * AND es lo que hace el puzzle resoluble con la herramienta de cableado
 * existente (crear aristas), sin un editor de comportamiento de nodo.
 */
function buildChapter02SeededNodes(archetype: ShipArchetype): ReadonlyArray<SignalNode<PlacedComponentInstanceId>> {
  const params = CHAPTER_02_PARAMS_BY_ARCHETYPE[archetype];
  return [
    {
      id: CHAPTER_02_SENSOR_A_NODE_ID,
      role: "emitter",
      position: params.sensorAPosition,
      ownerRef: CHAPTER_02_SENSOR_A_INSTANCE_ID,
    },
    {
      id: CHAPTER_02_SENSOR_B_NODE_ID,
      role: "emitter",
      position: params.sensorBPosition,
      ownerRef: CHAPTER_02_SENSOR_B_INSTANCE_ID,
    },
    {
      id: CHAPTER_02_GATE_NODE_ID,
      role: "receptor",
      position: params.gatePanelPosition,
      ownerRef: CHAPTER_02_GATE_PANEL_INSTANCE_ID,
      behavior: { kind: "gate", mode: "AND" },
    },
  ];
}

/** Componentes a sembrar al activar el capítulo 2, por arquetipo. */
export const CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<PlacedComponentInstance>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter02SeededComponents(archetype)]),
) as Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>>;

/** Nodos de señal (2 emisores + combinador AND) sin cable a sembrar, por arquetipo. */
export const CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<SignalNode<PlacedComponentInstanceId>>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter02SeededNodes(archetype)]),
) as Record<ShipArchetype, ReadonlyArray<SignalNode<PlacedComponentInstanceId>>>;
