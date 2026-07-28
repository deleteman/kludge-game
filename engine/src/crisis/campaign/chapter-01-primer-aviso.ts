import type { GridPosition } from "../../geometry/grid-position.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../../blueprint/blueprint.types.js";
import type { ComponentId } from "../../components/physical-component.types.js";
import type { SignalNode, SignalNodeId } from "../../signals/signal-node.types.js";
import type { SectionId } from "../../atmosphere/section.types.js";
import type { ShipArchetype } from "../../floorplan/floorplan.types.js";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";
import type { CrisisDefinition, CrisisDefinitionId } from "../crisis-definition.types.js";
import type { AtomicPartsStock } from "../../inventory/inventory.types.js";

/**
 * "Primer Aviso" (docs/Primeras_8_crisis.md, capítulo 1). Disparador: un
 * actuador de apertura (válvula menor) no responde a su sensor asociado y
 * bloquea el paso a una sección secundaria; nada crítico, sin amenaza real
 * (sin `timer` — "temporizador suave, sin amenaza de vidas", es la crisis que
 * enseña el loop, no que lo pone a prueba). Solución: desmontar la válvula
 * atascada, repararla o sustituirla por una pieza atómica equivalente (motor
 * pequeño, GDD 7.2), reinstalarla.
 *
 * Una campaña está ligada a UN arquetipo elegido al inicio (Fase 9.5): el
 * capítulo 1 se autora para los 4 (mismo patrón — misma válvula/motor
 * universales del catálogo, 7.2 — distinta posición/sección según el plano
 * real de cada nave), pero solo Exploración se verifica jugable de punta a
 * punta por ahora (única nave con tile art real, decisión del operador).
 *
 * `CHAPTER_01_ACTUATOR_INSTANCE_ID` + `CHAPTER_01_PARAMS_BY_ARCHETYPE` son el
 * contrato con `campaign-save-factory.ts` (10c): el estado inicial de la nave
 * de una campaña nueva debe colocar exactamente una instancia de
 * `valvula-simple` con `condition: "jammed"`, ese `instanceId`, en la
 * posición del arquetipo elegido — si no coinciden, el trigger/resolución de
 * este capítulo nunca se satisfacen. `CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE`
 * ya arma esa instancia lista para anexar al kit inicial, para no duplicar la
 * construcción del objeto en el llamador.
 */
export const CHAPTER_01_ACTUATOR_INSTANCE_ID =
  "capitulo-1-valvula-atascada" as PlacedComponentInstanceId;

/**
 * Sin stock de repuestos al arrancar la campaña (rework del flujo "sin stock →
 * inspeccionar → desarmar → reutilizar"): el jugador no puede instalar
 * `motor-pequeno` directo, tiene que desarmar un compuesto no crítico ya
 * presente en la nave (ver capa Tiled `semillas`,
 * `floorplan/instantiate-component-seeds.ts`) para obtenerlo. Objeto vacío
 * (no `undefined`): reemplaza por completo el stock generoso por defecto que
 * arma `campaign-save-factory.ts` para el resto del catálogo.
 */
// Subfase 11h: 1 unidad de Sensor de Presión + Pantalla LCD + Indicador LED
// (para poder instalarlos sin desarmar nada) y 1 junta hermética de repuesto
// (para reparar la fuga sembrada más abajo, ver `CHAPTER_01_SEAL_INSTANCE_ID`).
export const CHAPTER_01_INITIAL_ATOMIC_STOCK: AtomicPartsStock = {
  "sensor-presion": 1,
  "pantalla-lcd": 1,
  "indicador-led": 1,
  "junta-hermetica": 1,
} as AtomicPartsStock;

/**
 * 2º paso del capítulo (señal simple, `docs/Primeras_8_crisis.md`): un sensor
 * de proximidad (nodo `emitter`) y el panel de control de la compuerta (nodo
 * `receptor`) arrancan SIN cable entre ellos. El jugador los une con el modo
 * cableado. Son infraestructura FIJA: pertenecen a dos componentes sembrados
 * (`fotorreceptor`/`chip-circuito-generico`) que no se desmontan, así que los
 * nodos sobreviven al desmontaje de la válvula (`installInstance` no crea nodos
 * al instalar; `dismantleInstance` borra los del `ownerRef` desmontado).
 */
export const CHAPTER_01_SENSOR_INSTANCE_ID = "capitulo-1-sensor-proximidad" as PlacedComponentInstanceId;
export const CHAPTER_01_GATE_PANEL_INSTANCE_ID = "capitulo-1-panel-compuerta" as PlacedComponentInstanceId;
export const CHAPTER_01_SENSOR_NODE_ID = "capitulo-1-nodo-sensor" as SignalNodeId;
export const CHAPTER_01_GATE_NODE_ID = "capitulo-1-nodo-compuerta" as SignalNodeId;

/**
 * Fuga de presión (Subfase 11h, playtest de Indicador LED/Pantalla LCD/Sensor
 * de Presión): attrezzo PARALELO al puzzle de la válvula de arriba — no toca
 * `triggers`/`resolutions`/`consequence` de este capítulo, no es una crisis
 * formal todavía (decisión del operador: validar más adelante si merece
 * serlo). Una junta hermética sembrada rota (`condition: "jammed"`) drena
 * `soporte-vital` vía `seal-breach-pressure-sink.ts`; el jugador la repara
 * desmontándola e instalando la de repuesto (`CHAPTER_01_INITIAL_ATOMIC_STOCK`).
 */
export const CHAPTER_01_SEAL_INSTANCE_ID = "capitulo-1-junta-rota" as PlacedComponentInstanceId;
/** Drenaje mientras la junta esté rota — confirmado con el operador. */
export const CHAPTER_01_SEAL_DRAIN_RATE_KPA_PER_SECOND = 1.5;
/** Recuperación una vez sellada (pedido del operador tras el primer playtest) — misma magnitud que el drenaje. */
export const CHAPTER_01_SEAL_RECOVERY_RATE_KPA_PER_SECOND = 1.5;
/** Piezas aceptables para sellar la fuga — mismo criterio que la resolución de crisis (lista cerrada, sin tag genérico disponible). */
export const CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS: ReadonlyArray<ComponentId> = ["junta-hermetica" as ComponentId];

interface Chapter01ArchetypeParams {
  readonly anchorPosition: GridPosition;
  readonly blockedSectionId: SectionId;
  /** Sensor de proximidad (nodo emisor) — pasillo, cerca del acceso bloqueado. */
  readonly sensorPosition: GridPosition;
  /** Panel de control de la compuerta (nodo receptor) — junto a la válvula. */
  readonly gatePanelPosition: GridPosition;
  /** Junta hermética rota (Subfase 11h, fuga de presión) — junto a la válvula, sin solapar. */
  readonly sealPosition: GridPosition;
}

/**
 * Posición real (celda de grid, Fase 5) y sección bloqueada por arquetipo.
 * Exploración: autorada por el operador directamente en Tiled
 * (`floorplan/maps/nave-exploracion.json`, capa `anclajes`, objeto
 * `valvula-simple-1`) — cae en el borde de `soporte-vital`; `sensorPosition`
 * (pasillo-central) y `gatePanelPosition` (soporte-vital) son celdas
 * transitables verificadas contra la grilla del mapa. `sealPosition`
 * (Subfase 11h) también confirmada por el operador para exploración
 * (`{x:6,y:5}`, junto a la válvula sin solapar). Los otros 3 arquetipos:
 * posiciones de referencia (anclaje + offset), SIN verificación visual
 * (decisión del operador — solo Exploración se juega de punta a punta por ahora).
 */
const CHAPTER_01_PARAMS_BY_ARCHETYPE: Record<ShipArchetype, Chapter01ArchetypeParams> = {
  exploracion: {
    anchorPosition: { x: 6, y: 6 },
    blockedSectionId: "soporte-vital" as SectionId,
    sensorPosition: { x: 7, y: 9 },
    gatePanelPosition: { x: 7, y: 6 },
    sealPosition: { x: 6, y: 5 },
  },
  guerra: {
    anchorPosition: { x: 17, y: 6 },
    blockedSectionId: "enfermeria-basica" as SectionId,
    sensorPosition: { x: 17, y: 8 },
    gatePanelPosition: { x: 18, y: 6 },
    sealPosition: { x: 17, y: 5 },
  },
  investigacion: {
    anchorPosition: { x: 17, y: 11 },
    blockedSectionId: "hangar-drones" as SectionId,
    sensorPosition: { x: 17, y: 13 },
    gatePanelPosition: { x: 18, y: 11 },
    sealPosition: { x: 17, y: 10 },
  },
  medica: {
    anchorPosition: { x: 22, y: 5 },
    blockedSectionId: "laboratorio-muestras" as SectionId,
    sensorPosition: { x: 22, y: 7 },
    gatePanelPosition: { x: 23, y: 5 },
    sealPosition: { x: 22, y: 4 },
  },
};

/**
 * Clave compartida por los 4 arquetipos: el resumen es puramente mecánico
 * (disparador/solución esperada de `docs/Primeras_8_crisis.md`, que no varía
 * por nave) — no hace falta interpolar la sección bloqueada, y `t()` no
 * soporta placeholders todavía (`game/src/i18n/i18n.ts`).
 */
const CHAPTER_01_BRIEFING_KEY = "crisis.briefing.capitulo-1-primer-aviso";

function buildChapter01Definition(archetype: ShipArchetype): CrisisDefinition {
  const params = CHAPTER_01_PARAMS_BY_ARCHETYPE[archetype];
  return {
    id: `capitulo-1-primer-aviso-${archetype}` as CrisisDefinitionId,
    chapterOrder: 1,
    name: "Primer Aviso",
    briefingKey: CHAPTER_01_BRIEFING_KEY,
    archetypeHint: archetype,
    triggers: [
      {
        kind: "jammed-actuator-blocks-section",
        instanceId: CHAPTER_01_ACTUATOR_INSTANCE_ID,
        blockedSectionId: params.blockedSectionId,
      },
    ],
    // Las TRES resoluciones deben cumplirse (AND): reparar/sustituir la
    // válvula atascada (cualquier pieza con tag ACT, no una lista cerrada de
    // ids — principio de diseño #1) Y cablear el sensor de proximidad al
    // panel de la compuerta Y sellar la fuga de presión (Subfase 11h,
    // playtest — reutiliza `replacement-installed-connected`, MISMA regla que
    // ya usa la válvula: verifica posición + `condition: "ok"` + lista
    // cerrada de `componentDefinitionId` aceptables — acá cerrada porque no
    // existe ningún tag funcional que signifique "sella la atmósfera", ver
    // `seal-breach-pressure-sink.ts`).
    resolutions: [
      {
        kind: "functional-tag-installed",
        anchorPosition: params.anchorPosition,
        requiredTag: "ACT",
        objectiveKey: "crisis.objective.capitulo-1.compuerta",
      },
      {
        kind: "signal-nodes-wired",
        fromNodeId: CHAPTER_01_SENSOR_NODE_ID,
        toNodeId: CHAPTER_01_GATE_NODE_ID,
        objectiveKey: "crisis.objective.capitulo-1.sensor",
      },
      {
        kind: "replacement-installed-connected",
        anchorPosition: params.sealPosition,
        acceptableComponentDefinitionIds: ["junta-hermetica" as ComponentId],
        objectiveKey: "crisis.objective.capitulo-1.fuga",
      },
    ],
    // Sin `timer`: capítulo 1 no tiene amenaza real, solo introduce el loop.
    consequence: { kind: "time-loss", severity: "minor" },
  };
}

export const CHAPTER_01_BY_ARCHETYPE: Record<ShipArchetype, CrisisDefinition> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter01Definition(archetype)]),
) as Record<ShipArchetype, CrisisDefinition>;

function buildChapter01InitialComponent(archetype: ShipArchetype): PlacedComponentInstance {
  return {
    instanceId: CHAPTER_01_ACTUATOR_INSTANCE_ID,
    componentDefinitionId: "valvula-simple" as ComponentId,
    placement: {
      position: CHAPTER_01_PARAMS_BY_ARCHETYPE[archetype].anchorPosition,
      footprint: { width: 1, height: 1 },
      rotation: 0,
    },
    condition: "jammed",
  };
}

/** La instancia jammed a anexar al kit inicial de la nave (`campaign-save-factory.ts`), por arquetipo. */
export const CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE: Record<ShipArchetype, PlacedComponentInstance> =
  Object.fromEntries(
    SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter01InitialComponent(archetype)]),
  ) as Record<ShipArchetype, PlacedComponentInstance>;

/** Sensor + panel de compuerta (dueños de los nodos de señal) a sembrar además de la válvula, por arquetipo. */
function buildChapter01SeededComponents(archetype: ShipArchetype): ReadonlyArray<PlacedComponentInstance> {
  const params = CHAPTER_01_PARAMS_BY_ARCHETYPE[archetype];
  const cell = (position: GridPosition, id: PlacedComponentInstanceId, definitionId: string): PlacedComponentInstance => ({
    instanceId: id,
    componentDefinitionId: definitionId as ComponentId,
    placement: { position, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "ok",
  });
  return [
    cell(params.sensorPosition, CHAPTER_01_SENSOR_INSTANCE_ID, "fotorreceptor"),
    cell(params.gatePanelPosition, CHAPTER_01_GATE_PANEL_INSTANCE_ID, "chip-circuito-generico"),
    // Fuga de presión (Subfase 11h) — junta hermética sembrada ROTA, a
    // diferencia de las dos piezas de arriba (sembradas `ok`).
    {
      instanceId: CHAPTER_01_SEAL_INSTANCE_ID,
      componentDefinitionId: "junta-hermetica" as ComponentId,
      placement: { position: params.sealPosition, footprint: { width: 1, height: 1 }, rotation: 0 },
      condition: "jammed",
    },
  ];
}

/** Los dos nodos de señal (emisor del sensor, receptor de la compuerta), SIN cable entre ellos, por arquetipo. */
function buildChapter01SeededNodes(archetype: ShipArchetype): ReadonlyArray<SignalNode<PlacedComponentInstanceId>> {
  const params = CHAPTER_01_PARAMS_BY_ARCHETYPE[archetype];
  return [
    {
      id: CHAPTER_01_SENSOR_NODE_ID,
      role: "emitter",
      position: params.sensorPosition,
      ownerRef: CHAPTER_01_SENSOR_INSTANCE_ID,
    },
    {
      id: CHAPTER_01_GATE_NODE_ID,
      role: "receptor",
      position: params.gatePanelPosition,
      ownerRef: CHAPTER_01_GATE_PANEL_INSTANCE_ID,
    },
  ];
}

/** Componentes fijos (sensor + panel) a sembrar en el estado inicial, por arquetipo. */
export const CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE: Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>> =
  Object.fromEntries(
    SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter01SeededComponents(archetype)]),
  ) as Record<ShipArchetype, ReadonlyArray<PlacedComponentInstance>>;

/** Nodos de señal (emisor/receptor) sin cable a sembrar en el `signalGraph` inicial, por arquetipo. */
export const CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<SignalNode<PlacedComponentInstanceId>>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, buildChapter01SeededNodes(archetype)]),
) as Record<ShipArchetype, ReadonlyArray<SignalNode<PlacedComponentInstanceId>>>;

/** Sección que drena la fuga de presión (Subfase 11h) — misma que `blockedSectionId`, por arquetipo. */
export const CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE: Record<ShipArchetype, SectionId> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, CHAPTER_01_PARAMS_BY_ARCHETYPE[archetype].blockedSectionId]),
) as Record<ShipArchetype, SectionId>;

/** Posición de la junta hermética de la fuga (Subfase 11h) — identidad que usa el sumidero de presión, por arquetipo. */
export const CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE: Record<ShipArchetype, GridPosition> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [archetype, CHAPTER_01_PARAMS_BY_ARCHETYPE[archetype].sealPosition]),
) as Record<ShipArchetype, GridPosition>;

// --- Compatibilidad con 10a/10b (Exploración es el arquetipo de referencia) ---
export const CHAPTER_01_PRIMER_AVISO = CHAPTER_01_BY_ARCHETYPE.exploracion;
export const CHAPTER_01_ANCHOR_POSITION = CHAPTER_01_PARAMS_BY_ARCHETYPE.exploracion.anchorPosition;
export const CHAPTER_01_BLOCKED_SECTION_ID = CHAPTER_01_PARAMS_BY_ARCHETYPE.exploracion.blockedSectionId;
