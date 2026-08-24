import Phaser from "phaser";
import {
  ATOMIC_COMPONENT_CATALOG,
  GRID_CELL_SIZE_PX,
  advanceChapterProgress,
  elementStockOf,
  resolveLcdDisplayValue,
  sectionContainingCell,
} from "engine";
import type { SignalEdgeId } from "engine";
import type {
  BarkEventType,
  ChemicalSubstanceId,
  CoreLoopDomainEvent,
  CrewActorId,
  CrewDomainEvent,
  CrewTask,
  CrewTaskId,
  EnemyActorId,
  EnemyDomainEvent,
  GridPosition,
  KineticDomainEvent,
  PhysicalComponentDefinition,
  PlacedComponentInstanceId,
  PlacedFootprint,
  ScriptedRoute,
  SectionId,
  TaskCompletedEvent,
  TaskType,
} from "engine";

import { t } from "../i18n/i18n.js";
import {
  drawEnergyLayer,
  drawStructuralLayer,
  FLOORPLAN_LAYER_IDS,
  renderFloorplan,
  sectionCentroidCell,
  sectionCentroidPx,
  type FloorplanLayerId,
  type FloorplanRender,
  drawConduitLine,
  drawConduitMarker,
} from "../render/floorplan-renderer.js";
import type { ConduitPath } from "../render/conduit-path.js";
import { computeConduitRoute, computeSignalWireRoute } from "../render/conduit-path.js";
import { createConduitPathFlowEffect, type ConduitPathFlowState } from "../particles/effects/conduit-flow-effect.js";
import {
  computeSectionSignalActivity,
  conduitFlowIntensity,
  signalWireFlowIntensity,
} from "../mission/conduit-flow-heuristics.js";
import { renderMissionOverlay } from "../render/mission-overlay-renderer.js";
import { renderProjectileTokens } from "../render/projectile-renderer.js";
import { renderTrajectoryGhost } from "../render/projectile-trajectory-renderer.js";
import tilesetUrl from "../../assets/sprites/tiles/tileset-nave.png";
import { SHIP_MAP_URLS, TILESET_IMAGE_KEY } from "../render/tile-layer-registry.js";
import { PARTICLE_TEXTURE_URLS } from "../particles/particle-texture-registry.js";
import { preloadComponentSprites } from "../render/component-sprite-registry.js";
import { preloadCrewPortraits } from "../render/crew-portrait-registry.js";
import {
  preloadCrewSprite,
  ensureCrewTintTexture,
  faceX,
  CREW_SPRITE_TINT_TEXTURE,
  CREW_TOKEN_HEIGHT_PX,
} from "../render/crew-sprite.js";
import { dismantleEffect, installEffect } from "../particles/effects/fabrication-effect.js";
import { clickReaction } from "../ui/ui-effects.js";
import { fireEventEffect } from "../particles/effect-registry.js";
import { DEV_EVENT_SAMPLES } from "./dev-event-samples.js";
import { firePouredSubstance } from "../particles/effects/salvage-hazard-effect.js";
import { fireEventSound } from "../audio/phenomenon-sound-registry.js";
import { AUDIO_KEYS, preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { pickSoundKey } from "../audio/audio-utils.js";
import { createGasLeakSound, type GasLeakSoundState } from "../audio/effects/gas-leak-sound.js";
import type { StateDrivenSound } from "../audio/audio-effect.types.js";
import { fireEnvironmentalDamage } from "../particles/effects/environmental-damage-effect.js";
import {
  createFreezingEffect,
  createGasLeakEffect,
  createHeatVaporEffect,
} from "../particles/effects/atmosphere-state-effects.js";
import type { GasCloudState } from "../particles/effects/atmosphere-state-effects.js";
import { CLOUD_TINT } from "../particles/effects/hazard-effect.js";
import { createOverloadedConductorEffect } from "../particles/effects/overloaded-conductor-effect.js";
import type { OverloadedConductorState } from "../particles/effects/overloaded-conductor-effect.js";
import { createDynamicLight } from "../particles/effects/dynamic-light.js";
import type {
  EventEffectOptions,
  LightHook,
  StateDrivenEffect,
} from "../particles/particle-effect.types.js";
import { RENDER_DEPTH } from "../render/render-depths.js";
import {
  CHEMICAL_TAG_COLORS,
  CONDUIT_LAYER_INACTIVE_ALPHA,
  CORE_LOOP_MODE_COLORS,
  CREW_TOKEN_COLORS,
  HEADER_COLOR,
  HOVER_HIGHLIGHT_COLOR,
  LABEL_COLOR,
  LED_ACTIVE_TINT,
  LED_INACTIVE_TINT,
  LED_LIGHT_RADIUS_PX,
  LED_LIGHT_INTENSITY,
  OBJECTIVE_DONE_COLOR,
  screenAlertFlickerAlpha,
  SCREEN_ALERT_TINT,
  chemicalSubstanceColor,
  CRISIS_FATAL_COLOR,
  CRISIS_SAFE_COLOR,
  SEALED_VALVE_COLOR,
  sectionScarFlickerAlpha,
  SELECTED_CELL_COLOR,
  TIMER_TEXT_COLORS,
  UNPOWERED_SECTION_LIGHT_COLOR,
  UNPOWERED_SECTION_LIGHT_RADIUS_PX,
  UNPOWERED_SECTION_TINT,
  unpoweredSectionLightIntensity,
  WIRE_HIGHLIGHT_COLOR,
} from "../render/palette.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { buildCrisisOutcome, setPendingCrisisOutcome } from "../meta/crisis-outcome.js";
import { saveCampaignSave, loadSettings } from "../meta/save-adapter.js";
import { MissionRuntime } from "../mission/mission-runtime.js";
import {
  MissionInteractionController,
  STRUCTURAL_RESISTANCE_LEVEL_KEY,
} from "../mission/mission-interaction-controller.js";
import { renderMissionTooltip } from "../ui/widgets/mission-tooltip.js";
import { setPendingMissionWorkbenchContext } from "./creative-workbench-scene.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import { hopMove, CREW_SIGNATURE } from "../crew/hop-movement.js";
import type { HopCadence, HopTarget, JumpSignature } from "../crew/hop-movement.js";
import {
  createEnemyToken,
  destroyEnemyToken,
  enemyJumpSignature,
  flashEnemyAttack,
  hopEnemyToken,
  type EnemyToken,
} from "../enemies/enemy-tokens.js";
import { cadenceForCrewHp } from "../crew/crew-hp-to-cadence.js";
import { BarkController } from "../crew/bark-controller.js";
import { findPath } from "../crew/floorplan-pathfinding.js";
import { extractWalkableGrid, type WalkableGrid } from "../render/walkable-grid.js";
import { extractOccluderGrid } from "../render/shadows/occluder-edges.js";
import { DynamicShadowLayer, DYNAMIC_SHADOW_DARKNESS_ALPHA, DYNAMIC_SHADOW_COLOR } from "../render/shadows/dynamic-shadows.js";
import { loadAuthoredLights } from "../render/shadows/authored-lights.js";
import { actorLightLevel, NEUTRAL_TINT, shade } from "../render/shadows/light-shading.js";
import { rectEdges } from "../render/shadows/occluder-edges.js";
import { effectiveFootprintExtent, occupiedCells } from "engine";
import type { Segment } from "../render/shadows/visibility-polygon.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyPanel } from "../ui/widgets/kenney-panel.js";
import { renderPowerAllocationSlider, type PowerAllocationSliderHandle } from "../ui/widgets/power-allocation-slider.js";
import { renderPowerPriorityList } from "../ui/widgets/power-priority-list.js";
import { createScrollableText } from "../ui/widgets/scrollable-text.js";
import { CustomCursor } from "../ui/custom-cursor.js";
import { registerCrtPipeline, type CrtPostFxPipeline } from "../render/crt-pipeline.js";
import { getCrtIntensity, getFlickerIntensity, hydrateCrtSettings } from "../render/crt-settings.js";
import { getShadowIntensity, hydrateShadowSettings } from "../render/shadows/shadow-settings.js";
import { firePhosphorStatic } from "../particles/effects/phosphor-static-effect.js";
import { NotificationCenter } from "../ui/widgets/notification-center.js";
import { renderCrewQueue, type CrewQueueHandle, type UnifiedQueueTask } from "../ui/widgets/crew-queue-panel.js";
import { renderCrewStrip, type CrewStripHandle, type CrewPortraitObject } from "../ui/widgets/crew-strip.js";
import { renderMissionBriefingModal } from "../ui/widgets/mission-briefing-modal.js";
import { renderFloorplanLayerTogglePanel } from "../ui/widgets/floorplan-layer-toggle-panel.js";
import { renderShipStatusHud } from "../ui/widgets/ship-status-hud.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

const CELL = GRID_CELL_SIZE_PX;
const HEADER_HEIGHT = 40;
// Separados con margen explícito (bug corregido: antes se derivaban de la
// misma constante y terminaban superpuestos, "cableado" tapando a "ejecutar").
const LAYERS_BUTTON_X = 470;
const WORKBENCH_BUTTON_X = 610;
const OBJECTIVES_BUTTON_X = 770;
const WIRE_MODE_BUTTON_X = 980;
const PLAY_PAUSE_BUTTON_X = 1190;
/**
 * Panel flotante de toggles de capa (Fase 11f): la fila de botones del header
 * ya está saturada (610-1260), así que "Capas" abre/cierra un panel angosto
 * cerca del borde superior, mismo criterio que `toggleObjectivesPanel` pero
 * sin competir por el mismo espacio horizontal.
 */
const LAYER_PANEL_CENTER_X = 640;
const LAYER_PANEL_CENTER_Y = 118;
// Ancho fijo pensado para 5 capas (700px); la Fase 13b sumó "energia" como
// 6ª capa y el panel quedó angosto (el listado de botones se salía por los
// bordes, playtest post-13b) — recalculado con margen sobre el ancho real de
// fila (`FLOORPLAN_LAYER_IDS.length * 126 + (length-1) * 6` = 786px con 6).
const LAYER_PANEL_WIDTH = 830;
const LAYER_PANEL_HEIGHT = 74;

/**
 * Caja del cluster de controles de energía por sección (slider + botón de
 * prioridad), relativa al centroide de la sección. Fuente ÚNICA de la que se
 * derivan tanto el panel de fondo (`createKenneyPanel`) como
 * `energyControlWorldBounds` (la zona que impide que el click atraviese al
 * mapa) — antes eran literales sueltos que podían desincronizarse.
 */
// Ancho 140 (ronda 8): con 120 el mensaje "Sin energía libre" no entraba ni al
// tamaño mínimo de fuente y quedaba microscópico. El resto del contenido
// (track de 90px, botón de 90px) no depende de este ancho.
const ENERGY_CONTROL_BOX = { offsetX: 0, offsetY: -1, width: 140, height: 90, padding: 12 } as const;

/**
 * Sombra dura del cluster de energía (ronda 7): un segundo panel oscuro
 * desplazado, sin blur ni shaders — hay un cluster por sección (~11 en
 * Exploración), así que un `postFX.addShadow` por cuadro costaría un render
 * target cada uno. El borde nítido además va con el pixel art del resto.
 */
const ENERGY_CONTROL_SHADOW = { offsetX: 3, offsetY: 4, alpha: 0.45 } as const;

// Franja lateral fija (ajuste post-playtest): NUNCA se mueve, vive en la
// cámara de HUD. El mapa se panea por debajo, en la cámara de mundo recortada
// (`cameras.main`, ver `create()`) — sin esto, panear no serviría de nada: si
// el viewport del mapa fuera tan ancho como el canvas completo, no habría
// nada oculto que revelar arrastrando (el panel lo taparía igual a cualquier
// scroll, porque el mundo entero ya cabría en el viewport).
const SIDE_PANEL_X = 960;
const SIDE_PANEL_WIDTH = 320;
const SIDE_PANEL_Y = HEADER_HEIGHT + 8;
/**
 * Franja de objetivos SIEMPRE visible (playtest: antes solo se veía detrás de
 * un botón, y no había ninguna señal de progreso al completar uno). Solo
 * bullets — el briefing explicativo se queda en el modal del botón
 * "Objetivos" (`renderObjectivesPanel`). Empuja el resto de la columna hacia
 * abajo la misma cantidad.
 */
const OBJECTIVES_STRIP_HEIGHT = 72;
const OBJECTIVES_STRIP_Y = SIDE_PANEL_Y;
const QUEUE_PANEL_HEIGHT = 220;
/**
 * HUD de estado permanente de la nave (Subfase 11g) — ocupa el espacio que
 * antes tenía el panel de acciones DOCKED (Fase 10d). El panel de acciones
 * dejó de vivir en la columna lateral: ahora es un panel FLOTANTE en espacio
 * de mundo/pantalla, posicionado cada frame por `updateActionPanelAnchor`
 * (ver `update()`), con su propio tamaño fijo más chico (`ACTION_PANEL_*`).
 */
const SHIP_STATUS_HUD_Y = SIDE_PANEL_Y + OBJECTIVES_STRIP_HEIGHT + QUEUE_PANEL_HEIGHT + 16;
const SHIP_STATUS_HUD_HEIGHT = 170;
/** Cuánto tiempo se sostiene el overlay de alerta global tras un `overload` violento (fire/explosion) — el evento en sí es puntual, la alarma visual dura más para que se note (Fase 12a). */
const VIOLENT_ALERT_HOLD_SECONDS = 4;
const ACTION_PANEL_WIDTH = 260;
const ACTION_PANEL_HEIGHT = 220;
/** Offset del panel flotante respecto al punto de anclaje (celda seleccionada o botón "Sustancias"), para no taparlo con el cursor. */
const ACTION_PANEL_ANCHOR_OFFSET_X = 20;
const ACTION_PANEL_ANCHOR_OFFSET_Y = 16;
/**
 * Posición fija del panel de sustancias (Subfase 11g, fix post-playtest):
 * al abrirse desde el botón "Sustancias" del HUD no hay ninguna celda de
 * mundo asociada, así que NO pasa por el offset/clamp genérico de
 * `updateActionPanelAnchor` (ese clamp, pensado para seguir una celda cerca
 * del borde del mapa, lo empujaba a la esquina inferior derecha del
 * viewport — mitad tapado por la tira de tripulación). Esquina superior
 * derecha del área de mapa: siempre visible, nunca se superpone a la
 * columna lateral ni a la tira de tripulación.
 */
const SUBSTANCES_PANEL_POSITION = { x: SIDE_PANEL_X - 10 - ACTION_PANEL_WIDTH - 30, y: HEADER_HEIGHT + 20 };
const MAP_VIEWPORT_WIDTH = SIDE_PANEL_X - 10;
// La tira horizontal de tripulación (playtest #16b) vive bajo el mapa, solo en
// la columna del mapa (no cruza el panel derecho). El viewport del mapa se
// acorta en alto para dejarle sitio.
const CREW_STRIP_HEIGHT = 118;
const MAP_VIEWPORT_HEIGHT = 720 - HEADER_HEIGHT - CREW_STRIP_HEIGHT;
const CREW_STRIP_Y = HEADER_HEIGHT + MAP_VIEWPORT_HEIGHT;
/**
 * Techo del panel de acciones (13e ronda 3). Se acota al alto del VIEWPORT DEL
 * MAPA, no al de la pantalla: por encima está el header y por debajo la tira de
 * tripulación, y el panel invadiendo esa franja es lo que lo hacía difícil de
 * clickear. Pasado el techo, el panel hace scroll interno.
 */
const ACTION_PANEL_MAX_HEIGHT = MAP_VIEWPORT_HEIGHT - 16;
/** Caja de la cola unificada (esquina sup-izq y alto) — reutilizada por el hit-test/scroll. */
const QUEUE_BOX_X = SIDE_PANEL_X - 10;
const QUEUE_BOX_Y = OBJECTIVES_STRIP_Y + OBJECTIVES_STRIP_HEIGHT;

const DRAG_THRESHOLD_PX = 6;

// Zoom del mapa con la rueda (playtest #13): `cameras.main` es la cámara de
// mundo. El máximo es para inspección cercana; el mínimo se calcula por partida
// ("encajar todo el plano", ver `create()`), no es constante. `ZOOM_STEP` es el
// factor multiplicativo por paso de rueda.
const MAP_MAX_ZOOM = 3;
const ZOOM_STEP = 1.12;

/**
 * Plano interactivo de una misión en curso (Fase 10d, con ajuste post-
 * playtest del operador). Orquesta `MissionRuntime` (motor: scheduler +
 * crisis + core loop) con Phaser: DOS cámaras — `cameras.main` (recortada al
 * área de mapa vía `setViewport()`, paneable por arrastre, con límites al
 * tamaño real de la nave; se pinta SIEMPRE primero por ser la cámara
 * automática de la escena) y `hudCamera` (canvas completo, fija, dueña de
 * TODO el chrome de HUD; agregada DESPUÉS, así que se pinta SIEMPRE último y
 * gana la composición sobre el mundo por construcción, no por coincidencia
 * de posición — ver el comentario del campo `hudCamera`). Cada cámara ignora
 * los objetos de la otra (`camera.ignore(...)`) — es el patrón estándar de
 * Phaser para "mundo recortado/paneable + HUD de pantalla completa" con una
 * sola escena. La lógica de "qué gesto de click significa qué" vive en
 * `MissionInteractionController` (CLAUDE.md: ~200-300 líneas es señal de
 * alerta para dividir un archivo). No hay elección libre de nave acá — la
 * fija la campaña activa.
 */
export class FloorplanScene extends Phaser.Scene {
  private mission!: MissionRuntime;
  private interaction!: MissionInteractionController;
  private nameByComponentId = new Map<string, string>();
  /** Grilla transitable para pathing de tripulación; `undefined` si la nave no tiene tile layers todavía (GDD §17). */
  private walkableGrid?: WalkableGrid;
  /**
   * `cameras.main` (creada automáticamente, siempre pintada PRIMERO) es la
   * cámara de MUNDO — recortada al área de mapa vía `setViewport()`, en vez
   * de crearle una cámara adicional. `hudCamera` se agrega DESPUÉS
   * (`this.cameras.add(...)`), por lo que Phaser la pinta SIEMPRE última —
   * el HUD gana la composición por construcción, no por coincidencia
   * geométrica (bug corregido: antes `worldCamera` era la cámara agregada y
   * pintaba encima de `cameras.main`/HUD, tapando el modal de briefing).
   */
  private hudCamera!: Phaser.Cameras.Scene2D.Camera;

  /**
   * Instancias del pipeline CRT (una por cámara: mundo + HUD), sembradas en
   * `create()`. La escena les fija `failure`/`time`/`crtIntensity` cada frame
   * (ver el driver en `update()`). Vacío bajo Canvas (el pipeline es no-op ahí).
   */
  private crtPipelines: CrtPostFxPipeline[] = [];
  /** Rampa suavizada [0,1] de la capa "System Failure" del CRT — sube en crítico/crisis, baja al normalizarse. */
  private crtFailureLevel = 0;

  private overlayContainer?: Phaser.GameObjects.Container;
  /** Grafo de señal (nodos + cables) del overlay — capa `señales` del HUD (Fase 11f.3), atenuado por su toggle. */
  private signalGraphics?: Phaser.GameObjects.Graphics;
  /** Sprites de Indicador LED por instancia (Subfase 11h) — retinte por tick, ver `updateLedIndicators`. */
  private ledIndicators: ReadonlyMap<PlacedComponentInstanceId, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = new Map();
  /** Luz emitida por cada LED activo (Fase 12d) — creada cuando enciende, destruida cuando apaga; participa de las sombras vía `registerLight`. */
  private readonly ledLights = new Map<PlacedComponentInstanceId, Phaser.GameObjects.PointLight>();
  /** Texto de Pantalla LCD por instancia (Subfase 11h) — actualizado con throttle, ver `updateLcdDisplays`. */
  private lcdDisplays: ReadonlyMap<PlacedComponentInstanceId, Phaser.GameObjects.Text> = new Map();
  /** Sprites reales por instancia (13e ronda 8) — permite tintar la pieza misma al resaltar un candidato de trasvase, ver `updateTransferMode`. */
  private componentSprites: ReadonlyMap<PlacedComponentInstanceId, ReadonlyArray<Phaser.GameObjects.Image>> = new Map();
  /** Throttle de `updateLcdDisplays` (Subfase 11h, doc fuente §2: 250-500ms, no por frame). */
  private lcdRedrawAccumulatorMs = 0;
  /** Tokens de proyectiles ferromagnéticos en vuelo (Fase 11a.3) — redibujado cada frame en ejecución. */
  private projectileContainer?: Phaser.GameObjects.Container;
  /**
   * `ref`s de proyectil conocidos en el último frame (Fase 12f, fix post-playtest): la promoción de una
   * pieza ferromagnética suelta (`LooseFerromagneticPromoter`) pasa dentro del mismo tick que completa la
   * tarea de instalación, DESPUÉS de que `redrawOverlay()` ya la dibujó como componente fijo — nada
   * volvía a redibujar el overlay tras esa promoción silenciosa, así que quedaba un sprite "fantasma" del
   * tamaño de la celda pegado encima del token real (pequeño) del proyectil. Comparar este Set contra
   * `mission.projectiles.all` cada frame de ejecución detecta la promoción y dispara un `redrawOverlay()`.
   */
  private knownProjectileRefs = new Set<string>();
  /** Trayectoria fantasma en pausa táctica (Fase 11a.3, ASA 3) — calculada una vez al entrar en pausa, destruida al reanudar. */
  private trajectoryGhostContainer?: Phaser.GameObjects.Container;
  /** Cola unificada de tareas (playtest #16b) — objetos planos + hit-test a nivel de escena. */
  private queuePanel?: CrewQueueHandle;
  private queueScrollY = 0;
  /** Tira horizontal de tripulantes bajo el mapa — selección por hit-test a nivel de escena. */
  private crewStrip?: CrewStripHandle;
  /** HUD de estado permanente de la nave (Subfase 11g) — redibujado solo cuando el snapshot agregado cambia (`shipStatusRedrawKey`). */
  private shipStatusHudContainer?: Phaser.GameObjects.Container;
  private shipStatusRedrawKey?: string;
  /**
   * Bounds de pantalla del panel de acciones flotante (Subfase 11g), o
   * `undefined` sin panel montado — a diferencia del panel docked de Fase
   * 10d (que vivía siempre dentro de la columna lateral y quedaba cubierto
   * por `isOverFixedUi` sin esfuerzo extra), este puede flotar SOBRE el
   * mapa, así que `isOverFixedUi` necesita conocer sus bounds actuales para
   * no procesar un click en sus botones como un click de mapa a la vez.
   */
  private actionPanelBounds?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  private problemMarker?: Phaser.GameObjects.Arc;
  private briefingContainer?: Phaser.GameObjects.Container;
  private briefingOpen = false;
  /** Evita transicionar dos veces a la pantalla de resultado (el evento `crisis-resolved` es terminal, pero es barato blindarlo). */
  private crisisResultShown = false;

  /** Barks de personalidad (GDD 6.7.1, Fase 10e): el motor decide el evento, acá se elige la línea y se muestra. */
  private barks!: BarkController;
  /** Los barks de `crisis-start` se disparan una sola vez por misión. */
  private barksCrisisStartFired = false;

  private headerText?: Phaser.GameObjects.Text;
  /** Cuenta regresiva del temporizador de crisis (cap. 2), oculto si la crisis no tiene timer. */
  private timerText?: Phaser.GameObjects.Text;
  /** Píldora de fondo del temporizador, para legibilidad sobre cualquier tile. */
  private timerPill?: Phaser.GameObjects.Rectangle;
  private statusText?: Phaser.GameObjects.Text;
  private playPauseButton?: Phaser.GameObjects.GameObject;
  private wireModeButton?: Phaser.GameObjects.GameObject;
  /**
   * Modo de selección espacial de destino de trasvase (13e ronda 7, estilo
   * SimCity): botón de cancelar (mismo casillero de cabecera que
   * `wireModeButton` — son modos mutuamente excluyentes), oscurecido del
   * plano, resaltados por reservorio candidato y el canal origen↔hover.
   */
  private transferModeButton?: Phaser.GameObjects.GameObject;
  private transferDimOverlay?: Phaser.GameObjects.Rectangle;
  /**
   * Objetos del resaltado de trasvase: el contorno de cada candidato y la COPIA
   * top-level de su sprite (12d.6). Se destruyen todos juntos al reconstruir el
   * modo, así que van en un solo array de `GameObject`.
   */
  private transferHighlights: Phaser.GameObjects.GameObject[] = [];
  private transferChannelLine?: Phaser.GameObjects.Graphics;
  /**
   * Snapshot COMPLETO de `activeFloorplanLayers` antes de entrar al modo de
   * transferencia (ronda 9: antes solo se guardaba el booleano de `fluido`,
   * así que las demás capas — señal, ventilación, eléctrico — se quedaban
   * activas y sus tokens de flujo seguían moviéndose por encima del
   * oscurecido). Se restaura completo al salir.
   */
  private transferModePriorActiveLayers?: ReadonlySet<FloorplanLayerId>;
  /**
   * Clon top-level de la capa `fluido` durante el modo de trasvase (ronda 8,
   * fix del bug de depth #5): `conduitLayers.fluido` vive dentro del container
   * `base` (depth `background`, aplanado — ver `FloorplanRender`), así que
   * jamás iba a verse por encima de `transferDimOverlay`. Se dibuja un
   * `Graphics` aparte, top-level, solo con los conductos `fluido`, y se oculta
   * el original mientras dure el modo.
   */
  private transferFluidoHighlightLayer?: Phaser.GameObjects.Graphics;
  private objectivesButton?: Phaser.GameObjects.GameObject;
  /**
   * Banco de trabajo del plano (Subfase 13e): ya no es un botón del header —
   * se conserva la referencia solo como DESTINO de la animación de recolección
   * de elementos (12c.5), que sigue teniendo sentido apuntando al aparato real.
   */
  private workbenchButton?: Phaser.GameObjects.GameObject;
  /** Panel de objetivos (briefing) — modal informativo togglead por su botón (playtest #15). */
  private objectivesPanel?: Phaser.GameObjects.Container;
  private objectivesOpen = false;
  /** Franja compacta de bullets, SIEMPRE visible en la columna lateral (playtest de Fase 11d). */
  private objectivesStrip?: Phaser.GameObjects.Container;
  /** Claves de los objetivos ya cumplidos la última vez que se redibujó la franja — para flashear solo los que ACABAN de completarse. */
  private objectivesDoneKeys = new Set<string>();

  /** Toggle de capas del plano (Fase 11f, GDD §10) — todas activas por defecto. */
  private activeFloorplanLayers = new Set<FloorplanLayerId>(FLOORPLAN_LAYER_IDS);
  private layersButton?: Phaser.GameObjects.GameObject;
  private layerTogglePanel?: Phaser.GameObjects.Container;
  private layerTogglePanelOpen = false;
  /** Dial +1/-1 por sección (Fase 13b) — visible solo con la capa "energia" activa y en pausa. */
  private readonly energyDialContainers = new Map<
    SectionId,
    { readonly outer: Phaser.GameObjects.Container; readonly slider: PowerAllocationSliderHandle }
  >();
  /**
   * Bounds de MUNDO de los controles de energía flotantes (fix post-playtest
   * ronda 2, mismo criterio que `actionPanelBounds`): sin esto, el pointerup
   * de un click/arrastre sobre el slider/botón de prioridad TAMBIÉN dispara
   * `handleMapClick` sobre la celda de mundo detrás — Phaser no tiene
   * `stopPropagation` automático entre un listener de objeto interactivo y
   * los listeners globales de `scene.input`.
   */
  private energyControlWorldBounds: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }> = [];
  /** Inspector de prioridad de energía de UNA sección (Fase 13b) — abierto a la vez, como los demás modales. */
  private energyPriorityPanel?: Phaser.GameObjects.Container;
  private energyPriorityPanelSectionId?: SectionId;
  private floorplanRender!: FloorplanRender;
  /** Efecto de flujo animado por conducto (Fase 11f), clave `${a}-${b}-${kind}` — no hay id propio en `ConduitConnection`. */
  private readonly conduitFlowEffects = new Map<string, StateDrivenEffect<ConduitPathFlowState>>();
  /** Efecto de flujo animado por CABLE de señal (Fase 11f.6), clave `edge.id` — ver `syncSignalWireFlowEffects`. */
  private readonly signalWireFlowEffects = new Map<SignalEdgeId, StateDrivenEffect<ConduitPathFlowState>>();

  private readonly crewTokens = new Map<
    CrewActorId,
    {
      readonly dot: Phaser.GameObjects.Image;
      readonly label: Phaser.GameObjects.Text;
      readonly workingRing: Phaser.GameObjects.Arc;
      /** Anillo estático que marca al tripulante SELECCIONADO en el panel (playtest #11) — distinto del `workingRing` pulsante. */
      readonly selectionRing: Phaser.GameObjects.Arc;
    }
  >();

  /**
   * Tweens de salto (`hopMove`) de tripulación/enemigos actualmente en vuelo
   * (Fase 12f, Obs 3). Sin este tracking los tokens seguían animándose en modo
   * `planning` — mismo criterio que 11f.7 aplicó al flujo de conductos, pero
   * ahí bastaba con no redibujar; acá el tween ya está corriendo y hay que
   * pausarlo/reanudarlo explícitamente. Se puebla en `chainHops`/
   * `stepAsideCrewToken`/el fallback `hopEnemyToken` y se limpia solo al
   * completar (`tween.once("complete", ...)`), nunca por el chequeo de modo.
   */
  private readonly activeHopTweens = new Set<Phaser.Tweens.Tween>();

  /** Tokens visuales de enemigo (Fase 11d.3) — sin contenido de capítulo todavía (11d.4), así que arranca vacío en misión real. */
  private readonly enemyTokens = new Map<EnemyActorId, EnemyToken>();

  /** Cursor contextual reactivo (12c.3) — cambia el puntero según la acción válida bajo el ratón. */
  private customCursor?: CustomCursor;

  /** Sistema de notificaciones transitorias (12c.7) — avisos legibles arriba-centro del mapa. */
  private notifications?: NotificationCenter;
  /** Evita notificar objetivos ya completos en el primer render de la tira. */
  private objectivesNotifyReady = false;

  /**
   * Overlays de parpadeo tóxico sobre la tarjeta del tripulante en gas TOX/CORR
   * (12c.2). Persistentes a nivel de escena (no dentro del widget, que se
   * reconstruye a cada rato) para que el flicker no se corte en cada redibujo
   * de la tira.
   */
  private readonly crewToxicOverlays = new Map<CrewActorId, Phaser.GameObjects.Rectangle>();

  /** Efectos state-driven de atmósfera por sección (Fase 11b) — un trío por sección, arrancado una vez en `create()`. */
  private readonly sectionAtmosphereEffects = new Map<
    SectionId,
    {
      readonly gasLeak: StateDrivenEffect<GasCloudState>;
      readonly gasLeakSound: StateDrivenSound<GasLeakSoundState>;
      readonly freezing: StateDrivenEffect<{ readonly temperatureCelsius: number }>;
      readonly heatVapor: StateDrivenEffect<{ readonly temperatureCelsius: number }>;
    }
  >();
  /** Tinte parpadeante de sección sin energía (Fase 11b, cicatriz) — redibujado cada frame, sigue parpadeando en pausa. */
  private unpoweredSectionOverlay?: Phaser.GameObjects.Graphics;
  /** Luz ambiental de sección sin energía (Fase 12a, corrección post-playtest) — creada una vez por sección, nunca removida. */
  private readonly unpoweredSectionLights = new Map<SectionId, Phaser.GameObjects.PointLight>();
  /** Capa de sombras dinámicas con oclusión real (Fase 12d) — repintada cada frame en `update()`. */
  private shadowLayer?: DynamicShadowLayer;
  /** Chispas + luz de conductor sobrecargado (Fase 12a, cicatriz `overloadedRefs`) — creado una vez por instancia, nunca removido (consecuencias permanentes). */
  private readonly overloadedConductorEffects = new Map<
    PlacedComponentInstanceId,
    StateDrivenEffect<OverloadedConductorState>
  >();
  /**
   * Overlay de alerta de pantalla completa. Fase 12a lo hizo un rectángulo
   * plano; 12c.4 lo cambia por una VIÑETA (bordes oscurecidos, centro
   * transparente) tintada de rojo, para un aviso menos invasivo que un tinte
   * uniforme. Objeto de HUD (`hudCamera`, fijo), su alpha pulsa cada frame.
   */
  private screenAlertOverlay?: Phaser.GameObjects.Image;
  /** Instante (segundos de escena) hasta el que un `overload` violento fuerza el overlay de alerta, ver `VIOLENT_ALERT_HOLD_SECONDS`. */
  private violentAlertUntilSeconds = -Infinity;
  /**
   * Instante (segundos de escena) hasta el que el INICIO de la crisis fuerza el overlay de alerta (Fase
   * 12a, corrección post-playtest) — campo separado de `violentAlertUntilSeconds`: semánticamente es
   * "la crisis acaba de empezar", no "hubo un evento violento", aunque comparten el mismo
   * `VIOLENT_ALERT_HOLD_SECONDS` de sostenido.
   */
  private crisisStartAlertUntilSeconds = -Infinity;

  private dragOrigin?: { readonly x: number; readonly y: number; readonly scrollX: number; readonly scrollY: number };
  private dragDistance = 0;

  /** Zoom mínimo (encajar todo el plano en el viewport), calculado en `create()` según el tamaño de la nave. */
  private minZoom = 1;

  private hoverHighlight?: Phaser.GameObjects.Rectangle;
  private hoverCell?: GridPosition;
  /**
   * Resaltado persistente de la selección (bug 6): un rectángulo por celda
   * ocupada, no uno solo — con picker de instalación abierto marca el
   * footprint completo de la opción enfocada (`installPickerHighlightCells`),
   * así no tapa overlaps sin querer (playtest, Subfase 11h). Sin picker, cae a
   * una única celda (`selectedCell`), mismo comportamiento de siempre.
   */
  private selectedHighlightCells: Phaser.GameObjects.Rectangle[] = [];
  /** Tooltip con el nombre de la pieza/zona bajo el cursor (playtest #14); objeto de HUD, sigue al puntero en coords de pantalla. */
  private tooltip?: Phaser.GameObjects.Container;
  /** Celda cuyo contenido ya está pintado en `tooltip` — evita redibujar en cada `pointermove` dentro de la misma celda. */
  private tooltipCell?: GridPosition;
  /** Anillos que marcan los nodos clickeables (y el origen elegido) mientras el modo cableado está activo (playtest #15). */
  private wireNodeHighlights: Phaser.GameObjects.Arc[] = [];

  /** Acumulador para redibujar el panel de cola con throttle durante la ejecución (barra de progreso/cuenta regresiva en vivo). */
  private queueRedrawAccumulatorMs = 0;

  private mapBorder?: Phaser.GameObjects.Rectangle;
  private modeBadge?: Phaser.GameObjects.Container;

  constructor() {
    super("floorplan");
  }

  preload(): void {
    // Precarga los 4 mapas + tileset (la campaña activa puede ser cualquier arquetipo).
    for (const [archetype, url] of Object.entries(SHIP_MAP_URLS)) {
      this.load.tilemapTiledJSON(archetype, url);
    }
    this.load.image(TILESET_IMAGE_KEY, tilesetUrl);
    for (const [key, url] of Object.entries(PARTICLE_TEXTURE_URLS)) {
      this.load.image(key, url);
    }
    preloadComponentSprites(this);
    preloadCrewPortraits(this);
    preloadCrewSprite(this);
    preloadUiAssets(this);
    preloadAudioAssets(this);
  }

  create(): void {
    // La escena de Phaser es una instancia PERSISTENTE: al pasar de un capítulo
    // al siguiente (`crisis-result → in-mission` hace `p.start(floorplan)`),
    // `create()` se re-ejecuta pero los inicializadores de campo de clase NO se
    // reinician. Sin esto, `crisisResultShown` quedaba en `true` del capítulo
    // anterior y `goToCrisisResult` del siguiente cortaba sin mostrar el pop-up
    // de resultado (el jugador quedaba atrapado en la misión). Reiniciar acá
    // TODO el estado por-misión que solo se declara con inicializador de campo.
    this.crisisResultShown = false;
    this.barksCrisisStartFired = false;
    this.briefingOpen = false;
    this.objectivesOpen = false;
    this.queueRedrawAccumulatorMs = 0;
    this.crewTokens.clear();
    this.enemyTokens.clear();

    const save = campaignSession.requireActive();
    this.mission = new MissionRuntime(save);
    // Overlay de alerta al iniciar crisis (Fase 12a, corrección post-playtest):
    // `MissionRuntime` corre un tick SÍNCRONO de la crisis en su constructor
    // (GDD §4: "la crisis ya está disparada cuando arranca la planificación"),
    // ANTES de que esta escena exista — si el trigger ya aplica desde el
    // arranque (como en los capítulos 1 y 2 actuales), el evento
    // `crisis-triggered` en vivo (suscripción más abajo) nunca llega a verse.
    this.crisisStartAlertUntilSeconds =
      this.mission.crisisState === "active" ? this.time.now / 1000 + VIOLENT_ALERT_HOLD_SECONDS : -Infinity;
    if (this.mission.crisisState === "active") {
      this.sound.play(pickSoundKey(AUDIO_KEYS.alarm), { volume: 0.5 });
    }
    this.nameByComponentId = new Map(ATOMIC_COMPONENT_CATALOG.map((spec) => [spec.id as string, spec.name]));
    // Carga async de creaciones custom (11c.1): se registran en el runtime y sus
    // nombres se suman al mapa compartido con el controller (misma referencia, se
    // ve la actualización). Fire-and-forget: termina mucho antes de que el jugador
    // pueda abrir el picker de instalación, y una falla de carga no bloquea la misión.
    void this.mission.loadInstallableCreations().then((creations) => {
      for (const def of creations) this.nameByComponentId.set(def.id as string, def.name);
    });

    // `cameras.main` pasa a ser la cámara de MUNDO (recortada al área de
    // mapa). `hudCamera` es una cámara ADICIONAL, canvas completo, agregada
    // después — por eso pinta siempre último (ver comentario del campo).
    this.cameras.main.setViewport(0, HEADER_HEIGHT, MAP_VIEWPORT_WIDTH, MAP_VIEWPORT_HEIGHT);
    this.hudCamera = this.cameras.add(0, 0, 1280, 720);
    this.installTopmostOnlyInput();
    // Filtro CRT (12c.4 → reestructurado en dos capas): brillo de fósforo retro
    // sobre el FRAME COMPLETO (mundo + HUD) — barrel/scanlines coherentes entre
    // ambas cámaras vía `gl_FragCoord` global (ver `crt-pipeline.ts`). Solo bajo
    // WebGL — en Canvas no hace nada, sin romper. Se siembra el store de
    // intensidad desde disco (async, hasta entonces sirve los defaults).
    this.crtPipelines = [registerCrtPipeline(this, this.cameras.main), registerCrtPipeline(this, this.hudCamera)].filter(
      (p): p is CrtPostFxPipeline => p !== null,
    );
    void loadSettings().then((settings) => {
      hydrateCrtSettings(settings);
      hydrateShadowSettings(settings);
    });

    this.interaction = new MissionInteractionController(
      this.rex,
      this.mission,
      this.nameByComponentId,
      {
        actionPanelWidth: ACTION_PANEL_WIDTH,
        actionPanelHeight: ACTION_PANEL_HEIGHT,
        actionPanelMaxHeight: ACTION_PANEL_MAX_HEIGHT,
      },
      {
        setStatus: (text) => this.setStatus(text),
        onTaskQueued: () => this.redrawQueuePanel(),
        onWireModeChanged: () => {
          this.updateWireModeButton();
          this.updateWireHighlights();
        },
        markAsHudObject: (obj) => this.markAsHudObject(obj),
        onOpenFabricator: (instanceId) => this.openWorkbench(instanceId),
        onSelectionChanged: () => this.updateSelectedHighlight(),
        onWireSelectionChanged: () => this.updateWireHighlights(),
        onTransferModeChanged: () => this.updateTransferMode(),
      },
    );

    this.barks = new BarkController(this, (obj) => this.markAsWorldObject(obj));

    // --- Mundo (solo visible/paneable vía cameras.main) ---------------------
    // La grilla transitable se extrae ANTES del render (Fase 11f) para que
    // `renderFloorplan` pueda trazar la polilínea de cada conducto evitando
    // paredes (`computeConduitPaths`) — antes se extraía después, cuando solo
    // hacía falta para el pathing de tripulación.
    this.walkableGrid = extractWalkableGrid(
      this,
      this.mission.shipFloorplan.archetype,
      this.mission.shipFloorplan.gridSize,
    );
    // Fase 13a (deuda #3): el sensor óptico simulado necesita línea de visión
    // real contra paredes — sin este grid disponible (nave sin tile art), el
    // motor se queda en el fallback "nada bloqueado" ya seteado por defecto.
    if (this.walkableGrid) {
      const grid = this.walkableGrid;
      this.mission.setMotionBlockedQuery({ isBlocked: (cell) => !grid.isWalkable(cell.x, cell.y) });
    }
    // El plano vuelve DOS objetos por profundidad: `base` (suelo/objetos/
    // etiquetas, debajo de tripulación y componentes) y `walls` (paredes, por
    // encima). Ambos se registran en la cámara de mundo (post-playtest #7).
    const floorplanRender = renderFloorplan(this, this.mission.shipFloorplan, this.walkableGrid);
    this.floorplanRender = floorplanRender;
    this.markAsWorldObject(floorplanRender.base);
    if (floorplanRender.walls) this.markAsWorldObject(floorplanRender.walls);
    this.redrawOverlay();
    this.knownProjectileRefs = new Set(this.mission.projectiles.all.map((state) => state.ref));
    this.redrawProjectileTokens();
    this.redrawTrajectoryGhost();
    this.initCrewTokens();
    this.initEnemyTokens();
    this.initProblemMarker();
    this.initSectionAtmosphereEffects();
    this.initConduitFlowEffects();
    this.syncSignalWireFlowEffects();

    // Resaltado de la celda bajo el cursor: un único rectángulo reutilizable
    // que se reposiciona en `pointermove` (ajuste post-playtest #4) — objeto
    // de mundo, panea con el mapa. Oculto hasta el primer movimiento sobre
    // una celda interactuable.
    this.hoverHighlight = this.add
      .rectangle(0, 0, CELL, CELL)
      .setOrigin(0, 0)
      .setStrokeStyle(2, HOVER_HIGHLIGHT_COLOR, 1)
      .setFillStyle(HOVER_HIGHLIGHT_COLOR, 0.15)
      .setDepth(RENDER_DEPTH.hoverHighlight)
      .setVisible(false);
    this.markAsWorldObject(this.hoverHighlight);

    // Resaltado PERSISTENTE de la celda/footprint seleccionado (color distinto
    // del hover): queda marcado aunque el mouse se mueva, para no colocar algo
    // en la celda equivocada (bug 6). Se reconstruye vía `onSelectionChanged`
    // (ver `updateSelectedHighlight`).

    const worldWidth = this.mission.shipFloorplan.gridSize.width * CELL;
    const worldHeight = this.mission.shipFloorplan.gridSize.height * CELL;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    // Zoom mínimo = "encajar todo el plano" (nunca por encima de 1: si el mundo
    // ya cabe en el viewport, no se fuerza un zoom mayor al normal).
    this.minZoom = Math.min(1, MAP_VIEWPORT_WIDTH / worldWidth, MAP_VIEWPORT_HEIGHT / worldHeight);

    // --- Sombras dinámicas con oclusión (Fase 12d.1) ------------------------
    // Objeto de MUNDO (panea con el mapa, la hudCamera lo ignora). Los
    // oclusores estáticos (paredes ∪ objetos Tiled) se extraen una vez; las
    // luces se enchufan por el hook `registerLight`.
    this.shadowLayer = new DynamicShadowLayer(this, worldWidth, worldHeight, {
      darknessColor: DYNAMIC_SHADOW_COLOR,
      darknessAlpha: DYNAMIC_SHADOW_DARKNESS_ALPHA,
      depth: RENDER_DEPTH.dynamicShadows,
    });
    this.shadowLayer.setStaticOccluders(
      extractOccluderGrid(this, this.mission.shipFloorplan.archetype, this.mission.shipFloorplan.gridSize),
      CELL,
    );
    this.markAsWorldObject(this.shadowLayer.renderTexture);

    // Luces focales autoradas en Tiled (capa `luces`, iteración post-playtest
    // de 12d): reemplazan la ambiental global de 12d.3 (que lavaba el contraste
    // de las sombras). Son `PointLight` reales → iluminan las salas Y proyectan
    // sombras vía el hook `registerLight`. Creadas una vez, persistentes.
    for (const spec of loadAuthoredLights(this, this.mission.shipFloorplan.archetype)) {
      createDynamicLight(this, spec.x, spec.y, spec.color, spec.radius, spec.intensity, this.registerLight);
    }

    if (this.mission.problemMarkerPosition) {
      const marker = this.mission.problemMarkerPosition;
      this.cameras.main.centerOn((marker.x + 0.5) * CELL, (marker.y + 0.5) * CELL);
    }

    // --- HUD fijo (solo visible vía cameras.main) ---------------------------
    this.markAsHudObject(
      this.add.rectangle(640, HEADER_HEIGHT / 2, 1280, HEADER_HEIGHT, 0x0a0a0f, 0.85).setDepth(RENDER_DEPTH.hudBackground),
    );
    this.headerText = this.add
      .text(150, HEADER_HEIGHT / 2, "", { fontFamily: "monospace", fontSize: "13px", color: HEADER_COLOR })
      .setOrigin(0, 0.5)
      .setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.headerText);

    // Temporizador de crisis: GRANDE y en el centro superior del área de mapa
    // (lejos de la fila de botones del header → sin solape). Píldora de fondo
    // para legibilidad sobre cualquier tile. Se actualiza por frame en
    // `update()` y se oculta si la crisis no tiene timer (cap. 1).
    const timerCenterX = MAP_VIEWPORT_WIDTH / 2;
    const timerCenterY = HEADER_HEIGHT + 24;
    this.timerPill = this.add
      .rectangle(timerCenterX, timerCenterY, 250, 42, 0x0a0a0f, 0.72)
      .setStrokeStyle(1, 0x2a3040, 1)
      .setDepth(RENDER_DEPTH.hudContent)
      .setVisible(false);
    this.markAsHudObject(this.timerPill);
    this.timerText = this.add
      .text(timerCenterX, timerCenterY, "", {
        fontFamily: "monospace",
        fontSize: "26px",
        fontStyle: "bold",
        color: TIMER_TEXT_COLORS.calm,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(RENDER_DEPTH.hudContent)
      .setVisible(false);
    this.markAsHudObject(this.timerText);

    // Borde del viewport del mapa coloreado por modo (ajuste post-playtest
    // #4): comunica pausa/ejecución aunque el jugador no mire el header.
    this.mapBorder = this.add
      .rectangle(0, HEADER_HEIGHT, MAP_VIEWPORT_WIDTH, MAP_VIEWPORT_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(3, CORE_LOOP_MODE_COLORS.planning, 1)
      .setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.mapBorder);
    this.statusText = this.add
      .text(8, HEADER_HEIGHT + 6, "", { fontFamily: "monospace", fontSize: "11px", color: LABEL_COLOR })
      .setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.statusText);

    // Tooltip rico (pieza/zona) bajo el cursor — se construye recién en el
    // primer `updateTooltip` con contenido (ver más abajo); acá solo se deja
    // el placeholder `undefined`, no hay nada que mostrar todavía.

    this.updatePlayPauseButton();
    this.updateWireModeButton();
    this.updateTransferModeButton();
    this.createObjectivesButton();
    this.createLayersButton();
    this.redrawEnergyControls();

    // El fondo del strip lateral ya NO es un rectángulo único: cada panel (cola
    // de tripulación, acciones) trae su propia caja delimitada (playtest #16),
    // para que se vea la separación y ninguno invada al otro.

    this.customCursor = new CustomCursor(this);
    this.customCursor.reset();

    // Notificaciones arriba-centro del área de mapa (12c.7). Objetos de HUD.
    this.notifications = new NotificationCenter(this, MAP_VIEWPORT_WIDTH / 2, HEADER_HEIGHT + 12, (obj) =>
      this.markAsHudObject(obj),
    );
    this.redrawCrewStrip();
    this.redrawQueuePanel();
    this.renderObjectivesStrip();
    this.shipStatusRedrawKey = undefined; // fuerza el primer redibujo del HUD (Subfase 11g).
    this.redrawShipStatusHud();

    // --- Input: click vs. arrastre (paneo) sobre la zona de mapa ------------
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.briefingOpen || this.objectivesOpen || this.interaction.installPickerOpen || this.isOverFixedUi(pointer)) return;
      this.dragOrigin = {
        x: pointer.x,
        y: pointer.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
      };
      this.dragDistance = 0;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragOrigin && pointer.isDown) {
        const dx = pointer.x - this.dragOrigin.x;
        const dy = pointer.y - this.dragOrigin.y;
        this.dragDistance = Math.max(this.dragDistance, Math.hypot(dx, dy));
        // El scroll está en unidades de mundo y el delta en píxeles de pantalla:
        // dividir por el zoom mantiene el arrastre 1:1 con el cursor a cualquier
        // acercamiento (a zoom 1 es idéntico al comportamiento previo).
        const zoom = this.cameras.main.zoom;
        this.cameras.main.scrollX = this.dragOrigin.scrollX - dx / zoom;
        this.cameras.main.scrollY = this.dragOrigin.scrollY - dy / zoom;
        this.hideTooltip();
        return;
      }
      this.updateHoverHighlight(pointer);
      this.updateTooltip(pointer);
      this.updateCursor(pointer);
      this.updateTransferChannel(pointer);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      // Selección de tripulante (tira) y cancelar tarea (cola) por hit-test a
      // nivel de escena — mismo mecanismo determinista que el click de mapa, y
      // el motivo del fix de #16b: reconstruir estos paneles acá es seguro
      // porque corre fuera del dispatch de un objeto interactivo.
      if (this.handleCrewStripClick(pointer)) return;
      if (this.handleQueueCancelClick(pointer)) return;
      if (!this.dragOrigin) return;
      const wasClick = this.dragDistance < DRAG_THRESHOLD_PX;
      this.dragOrigin = undefined;
      if (!wasClick) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const position: GridPosition = {
        x: Math.floor(worldPoint.x / CELL),
        y: Math.floor(worldPoint.y / CELL),
      };
      this.interaction.handleMapClick(position);
    });

    // Zoom con la rueda sobre la zona de mapa (playtest #13), anclado al cursor.
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        // Rueda sobre la caja de la cola → scrollea la lista (no zoom de mapa).
        if (this.queuePanel && this.isOverQueue(pointer)) {
          this.scrollQueue(dy);
          return;
        }
        if (this.briefingOpen || this.objectivesOpen || this.interaction.installPickerOpen || this.isOverFixedUi(pointer)) return;
        const camera = this.cameras.main;
        const next = Phaser.Math.Clamp(
          dy < 0 ? camera.zoom * ZOOM_STEP : camera.zoom / ZOOM_STEP,
          this.minZoom,
          MAP_MAX_ZOOM,
        );
        if (next === camera.zoom) return;
        // Anclaje al cursor: el punto de mundo bajo el puntero debe quedar fijo.
        const before = camera.getWorldPoint(pointer.x, pointer.y);
        camera.zoom = next;
        const after = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += before.x - after.x;
        camera.scrollY += before.y - after.y;
      },
    );

    this.input.keyboard?.on("keydown-G", () => this.scene.start("particle-gallery"));
    this.input.keyboard?.on("keydown-F", () => this.fireDevEventSample());
    this.input.keyboard?.on("keydown-H", () => this.fireDevSectionDamage());
    this.input.keyboard?.on("keydown-ESC", () => {
      // Ronda 8 (playtest #3): ESC cancela primero el modo de trasvase activo
      // — solo si no hay ninguno abierto cae al comportamiento previo de pausa.
      if (this.interaction.transferMode) {
        this.interaction.cancelTransferMode();
        return;
      }
      if (metaGameStateMachine.canTransition("paused")) {
        metaGameStateMachine.transition("paused");
      }
    });

    // Suscripciones a los emisores del motor. Se guardan los `Unsubscribe` para
    // liberarlos en el SHUTDOWN de la escena: si no, una `MissionRuntime` que
    // sobrevive a su escena (p. ej. referenciada por un closure) seguiría
    // emitiendo hacia handlers que dibujan sobre objetos ya destruidos (crash
    // `drawImage` null). `onAny` devuelve el `Unsubscribe` (event-emitter.ts).
    const missionSubscriptions: Array<() => void> = [
      this.mission.coreLoopEvents.onAny((event) => this.handleCoreLoopEvent(event)),
      this.mission.crewEvents.onAny((event) => this.handleCrewEvent(event)),
      // Fase 11d.3: avance/ataque/derrota de enemigo. Sin contenido de capítulo
      // todavía (11d.4), así que `enemyState`/`enemyEvents` están vacíos en
      // misión real hoy — este es el consumidor, listo para cuando exista.
      this.mission.enemyEvents.onAny((event) => this.handleEnemyEvent(event)),
      // Fase 11a.3: la estela de aceleración magnética y el burst de impacto
      // cinético (`kinetics-effect.ts`) ya existían completos pero sin llamador
      // en misión real (solo se demostraban en la galería de partículas) — este
      // es el cableado que faltaba.
      this.mission.kineticEvents.onAny((event) => {
        const cell = this.kineticEventPosition(event);
        if (cell) fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
      }),
      this.mission.signalEvents.onAny((event) => {
        const cell = this.mission.blueprint.signalGraph.nodes.find((node) => node.id === event.nodeId)?.position;
        if (cell) fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
      }),
      // Fase 11b: `structuralDegradedEffect`/`structuralFailureEffect` ya
      // existían completos pero sin llamador en misión real (solo demostrados
      // en la galería) — `MissionStructuralRuntime` es el primer emisor real.
      this.mission.failureEvents.onAny((event) => {
        const cell = this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === event.ref)?.placement
          .position;
        if (cell) fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
        // Estática de fósforo LOCALIZADA (capa "System Failure", roadmap
        // Duskers): la celda del componente averiado pierde "señal". Gate por el
        // control de flicker de accesibilidad (a 0, un jugador fotosensible no la
        // ve, coherente con la capa `uFailure` del shader). Severidad por gravedad:
        // ruptura estructural / incendio / explosión = major; el resto = minor.
        if (cell && getFlickerIntensity() > 0) {
          const major =
            event.kind === "structural-failure" ||
            (event.kind === "overload" && (event.failureMode === "fire" || event.failureMode === "explosion"));
          this.fireLocalStatic(cell, major ? "major" : "minor");
        }
        // Overlay de alerta de pantalla completa (Fase 12a): solo incendio/
        // explosión son lo bastante graves como para justificar un flash
        // GLOBAL — un corte ("cut", ej. cortocircuito eléctrico) ya tiene su
        // propia cicatriz local (chispas + luz, `syncOverloadedConductorEffects`),
        // sin necesidad de alarmar toda la pantalla.
        if (event.kind === "overload" && (event.failureMode === "fire" || event.failureMode === "explosion")) {
          this.violentAlertUntilSeconds = this.time.now / 1000 + VIOLENT_ALERT_HOLD_SECONDS;
          this.sound.play(pickSoundKey(AUDIO_KEYS.alarm), { volume: 0.5 });
          this.notifications?.push({ title: t("ui.floorplan.notification.crisis-escalation"), type: "error" });
        }
      }),
      // Fase 13a (deuda #16): `combustionEffect`/`combustionSound` ya existían
      // completos, registrados por `kind: "combustion"`, pero sin llamador
      // real en misión (solo demostrados en la galería de partículas) —
      // `MissionReactionRuntime` es el primer emisor real. El evento no trae
      // celda propia (`CombustionRule` es lógica de reacción pura, sin mundo),
      // así que se posiciona en el centroide de `event.sectionId`.
      this.mission.reactionEvents.onAny((event) => {
        const section =
          event.kind === "combustion" && event.sectionId
            ? this.mission.shipFloorplan.sections.find((entry) => entry.id === event.sectionId)
            : undefined;
        const cell = section && sectionCentroidCell(section);
        if (cell) fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
        // Mismo overlay de alerta de pantalla completa que ya reacciona a
        // overload fire/explosion (Fase 12a) — cierra el hueco que el propio
        // texto de esa fase dejó pendiente ("NO reacciona a combustión
        // violenta").
        if (event.kind === "combustion" && event.intensity !== "weak") {
          this.violentAlertUntilSeconds = this.time.now / 1000 + VIOLENT_ALERT_HOLD_SECONDS;
          this.sound.play(pickSoundKey(AUDIO_KEYS.alarm), { volume: 0.5 });
          this.notifications?.push({ title: t("ui.floorplan.notification.crisis-escalation"), type: "error" });
        }
      }),
      // Subfase 13d: riesgo sistémico al desmontar. El evento SÍ trae su celda
      // (a diferencia de la combustión), así que la partícula se pinta
      // exactamente donde estaba la pieza que el tripulante acaba de arrancar.
      this.mission.salvageEvents.onAny((event) => {
        // El charco toma el color de LA sustancia derramada (13e ronda 2): con
        // un tinte fijo, agua y ácido dejaban la misma mancha.
        fireEventEffect(
          this,
          event.position,
          event,
          event.kind === "dismantle-spill"
            ? {
                ...this.worldEffectOptions,
                tint: chemicalSubstanceColor(
                  event.substanceId,
                  this.mission.substanceTagsOf(event.substanceId),
                ),
              }
            : this.worldEffectOptions,
        );
        fireEventSound(this, event);
        this.notifications?.push({
          title: t(`ui.floorplan.notification.${event.kind}`),
          type: "warning",
        });
        // El desmontaje inseguro cambia el mundo (pieza fuera, fuga abierta):
        // redibujar para que el plano no quede una pasada atrás.
        this.redrawOverlay();
      }),
      // Subfase 13f: daño y colapso de una sección. El daño se pinta en el
      // centroide (es "la sección", no una celda); la brecha SÍ trae su celda
      // exacta, porque es donde el jugador tiene que instalar el parche.
      this.mission.integrityEvents.onAny((event) => {
        const section = this.mission.shipFloorplan.sections.find(
          (entry) => entry.id === event.sectionId,
        );
        const cell = event.kind === "section-breached" ? event.breachCell : section && sectionCentroidCell(section);
        if (cell) fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
        if (event.kind === "section-breached") {
          // Una brecha es tan grave como una combustión violenta: mismo
          // overlay de alerta de pantalla completa y misma alarma.
          this.violentAlertUntilSeconds = this.time.now / 1000 + VIOLENT_ALERT_HOLD_SECONDS;
          this.sound.play(pickSoundKey(AUDIO_KEYS.alarm), { volume: 0.5 });
          this.notifications?.push({
            title: t("ui.floorplan.notification.section-breached"),
            lines: [t("ui.floorplan.notification.section-breached-detail")],
            type: "error",
          });
          // El colapso desgasta y destruye piezas de la sección: el plano
          // tiene que reflejarlo ya, no una pasada después.
          this.redrawOverlay();
        } else {
          this.notifications?.push({
            title: t("ui.floorplan.notification.section-damaged"),
            type: "warning",
          });
        }
      }),
      // Subfase 13f (deuda #16): peligro atmosférico sobre la tripulación. Es
      // el bus que faltaba — hasta ahora `toxic-threshold`/`corrosive-exposure`
      // solo existían en la galería de partículas.
      this.mission.atmosphereEvents.onAny((event) => {
        const section = this.mission.shipFloorplan.sections.find(
          (entry) => entry.id === event.sectionId,
        );
        const cell = section && sectionCentroidCell(section);
        if (cell) fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
        this.notifications?.push({
          title: t(`ui.floorplan.notification.${event.kind}`),
          type: event.severity === "lethal" ? "error" : "warning",
        });
      }),
      // Fase 13b (ronda 4): el jugador tiene más energía repartida de la que la
      // nave puede entregar — típicamente porque desmanteló una fuente. El
      // motor ya resolvió el conflicto apagando secciones de menor a mayor
      // asignación; acá solo se COMUNICA, porque de otro modo el reparto
      // cambiaba en silencio. No lleva alarma sonora ni overlay de pantalla
      // completa: es un problema de gestión, no una crisis violenta.
      this.mission.powerEvents.onAny((event) => {
        if (event.kind !== "power-shortfall") return;
        this.notifications?.push({
          title: t("ui.floorplan.notification.power-shortfall"),
          // `t()` no interpola: las palabras vienen de la tabla, los números se
          // componen aparte (mismo criterio que la etiqueta del slider).
          lines: [`${t("ui.floorplan.notification.power-shortfall-detail")} ${event.requestedUnits}/${event.totalUnits}`],
          type: "warning",
        });
      }),
      this.mission.crisisEvents.onAny((event) => {
        this.updateHeader();
        this.updateProblemMarkerVisibility();
        if (event.kind === "crisis-triggered") {
          // Capítulos futuros donde el trigger aplique DESPUÉS del arranque
          // (a diferencia de los capítulos 1/2 actuales, ver el chequeo
          // síncrono en `create()`) — mismo hold que ese caso.
          this.crisisStartAlertUntilSeconds = this.time.now / 1000 + VIOLENT_ALERT_HOLD_SECONDS;
          this.sound.play(pickSoundKey(AUDIO_KEYS.alarm), { volume: 0.5 });
          this.notifications?.push({ title: t("ui.floorplan.notification.crisis-escalation"), type: "warning" });
        }
        if (event.kind === "crisis-resolved") {
          this.goToCrisisResult(event.outcome);
        }
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of missionSubscriptions) unsubscribe();
      // Los loops de audio (`gasLeakSound`) viven en el `SoundManager` del
      // juego, no en la escena — a diferencia de los emisores de partículas,
      // Phaser no los destruye solo al cambiar de escena. Sin este stop, un
      // loop de fuga activo seguiría sonando tras salir de la misión.
      for (const effects of this.sectionAtmosphereEffects.values()) effects.gasLeakSound.stop();
      // El cursor CSS del canvas es global (12c.3): sin esto, el puntero
      // reactivo (ej. la mira de cableado) se filtraría a los menús.
      this.input.setDefaultCursor("default");
    });

    this.updateHeader();
    this.showBriefingIfAny();
  }

  update(time: number, delta: number): void {
    if (delta > 0) {
      this.mission.coreLoop.tick(delta / 1000);
    }
    this.updateTimer(time);
    // La etiqueta y el anillo de "trabajando" siguen al dot cada frame — con
    // pathing multi-salto el dot recorre un camino largo, así que fijarlos
    // solo al destino (como antes) los dejaría adelantados respecto al token.
    for (const [actorId, token] of this.crewTokens) {
      token.label.setPosition(token.dot.x, token.dot.y - 20);
      token.workingRing.setPosition(token.dot.x, token.dot.y);
      token.selectionRing.setPosition(token.dot.x, token.dot.y);
      // Fix post-11d.4 (reemplaza `syncCrewCell`): `crewState.currentCell` se
      // deriva de la celda VISUAL real del token, no del centroide de toda la
      // sección — un enemigo/proyectil necesita precisión de celda para que
      // las reglas de combate (adyacencia/rango 2-3) puedan conectar contra
      // un tripulante que puede estar en cualquier punto de una sección
      // grande (ej. `pasillo-central`), incluso a mitad de un viaje largo.
      //
      // `currentSectionId` (fix post-11d.4, 3ra ronda) se deriva IGUAL, por el
      // mismo motivo: `scheduler.currentSectionId` (usado para el save) solo
      // cambia cuando un `go-to` COMPLETA, nunca mientras el tripulante
      // atraviesa visualmente una sección de paso — un enemigo en esa sección
      // nunca conectaba un ataque contra alguien que solo estaba pasando por
      // ahí. `crewState` no es la fuente de guardado (`toUpdatedSave` lee del
      // scheduler), así que sobreescribirla acá es seguro.
      const actor = this.mission.crewState.get(actorId);
      if (actor) {
        const cell = { x: Math.floor(token.dot.x / CELL), y: Math.floor(token.dot.y / CELL) };
        const sectionId = sectionContainingCell(this.mission.shipFloorplan, cell)?.id ?? actor.currentSectionId;
        if (
          actor.currentCell?.x !== cell.x ||
          actor.currentCell?.y !== cell.y ||
          actor.currentSectionId !== sectionId
        ) {
          this.mission.crewState.set({ ...actor, currentCell: cell, currentSectionId: sectionId });
        }
      }
    }
    // Fase 11d.4 (fix de animación): mismo motivo que la tripulación arriba —
    // con pathing multi-salto el token de enemigo recorre un camino largo,
    // así que la etiqueta debe seguirlo cada frame, no solo fijarse al llegar.
    for (const token of this.enemyTokens.values()) {
      token.label.setPosition(token.shape.x, token.shape.y - token.shape.width);
    }
    // Tweens de salto de tripulación/enemigos (Fase 12f, Obs 3): sin este
    // chequeo un salto en curso seguía animándose visualmente en `planning`
    // aunque el reloj de simulación estuviera congelado. `pause`/`resume` de
    // Phaser son idempotentes, así que repetir la llamada cada frame es seguro.
    if (this.mission.coreLoop.mode === "execution") {
      this.activeHopTweens.forEach((tween) => tween.resume());
    } else {
      this.activeHopTweens.forEach((tween) => tween.pause());
    }
    // Proyectiles (Fase 11a.3): posición continua, no animada por evento
    // discreto — se redibuja cada frame mientras el reloj corre. En pausa no
    // hace falta (el reloj congelado no mueve nada; el fantasma ya lo cubre).
    if (this.mission.coreLoop.mode === "execution") {
      this.syncNewlyPromotedProjectiles();
      this.redrawProjectileTokens();
    }
    // Redibujo del panel de cola con throttle durante la ejecución, para que
    // la barra de progreso y la cuenta regresiva avancen en vivo (el panel si
    // no solo se redibuja por evento de dominio, que no cambia cada frame).
    if (this.mission.coreLoop.mode === "execution") {
      this.queueRedrawAccumulatorMs += delta;
      if (this.queueRedrawAccumulatorMs >= 200) {
        this.queueRedrawAccumulatorMs = 0;
        this.redrawQueuePanel();
      }
    }
    // Atmósfera por sección (Fase 11b): solo evoluciona con el reloj de
    // simulación, igual que los proyectiles — en pausa la difusión está
    // congelada (`MissionAtmosphereRuntime` no tickea), así que no hay nada
    // nuevo que pintar.
    if (this.mission.coreLoop.mode === "execution") {
      this.updateSectionAtmosphereEffects(delta / 1000);
    }
    // La cicatriz de sección sin energía, en cambio, parpadea siempre — es
    // una marca persistente de la nave, no un efecto de la simulación.
    this.redrawUnpoweredSectionScar(time / 1000);
    this.syncUnpoweredSectionLights(time / 1000);
    // Chispas + luz de conductor sobrecargado (Fase 12a): misma cicatriz
    // permanente que la de arriba, parpadea siempre, sin importar el modo.
    this.syncOverloadedConductorEffects(time / 1000, delta / 1000);
    // Sombras dinámicas (Fase 12d): recorta la oscuridad con el polígono de
    // visibilidad de cada luz activa + la ambiental global. Se repinta siempre
    // (las luces parpadean aun en pausa, igual que las cicatrices de arriba).
    // Los casters móviles (componentes, tripulación, enemigos) se recalculan
    // acá cada frame — barato para el conteo actual; 12d.4 lo hará por dirty.
    if (this.shadowLayer) {
      this.shadowLayer.setIntensity(getShadowIntensity());
      this.shadowLayer.setDynamicOccluders(this.collectDynamicOccluderEdges());
      this.shadowLayer.redraw();
      // La RT de arriba solo oscurece el SUELO; este paso lleva la misma luz a
      // los sprites vía tinte (Fase 12d, cierre — Obs 16). Va inmediatamente
      // después del redraw para que ambos lean el mismo estado de luces y
      // oclusores en el mismo frame.
      this.applyLightShading();
    }
    // Capa "estructural" del HUD (Fase 12a): tiñe cada sección por su peor RE
    // agregado — barata de recalcular (pocas secciones), se redibuja siempre,
    // igual que la cicatriz de energía.
    drawStructuralLayer(this.floorplanRender.conduitLayers.estructural, this.mission.shipFloorplan, (sectionId) =>
      this.mission.sectionHullIntegrity(sectionId),
    );
    // Capa "energia" del HUD (Fase 13b): heatmap de demanda vs. suministro por
    // sección — mismo criterio "barata, se redibuja siempre" que estructural.
    drawEnergyLayer(
      this.floorplanRender.conduitLayers.energia,
      this.mission.shipFloorplan,
      (sectionId) => this.mission.blueprint.unpoweredSectionIds.includes(sectionId),
      (sectionId) => this.mission.sectionPowerDemand(sectionId) > this.mission.sectionPowerAllocation(sectionId),
    );
    // Overlay de alerta de pantalla completa (Fase 12a): dominio del HUD de
    // estado en crítico, un `overload` violento reciente, o el INICIO de la
    // crisis (corrección post-playtest: con el criterio original la alarma
    // era inalcanzable en los capítulos actuales — la fuga del Cap.1 nunca
    // llega a "critical", solo "warning") — solo mientras la misión sigue en
    // ejecución (no tiene sentido tras resolver la crisis).
    // Nota: "combustión violenta" queda fuera del disparador hasta que exista
    // un runtime de misión real que emita `CombustionEvent` — hoy la química
    // de reacción solo corre en tests/galería de partículas, sin llamador de
    // producción en `MissionRuntime` (mismo tipo de hueco que tenía
    // `OverloadRule` antes de esta fase).
    const hasCriticalShipStatus =
      this.mission.shipStatus.atmosphere.level === "critical" ||
      this.mission.shipStatus.lifeSupport.level === "critical" ||
      this.mission.shipStatus.hullIntegrity.level === "critical" ||
      this.mission.shipStatus.energy.level === "critical";
    const screenAlertActive =
      this.mission.coreLoop.mode === "execution" &&
      (hasCriticalShipStatus ||
        time / 1000 < this.violentAlertUntilSeconds ||
        time / 1000 < this.crisisStartAlertUntilSeconds);
    this.redrawScreenAlertOverlay(time / 1000, screenAlertActive);
    // Driver de la capa "System Failure" del CRT (12c.4 reestructurado): la
    // misma condición del overlay de alerta (crítico / overload violento /
    // inicio de crisis, en ejecución) sube una rampa suavizada, que decae al
    // normalizarse. Se multiplica por el control de flicker de accesibilidad,
    // así que a flicker 0 la capa queda apagada aunque la estética CRT siga.
    this.updateCrtDriver(time / 1000, delta / 1000, screenAlertActive);
    // Parpadeo verdoso del retrato del tripulante en gas tóxico/corrosivo
    // (12c.2). Estado vivo de atmósfera → overlay persistente por tarjeta.
    this.syncCrewToxicOverlays();
    // El flujo de conductos (Fase 11f, fix 11f.7): a diferencia de la cicatriz
    // de arriba (una marca estática que solo parpadea), los tokens de flujo
    // SE MUEVEN — es una animación de simulación, y todo lo que se mueve debe
    // congelarse en pausa (mismo criterio que proyectiles/atmósfera). Solo se
    // actualiza en "execution"; en pausa los tokens quedan fijos donde estaban.
    if (this.mission.coreLoop.mode === "execution") {
      this.updateConduitFlowEffects(delta / 1000);
      this.updateSignalWireFlowEffects(delta / 1000);
      this.updateLedIndicators();
      this.updateLcdDisplays(delta / 1000);
    }
    // HUD de estado permanente + panel de acciones flotante (Subfase 11g):
    // el HUD se auto-throttlea por cambio de valor; el panel flotante debe
    // reposicionarse cada frame para seguir la celda seleccionada mientras
    // el jugador panea/hace zoom del mapa (`cameras.main`).
    this.redrawShipStatusHud();
    this.updateActionPanelAnchor();
  }

  /**
   * Convierte la celda seleccionada a coordenadas de pantalla y reposiciona
   * el panel de acciones flotante (Subfase 11g). Inversa de la conversión
   * pantalla→mundo que ya usa `updateTooltip`/`updateHoverHighlight`
   * (`cameras.main.getWorldPoint`): `screen = (world - scroll) * zoom +
   * viewport`, viewport = (0, HEADER_HEIGHT). Sin celda (el panel se abrió
   * desde el botón "Sustancias" del HUD, no desde un click de mapa), usa una
   * posición fija (`SUBSTANCES_PANEL_POSITION`) — no tiene sentido "seguir"
   * un punto de mundo que no existe, y el clamp genérico pensado para
   * mantener una celda dentro de pantalla lo empujaba a la esquina inferior
   * derecha del mapa, semi-tapado por la tira de tripulación (playtest).
   */
  private updateActionPanelAnchor(): void {
    if (!this.interaction.hasContextualSelection) {
      this.actionPanelBounds = undefined;
      return;
    }
    const cell = this.interaction.selectedCell;
    let x: number;
    let y: number;
    // Alto REAL, no el nominal (13d ronda 2): con avisos de riesgo el panel es
    // más alto, y con el nominal se salía por abajo de la pantalla y dejaba
    // pasar al mapa los clicks sobre la parte que sobresalía.
    const panelHeight = this.interaction.actionPanelHeight;
    const manual = this.interaction.manualPanelPosition;
    if (manual) {
      // Arrastre del operador (ronda 5): se respeta la posición elegida, con
      // el mismo clamp de borde que el anclaje automático — así un arrastre
      // no puede sacar el panel de pantalla ni meterlo bajo la tira de
      // tripulación. Se sigue llamando cada frame (como el caso automático):
      // un rebuild del panel a mitad de misión no debe perder el lugar donde
      // el jugador lo dejó.
      const maxX = SIDE_PANEL_X - 10 - ACTION_PANEL_WIDTH - 20;
      const maxY = CREW_STRIP_Y - panelHeight - 8;
      x = Phaser.Math.Clamp(manual.x, 10, maxX);
      y = Phaser.Math.Clamp(manual.y, HEADER_HEIGHT + 8, maxY);
    } else if (cell) {
      const camera = this.cameras.main;
      const rawPoint = {
        x: (cell.x * CELL + CELL / 2 - camera.scrollX) * camera.zoom,
        y: HEADER_HEIGHT + (cell.y * CELL + CELL / 2 - camera.scrollY) * camera.zoom,
      };
      const maxX = SIDE_PANEL_X - 10 - ACTION_PANEL_WIDTH - 20;
      // Contra la tira de tripulación, no contra el borde de pantalla (13e
      // ronda 3): el panel se metía debajo de la tira, que ocupa los 118px
      // inferiores, escondiendo sus últimos botones. Con el techo de
      // `ACTION_PANEL_MAX_HEIGHT` este clamp nunca se invierte.
      const maxY = CREW_STRIP_Y - panelHeight - 8;
      x = Phaser.Math.Clamp(rawPoint.x + ACTION_PANEL_ANCHOR_OFFSET_X, 10, maxX);
      y = Phaser.Math.Clamp(rawPoint.y + ACTION_PANEL_ANCHOR_OFFSET_Y, HEADER_HEIGHT + 8, maxY);
    } else {
      x = SUBSTANCES_PANEL_POSITION.x;
      y = SUBSTANCES_PANEL_POSITION.y;
    }
    this.interaction.repositionActionPanel({ x, y });
    // Bounds reales del container (ver `mission-action-panel.ts`): el fondo
    // arranca en (-10,-8) relativo al origen del panel.
    this.actionPanelBounds = { x: x - 10, y: y - 8, width: ACTION_PANEL_WIDTH + 20, height: panelHeight };
  }

  private get rex(): SceneWithRexUI {
    return this as unknown as SceneWithRexUI;
  }

  /** Un objeto de HUD no se renderiza en `cameras.main` (mundo) — solo en `hudCamera`. */
  private markAsHudObject(obj: Phaser.GameObjects.GameObject): void {
    this.cameras.main.ignore(obj);
  }

  /** Un objeto de mundo no se renderiza en `hudCamera` — solo en `cameras.main`. */
  private markAsWorldObject(obj: Phaser.GameObjects.GameObject): void {
    this.hudCamera.ignore(obj);
  }

  /**
   * "El elemento de UI que está más arriba es el ÚNICO que recibe el click"
   * (13e ronda 4). Phaser trae `topOnly` activo, pero su criterio de "más
   * arriba" no sirve en esta escena y por eso el click atravesaba el panel de
   * acciones hasta el botón "Prioridad" del reparto de energía que había detrás.
   *
   * Dos razones, ambas de Phaser y ninguna arreglable con `depth`:
   *  1. El hit-test corre contra TODOS los objetos interactivos de la escena;
   *     las listas `ignore` de cámara solo afectan al RENDER, nunca al input.
   *     Un objeto de MUNDO evaluado contra la `hudCamera` (sin scroll y sin el
   *     offset de viewport del mapa) tiene un área de click FANTASMA en pantalla.
   *  2. El desempate nativo ordena por el índice en el `renderList` de la cámara
   *     del puntero. Los `Label` de rexUI no entran en ese renderList, así que
   *     `indexOf` da -1 → 0 para todos y el orden queda indefinido.
   *
   * El reemplazo ordena por profundidad EFECTIVA (la del container más externo,
   * que es la capa real en pantalla: un botón dentro del panel cuenta como el
   * panel, no como su depth local, que es 0). Descendente, porque `topOnly` se
   * queda con el primero. Ordena in-place y devuelve el array, como el original.
   */
  private installTopmostOnlyInput(): void {
    const effectiveDepth = (obj: Phaser.GameObjects.GameObject): number => {
      let node = obj as Phaser.GameObjects.GameObject & {
        depth?: number;
        parentContainer?: Phaser.GameObjects.Container | null;
      };
      let depth = node.depth ?? 0;
      while (node.parentContainer) {
        node = node.parentContainer as typeof node;
        // El container manda: su depth es la capa con la que se pinta el grupo.
        depth = node.depth ?? depth;
      }
      return depth;
    };
    this.input.sortGameObjects = (gameObjects, pointer) => {
      if (gameObjects.length < 2) {
        return gameObjects;
      }
      const renderList = pointer?.camera?.renderList ?? [];
      return gameObjects.sort((a, b) => {
        const byDepth = effectiveDepth(b) - effectiveDepth(a);
        if (byDepth !== 0) {
          return byDepth;
        }
        // Empate exacto de capa: se conserva el criterio nativo (orden de
        // display list), para no alterar el comportamiento dentro de una capa.
        return Math.max(renderList.indexOf(b), 0) - Math.max(renderList.indexOf(a), 0);
      });
    };
  }

  /**
   * Sincroniza los uniforms del CRT cada frame. `crtFailureLevel` sigue a
   * `active` (misma condición del overlay de alerta) con un ease exponencial
   * (subida rápida, bajada más lenta) para que la crisis "encienda" el fósforo
   * de golpe y se calme suave. El resultado, escalado por el control de flicker,
   * alimenta `uFailure` (aberración + parpadeo); `crtIntensity` viene del slider.
   */
  private updateCrtDriver(nowSeconds: number, deltaSeconds: number, active: boolean): void {
    if (this.crtPipelines.length === 0) return;
    const target = active ? 1 : 0;
    // Constante de tiempo distinta según suba o baje (ver comentario).
    const rate = target > this.crtFailureLevel ? 8 : 2.5;
    const k = 1 - Math.exp(-rate * Math.max(deltaSeconds, 0));
    this.crtFailureLevel += (target - this.crtFailureLevel) * k;
    const crtIntensity = getCrtIntensity();
    const failure = this.crtFailureLevel * getFlickerIntensity();
    for (const pipeline of this.crtPipelines) {
      pipeline.crtIntensity = crtIntensity;
      pipeline.failure = failure;
      pipeline.time = nowSeconds;
    }
  }

  /**
   * Estática de fósforo localizada sobre `cell` (capa "System Failure"). Marca
   * los emisores como objetos de MUNDO + depth de efecto para evitar el bug de
   * doble-cámara (mismo patrón que `fireEnvironmentalDamage`).
   */
  private fireLocalStatic(cell: { x: number; y: number }, severity: "minor" | "major"): void {
    for (const emitter of firePhosphorStatic(this, cell, severity)) {
      emitter.setDepth(RENDER_DEPTH.effect);
      this.markAsWorldObject(emitter);
    }
  }

  private isOverFixedUi(pointer: Phaser.Input.Pointer): boolean {
    if (pointer.y < HEADER_HEIGHT || pointer.x >= SIDE_PANEL_X - 10 || this.isOverCrewStrip(pointer)) return true;
    // Panel de acciones flotante (Subfase 11g): a diferencia de la franja
    // lateral fija, puede estar posicionado SOBRE el mapa — sin este chequeo,
    // un click en uno de sus botones también dispararía `handleMapClick`
    // sobre la celda que hay debajo.
    const bounds = this.actionPanelBounds;
    if (
      bounds &&
      pointer.x >= bounds.x &&
      pointer.x <= bounds.x + bounds.width &&
      pointer.y >= bounds.y &&
      pointer.y <= bounds.y + bounds.height
    ) {
      return true;
    }
    // Controles de energía (slider + botón de prioridad, Fase 13b): a
    // diferencia del panel de acciones (HUD, coordenadas de pantalla), estos
    // son objetos de MUNDO — sus bounds están en espacio de mundo, así que el
    // puntero se convierte con `getWorldPoint` antes de comparar (fix
    // post-playtest ronda 2: sin esto, el pointerup de un click/arrastre
    // sobre el slider también disparaba `handleMapClick` en la celda de
    // abajo).
    if (this.energyControlWorldBounds.length > 0) {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      for (const b of this.energyControlWorldBounds) {
        if (world.x >= b.x && world.x <= b.x + b.width && world.y >= b.y && world.y <= b.y + b.height) {
          return true;
        }
      }
    }
    return false;
  }

  /** ¿El puntero está sobre la tira de tripulación (bajo el mapa)? */
  private isOverCrewStrip(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y >= CREW_STRIP_Y && pointer.x >= 0 && pointer.x < MAP_VIEWPORT_WIDTH;
  }

  /** ¿El puntero está sobre la caja de la cola unificada? */
  private isOverQueue(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= QUEUE_BOX_X &&
      pointer.x <= QUEUE_BOX_X + SIDE_PANEL_WIDTH &&
      pointer.y >= QUEUE_BOX_Y &&
      pointer.y <= QUEUE_BOX_Y + QUEUE_PANEL_HEIGHT
    );
  }

  /**
   * Selección de tripulante por hit-test sobre la tira (playtest #16b). Devuelve
   * `true` si consumió el evento (el puntero estaba en la tira), para que no siga
   * al click de mapa.
   */
  private handleCrewStripClick(pointer: Phaser.Input.Pointer): boolean {
    if (!this.crewStrip || !this.isOverCrewStrip(pointer)) return false;
    const hit = this.crewStrip.cardHitAreas.find((a) => pointer.x >= a.xMin && pointer.x <= a.xMax);
    if (hit) {
      this.interaction.selectActor(hit.actorId);
      this.updateSelectedActorHighlight();
      this.redrawCrewStrip();
      this.redrawQueuePanel();
    }
    return true;
  }

  /** Cancelar tarea por hit-test sobre el "×" de una fila de la cola. Devuelve `true` si consumió. */
  private handleQueueCancelClick(pointer: Phaser.Input.Pointer): boolean {
    if (!this.queuePanel || !this.isOverQueue(pointer)) return false;
    // Coord de contenido = pantalla menos el tope de la caja + el scroll aplicado.
    const localY = pointer.y - this.queuePanel.contentTop + this.queueScrollY;
    const hit = this.queuePanel.cancelHitAreas.find(
      (a) => localY >= a.yTop && localY <= a.yBottom && pointer.x >= a.xMin && pointer.x <= a.xMax,
    );
    if (hit) {
      this.mission.scheduler.cancel(hit.taskId, { dtSeconds: 0, elapsedSeconds: this.mission.coreLoop.elapsed });
      this.redrawQueuePanel();
    }
    return true;
  }

  // --- Resaltado de hover -------------------------------------------------

  /** Reposiciona/oculta el resaltado de la celda bajo el cursor; solo visible sobre celdas interactuables del mapa. */
  private updateHoverHighlight(pointer: Phaser.Input.Pointer): void {
    if (!this.hoverHighlight) return;
    if (this.briefingOpen || this.objectivesOpen || this.interaction.installPickerOpen || this.isOverFixedUi(pointer)) {
      this.hoverHighlight.setVisible(false);
      this.hoverCell = undefined;
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell: GridPosition = { x: Math.floor(worldPoint.x / CELL), y: Math.floor(worldPoint.y / CELL) };
    if (this.hoverCell && this.hoverCell.x === cell.x && this.hoverCell.y === cell.y) return;
    this.hoverCell = cell;
    if (!this.interaction.isCellInteractable(cell)) {
      this.hoverHighlight.setVisible(false);
      return;
    }
    this.hoverHighlight.setPosition(cell.x * CELL, cell.y * CELL).setVisible(true);
  }

  /**
   * Cursor contextual reactivo (12c.3): elige el sprite del puntero según la
   * acción válida bajo el ratón. Escucha el estado del `MissionInteractionController`
   * (`wireMode`, `isCellInteractable`, `tooltipContentAt`) — la escena resuelve
   * la celda de mundo (el controller no conoce coords de pantalla, por diseño).
   * Sobre UI fija / modal cede al cursor por defecto (los botones imponen su
   * propia mano). `CustomCursor.set` deduplica, así que llamarlo cada
   * `pointermove` no reescribe el cursor salvo que el tipo cambie.
   */
  private updateCursor(pointer: Phaser.Input.Pointer): void {
    if (!this.customCursor) return;
    if (this.briefingOpen || this.objectivesOpen || this.interaction.installPickerOpen || this.isOverFixedUi(pointer)) {
      this.customCursor.set("default");
      return;
    }
    if (this.interaction.wireMode) {
      this.customCursor.set("wire");
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell: GridPosition = { x: Math.floor(worldPoint.x / CELL), y: Math.floor(worldPoint.y / CELL) };
    const content = this.interaction.tooltipContentAt(cell);
    if (content?.kind === "instance") {
      // Hay una pieza bajo el cursor: se puede operar sobre ella (desmontar, etc.).
      this.customCursor.set("dismantle");
      return;
    }
    this.customCursor.set(this.interaction.isCellInteractable(cell) ? "selectable" : "default");
  }

  /**
   * Muestra la ficha rica (nombre, ícono de condición, propiedades,
   * composición) de la pieza/zona bajo el cursor (rework post-playtest de
   * Fase 11d: antes solo mostraba el nombre y el resto de la info quedaba
   * detrás de un click). Prioridad del componente sobre la sección (lo
   * resuelve el controller, `tooltipContentAt`). El tooltip es objeto de HUD,
   * así que se posiciona en coords de pantalla (`pointer.x/y`), desplazado
   * del cursor y clampeado para no invadir la franja lateral ni salirse por
   * abajo. Se redibuja solo al cambiar de celda (evita reconstruir el
   * `Container` en cada `pointermove` dentro de la misma celda).
   */
  private updateTooltip(pointer: Phaser.Input.Pointer): void {
    if (this.briefingOpen || this.objectivesOpen || this.interaction.installPickerOpen || this.isOverFixedUi(pointer)) {
      this.hideTooltip();
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell: GridPosition = { x: Math.floor(worldPoint.x / CELL), y: Math.floor(worldPoint.y / CELL) };
    const content = this.interaction.tooltipContentAt(cell);
    if (!content) {
      this.hideTooltip();
      return;
    }
    if (!this.tooltip || this.tooltipCell?.x !== cell.x || this.tooltipCell?.y !== cell.y) {
      this.tooltip?.destroy(true);
      this.tooltip = renderMissionTooltip(this.rex, content, {
        functionalDescription: (tag) => t(`component.functional.${tag}`),
        structuralResistance: (level) => t(`component.material.re.${STRUCTURAL_RESISTANCE_LEVEL_KEY[level]}`),
        wearTag: (wear) => t(`component.wear.${wear}`),
        structuralFailure: t("component.material.re.fallo"),
        compositionTitle: t("ui.floorplan.mission.composition-title"),
      }).setDepth(RENDER_DEPTH.hudContent);
      this.markAsHudObject(this.tooltip);
      this.tooltipCell = cell;
    }
    this.tooltip.setVisible(true);
    const bounds = this.tooltip.getBounds();
    // ARRIBA del cursor por defecto (12c.7, obs #1): el cursor custom (más grande)
    // tapaba el tooltip cuando iba debajo. Gap vertical amplio para librar el
    // sprite del cursor; se voltea hacia abajo solo si se saldría por arriba.
    const GAP_Y = 22;
    let x = pointer.x + 14;
    let y = pointer.y - GAP_Y - bounds.height;
    if (x + bounds.width > SIDE_PANEL_X - 10) x = pointer.x - 14 - bounds.width;
    if (y < HEADER_HEIGHT + 4) y = pointer.y + GAP_Y;
    this.tooltip.setPosition(x, y);
  }

  private hideTooltip(): void {
    this.tooltip?.setVisible(false);
  }

  /**
   * Resalta los nodos de señal clickeables mientras el modo cableado está activo
   * (playtest #15): un anillo por nodo, y uno DISTINTO (relleno + más grueso)
   * sobre el nodo origen ya elegido. Se destruye/reconstruye por completo en cada
   * cambio (mismo patrón que el resto de overlays). Objetos de mundo (panean/
   * escalan con el mapa), por encima de las paredes para que siempre se vean.
   */
  private updateWireHighlights(): void {
    for (const ring of this.wireNodeHighlights) ring.destroy();
    this.wireNodeHighlights = [];
    if (!this.interaction.wireMode) return;

    const sourceId = this.interaction.wireFirstNode;
    for (const node of this.mission.blueprint.signalGraph.nodes) {
      const center = this.cellCenterPx(node.position);
      const isSource = node.id === sourceId;
      const ring = this.add
        .circle(center.x, center.y, isSource ? 13 : 11)
        .setStrokeStyle(isSource ? 4 : 2, WIRE_HIGHLIGHT_COLOR, 1)
        .setFillStyle(WIRE_HIGHLIGHT_COLOR, isSource ? 0.3 : 0)
        .setDepth(RENDER_DEPTH.problemMarker);
      this.markAsWorldObject(ring);
      this.wireNodeHighlights.push(ring);
    }
  }

  /**
   * Reconstruye el resaltado persistente de la selección (bug 6): con picker
   * de instalación abierto, un rectángulo por celda del footprint completo de
   * la opción enfocada (`installPickerHighlightCells`); si no, una única
   * celda (`selectedCell`), mismo comportamiento de siempre. Se destruye y
   * redibuja por completo en cada cambio (mismo patrón que `updateWireHighlights`).
   */
  private updateSelectedHighlight(): void {
    for (const rect of this.selectedHighlightCells) rect.destroy();
    this.selectedHighlightCells = [];

    const footprintCells = this.interaction.installPickerHighlightCells;
    const cells = footprintCells ?? (this.interaction.selectedCell ? [this.interaction.selectedCell] : []);
    for (const cell of cells) {
      const rect = this.add
        .rectangle(cell.x * CELL, cell.y * CELL, CELL, CELL)
        .setOrigin(0, 0)
        .setStrokeStyle(3, SELECTED_CELL_COLOR, 1)
        .setFillStyle(SELECTED_CELL_COLOR, 0.22)
        .setDepth(RENDER_DEPTH.hoverHighlight);
      this.markAsWorldObject(rect);
      this.selectedHighlightCells.push(rect);
    }
  }

  // --- Briefing de crisis -------------------------------------------------

  private showBriefingIfAny(): void {
    const briefingKey = this.mission.crisisDefinition.briefingKey;
    if (!briefingKey || this.mission.crisisState !== "active") {
      // Sin briefing pero con crisis activa, los barks se disparan igual (si no
      // está activa, `fireCrisisStartBarks` es no-op).
      this.fireCrisisStartBark();
      return;
    }
    this.briefingOpen = true;
    this.sound.play(pickSoundKey(AUDIO_KEYS.modalOpen), { volume: 0.5 });
    this.briefingContainer = renderMissionBriefingModal(
      this.rex,
      this.mission.crisisDefinition.name,
      t(briefingKey),
      t("ui.floorplan.mission.briefing.understood"),
      () => {
        this.sound.play(pickSoundKey(AUDIO_KEYS.modalClose), { volume: 0.5 });
        this.briefingContainer?.destroy(true);
        this.briefingContainer = undefined;
        this.briefingOpen = false;
        // Al cerrar el briefing: barks de `crisis-start` (para que no queden
        // detrás del modal).
        this.fireCrisisStartBark();
      },
    );
    this.briefingContainer.setDepth(RENDER_DEPTH.hudModal);
    this.markAsHudObject(this.briefingContainer);
  }

  /**
   * Bark de `crisis-start` (GDD 6.7.1) al arrancar la misión: UN solo tripulante
   * activo (al azar) reacciona a la alarma según su rasgo — no el lote entero,
   * que resultaba poco útil. Se dispara UNA vez por misión y solo si la crisis
   * está activa. No depende del evento `crisis-triggered` (se emite en el
   * constructor de `MissionRuntime`, antes de que la escena se suscriba, y el
   * `EventEmitter` no hace replay) — se lee `crisisState` directamente.
   */
  private fireCrisisStartBark(): void {
    if (this.barksCrisisStartFired || this.mission.crisisState !== "active") return;
    this.barksCrisisStartFired = true;
    const crew = this.mission.activeCrew;
    if (crew.length === 0) return;
    const actor = crew[Math.floor(Math.random() * crew.length)]!;
    const token = this.crewTokens.get(actor.id);
    if (token) this.barks.fire(actor, "crisis-start", token.dot.x, token.dot.y);
  }

  /** Dispara un bark de `eventType` para el tripulante, ubicado sobre su token. */
  private barkForActor(actorId: CrewActorId, eventType: BarkEventType): void {
    const actor = this.mission.activeCrew.find((candidate) => candidate.id === actorId);
    const token = this.crewTokens.get(actorId);
    if (actor && token) this.barks.fire(actor, eventType, token.dot.x, token.dot.y);
  }

  // --- Marcador visual del problema ----------------------------------------

  private initProblemMarker(): void {
    const position = this.mission.problemMarkerPosition;
    if (!position) return;
    const marker = this.add
      .circle((position.x + 0.5) * CELL, (position.y + 0.5) * CELL, CELL * 0.7)
      .setStrokeStyle(3, SEALED_VALVE_COLOR, 1)
      .setFillStyle(SEALED_VALVE_COLOR, 0)
      .setDepth(RENDER_DEPTH.problemMarker);
    this.markAsWorldObject(marker);
    this.tweens.add({
      targets: marker,
      alpha: { from: 1, to: 0.25 },
      scale: { from: 0.85, to: 1.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.problemMarker = marker;
    this.updateProblemMarkerVisibility();
  }

  private updateProblemMarkerVisibility(): void {
    this.problemMarker?.setVisible(this.mission.crisisState === "active");
  }

  /**
   * Al resolverse la crisis: cierra el bucle de meta-juego (10f). En orden:
   *  1. escribe el estado vivo de la misión (nave modificada + tripulación) de
   *     vuelta al save (`toUpdatedSave`);
   *  2. si fue éxito, avanza `chapterProgress` (completa el capítulo, apunta al
   *     siguiente y siembra su disparador — `advanceChapterProgress`);
   *  3. deja ese save como partida activa y lo autosalva a disco (en éxito Y en
   *     fallo — el estado de la nave siempre persiste al terminar la crisis; un
   *     fallo simplemente no avanza de capítulo);
   *  4. guarda el outcome real para la pantalla de resultado;
   *  5. transiciona.
   */
  private goToCrisisResult(resolution: "resolved-success" | "resolved-failure" | "resolved-partial"): void {
    if (this.crisisResultShown) return;
    this.crisisResultShown = true;
    const base = campaignSession.current;
    if (base) {
      const resolvedChapterId = this.mission.crisisDefinition.id;
      let updated = this.mission.toUpdatedSave(base);
      if (resolution === "resolved-success") {
        updated = advanceChapterProgress(updated, resolvedChapterId);
      }
      campaignSession.load(updated);
      void saveCampaignSave(updated);
      setPendingCrisisOutcome(buildCrisisOutcome(updated, resolution, resolvedChapterId));
    }
    if (metaGameStateMachine.canTransition("crisis-result")) {
      metaGameStateMachine.transition("crisis-result");
    }
  }

  // --- Header / botones -------------------------------------------------

  private updateHeader(): void {
    const stateKey = `ui.floorplan.mission.crisis-state.${this.mission.crisisState}`;
    this.headerText?.setText(`${this.mission.crisisDefinition.name} — ${t(stateKey)}`);
    this.updateModeBadge();
  }

  /**
   * Cuenta regresiva del temporizador de crisis (cap. 2): `restante = deadline -
   * elapsed` del core loop. Calmo con margen, ámbar al entrar en la ventana de
   * castigo (`hazard.startFraction`), rojo + parpadeo cuando quedan ≤10s. Oculto
   * si la crisis no tiene timer (cap. 1) o ya no está activa.
   */
  private updateTimer(nowMs: number): void {
    if (!this.timerText) return;
    const timer = this.mission.crisisDefinition.timer;
    if (!timer || this.mission.crisisState !== "active") {
      this.timerText.setVisible(false);
      this.timerPill?.setVisible(false);
      return;
    }
    const elapsed = this.mission.coreLoop.elapsed;
    const remaining = Math.max(0, Math.ceil(timer.softDeadlineSeconds - elapsed));
    const hazardStart = this.mission.crisisDefinition.hazard?.startFraction ?? 0.75;
    const inHazardWindow = elapsed / timer.softDeadlineSeconds >= hazardStart;
    const danger = remaining <= 10;
    const color = danger
      ? TIMER_TEXT_COLORS.danger
      : inHazardWindow
        ? TIMER_TEXT_COLORS.warning
        : TIMER_TEXT_COLORS.calm;
    // Parpadeo por tiempo (sin tween que administrar) solo en la zona roja.
    const alpha = danger ? 0.55 + 0.45 * Math.abs(Math.sin(nowMs / 200)) : 1;
    this.timerText
      .setVisible(true)
      .setText(`⏱ ${t("ui.floorplan.mission.time-left")} ${remaining}s`)
      .setColor(color)
      .setAlpha(alpha);
    // La píldora acompaña visibilidad/parpadeo y tiñe su borde con el color de urgencia.
    this.timerPill?.setVisible(true).setAlpha(0.72 * alpha).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 1);
  }

  /**
   * Badge de modo del core loop (ajuste post-playtest #4): pill de color
   * sólido + icono, con pulso en `execution` — el estado pausa/ejecución debe
   * notarse de un vistazo, no depender del label chico del botón. Reconstruido
   * en cada cambio de modo, mismo ciclo de vida que el resto del HUD.
   */
  private updateModeBadge(): void {
    if (this.modeBadge) {
      this.tweens.killTweensOf(this.modeBadge);
      this.modeBadge.destroy(true);
    }
    const mode = this.mission.coreLoop.mode;
    const color = CORE_LOOP_MODE_COLORS[mode];
    this.mapBorder?.setStrokeStyle(3, color, 1);

    const icon = mode === "execution" ? "▶" : "⏸";
    const label = `${icon} ${t(`ui.floorplan.mission.mode.${mode}`)}`;
    const badge = this.add.container(8, HEADER_HEIGHT / 2);
    const bg = this.add.rectangle(0, 0, 134, 24, color, 1).setOrigin(0, 0.5);
    const text = this.add
      .text(67, 0, label, { fontFamily: "monospace", fontSize: "12px", color: "#0a0a0f" })
      .setOrigin(0.5, 0.5);
    badge.add([bg, text]);
    badge.setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(badge);
    if (mode === "execution") {
      this.tweens.add({
        targets: badge,
        alpha: { from: 1, to: 0.55 },
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    this.modeBadge = badge;
  }

  private setStatus(text: string): void {
    this.statusText?.setText(text);
  }

  private updatePlayPauseButton(): void {
    (this.playPauseButton as Phaser.GameObjects.GameObject | undefined)?.destroy();
    const isExecuting = this.mission.coreLoop.mode === "execution";
    this.playPauseButton = createKenneyButton(
      this.rex,
      PLAY_PAUSE_BUTTON_X,
      HEADER_HEIGHT / 2,
      t(isExecuting ? "ui.floorplan.mission.pause" : "ui.floorplan.mission.play"),
      {
        width: 140,
        height: 30,
        fontSize: "12px",
        onClick: () => {
          if (this.mission.coreLoop.mode === "execution") {
            this.mission.coreLoop.pause();
          } else {
            this.mission.coreLoop.play();
          }
          this.updatePlayPauseButton();
        },
      },
    ).setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.playPauseButton);
  }

  private updateWireModeButton(): void {
    (this.wireModeButton as Phaser.GameObjects.GameObject | undefined)?.destroy();
    this.wireModeButton = undefined;
    // Mismo casillero de cabecera que el botón de cancelar trasvase (ronda 7)
    // — son modos mutuamente excluyentes, así que solo uno se dibuja a la vez.
    if (this.interaction.transferMode) return;
    this.wireModeButton = createKenneyButton(
      this.rex,
      WIRE_MODE_BUTTON_X,
      HEADER_HEIGHT / 2,
      t(this.interaction.wireMode ? "ui.floorplan.mission.wire-mode-active" : "ui.floorplan.mission.wire-mode"),
      {
        width: 180,
        height: 30,
        fontSize: "11px",
        onClick: () => this.interaction.toggleWireMode(),
      },
    ).setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.wireModeButton);
  }

  /**
   * Botón "Cancelar trasvase" (13e ronda 7) — visible solo mientras el modo de
   * selección espacial está activo, mismo casillero que `wireModeButton`.
   */
  private updateTransferModeButton(): void {
    (this.transferModeButton as Phaser.GameObjects.GameObject | undefined)?.destroy();
    this.transferModeButton = undefined;
    if (!this.interaction.transferMode) return;
    this.transferModeButton = createKenneyButton(
      this.rex,
      WIRE_MODE_BUTTON_X,
      HEADER_HEIGHT / 2,
      t("ui.floorplan.mission.transfer-mode-cancel"),
      {
        width: 180,
        height: 30,
        fontSize: "11px",
        onClick: () => this.interaction.cancelTransferMode(),
      },
    ).setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.transferModeButton);
  }

  /**
   * Punto de entrada único del modo de trasvase (13e ronda 7): se llama al
   * entrar/salir del modo y cada vez que cambian sus candidatos. Reconstruye
   * botón, oscurecido, resaltados y fuerza/restaura la capa `fluido` —
   * mismo criterio de "destruir y reconstruir por completo" que el resto de
   * overlays de un solo estado (`updateWireHighlights`).
   */
  private updateTransferMode(): void {
    this.updateWireModeButton();
    this.updateTransferModeButton();

    this.transferDimOverlay?.destroy();
    this.transferDimOverlay = undefined;
    for (const ring of this.transferHighlights) ring.destroy();
    this.transferHighlights = [];
    this.transferChannelLine?.destroy();
    this.transferChannelLine = undefined;
    this.transferFluidoHighlightLayer?.destroy();
    this.transferFluidoHighlightLayer = undefined;
    this.floorplanRender.conduitLayers.fluido.setVisible(true);

    if (!this.interaction.transferMode) {
      // Restaura el set COMPLETO de capas activas a como estaba antes de
      // entrar (ronda 9) — no solo `fluido`.
      if (this.transferModePriorActiveLayers) {
        this.activeFloorplanLayers = new Set(this.transferModePriorActiveLayers);
        for (const layer of FLOORPLAN_LAYER_IDS) this.applyLayerAlpha(layer);
      }
      this.transferModePriorActiveLayers = undefined;
      return;
    }

    // Oscurecido de TODO el plano (paredes/objetos/tripulación incluidos, tal
    // como pidió el operador) — un único rectángulo de mundo, por encima de
    // todo lo que hay que atenuar y por debajo de los resaltados.
    const worldWidth = this.mission.shipFloorplan.gridSize.width * CELL;
    const worldHeight = this.mission.shipFloorplan.gridSize.height * CELL;
    this.transferDimOverlay = this.add
      .rectangle(0, 0, worldWidth, worldHeight, 0x05060a, 0.72)
      .setOrigin(0, 0)
      .setDepth(RENDER_DEPTH.mapDimOverlay);
    this.markAsWorldObject(this.transferDimOverlay);

    // SOLO la capa `fluido` visible mientras dura el modo (SimCity-style,
    // ronda 9 — antes se AGREGABA `fluido` sin QUITAR las demás, así que
    // señal/ventilación/eléctrico se quedaban activas y sus tokens de flujo
    // seguían moviéndose por encima del oscurecido). Snapshot completo del set
    // previo para restaurarlo al salir.
    this.transferModePriorActiveLayers = new Set(this.activeFloorplanLayers);
    this.activeFloorplanLayers = new Set(["fluido"]);
    for (const layer of FLOORPLAN_LAYER_IDS) this.applyLayerAlpha(layer);

    // Fix del bug de depth #5 (ronda 8): `conduitLayers.fluido` vive dentro
    // del container `base`, que aplana el depth de sus hijos a `background` —
    // subir su `setDepth` no alcanza, el oscurecido lo sigue tapando. Se
    // oculta el original y se clona su dibujo en un `Graphics` top-level, por
    // encima del oscurecido.
    this.floorplanRender.conduitLayers.fluido.setVisible(false);
    this.transferFluidoHighlightLayer = this.add.graphics().setDepth(RENDER_DEPTH.transferHighlightedConduit);
    this.markAsWorldObject(this.transferFluidoHighlightLayer);
    for (const path of this.floorplanRender.conduitPaths) {
      if (path.conduit.kind !== "fluido") continue;
      drawConduitLine(this.transferFluidoHighlightLayer, path);
      drawConduitMarker(this.transferFluidoHighlightLayer, path.conduit);
    }

    // Un contorno de footprint por candidato (ronda 8: reemplaza el círculo
    // suelto — resalta la pieza misma, no un marcador flotando cerca). Verde
    // (disponible) o rojo (bloqueado, cualquier motivo) — mismo contrato de
    // color de crisis ya usado en el resto del juego.
    //
    // 12d.6 (playtest de 12d.5): el contorno va SIN relleno y el sprite del
    // candidato se REPITE por encima del oscurecido en vez de teñirse de color
    // plano. Antes el candidato quedaba doblemente tapado — por el oscurecido
    // del 72% (que desde 12d.5 ya no recuperan las luces, porque bajaron a
    // `dynamicLight`) y por su propio tinte plano encima.
    for (const candidate of this.interaction.transferModeCandidates) {
      const placement = this.instancePlacement(candidate.instanceId);
      if (!placement) continue;
      const { width, height } = effectiveFootprintExtent(placement);
      const originX = placement.position.x * CELL;
      const originY = placement.position.y * CELL;
      const color = candidate.blocked ? CRISIS_FATAL_COLOR : CRISIS_SAFE_COLOR;
      const outline = this.add
        .rectangle(originX, originY, width * CELL, height * CELL)
        .setOrigin(0, 0)
        .setStrokeStyle(3, color, 1)
        .setDepth(RENDER_DEPTH.transferTargetHighlight);
      this.markAsWorldObject(outline);
      this.transferHighlights.push(outline);

      for (const sprite of this.componentSprites.get(candidate.instanceId) ?? []) {
        this.transferHighlights.push(this.spriteCopyAboveDim(sprite));
      }
    }
  }

  /**
   * Copia top-level del sprite de un candidato, por encima del oscurecido del
   * modo de trasvase (12d.6).
   *
   * NO se puede subir el sprite original: vive dentro del container del overlay
   * (`mission-overlay-renderer.ts`, depth `objects`) y un container APLANA la
   * profundidad de sus hijos — está documentado en `render-depths.ts`. Es la
   * misma solución que ya usan el contorno y la capa `fluido` resaltada: dibujar
   * un objeto propio arriba, no reordenar el de abajo.
   *
   * La copia se pinta con el tinte BASE (sin el sombreado por luz), que es lo
   * que la hace legible sobre el oscurecido.
   */
  private spriteCopyAboveDim(sprite: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    const copy = this.add
      .image(sprite.x, sprite.y, sprite.texture.key)
      .setOrigin(sprite.originX, sprite.originY)
      .setDisplaySize(sprite.displayWidth, sprite.displayHeight)
      .setDepth(RENDER_DEPTH.transferTargetHighlight);
    const base = this.baseTintOf(sprite);
    if (base !== NEUTRAL_TINT) copy.setTint(base);
    this.markAsWorldObject(copy);
    return copy;
  }

  /**
   * Canal entre el reservorio origen y el candidato bajo el cursor (13e
   * ronda 7, ruteado real desde la ronda 8): sigue el camino de conductos
   * `fluido` disponibles (`computeConduitRoute`, mismo mecanismo que el
   * cableado de señal ruteado de la Fase 11f) en vez de una recta — el color
   * sigue comunicando "hay camino"/"no hay camino" según el mismo `blocked`
   * que decide el contorno del candidato. Un único `Graphics` reusado y
   * limpiado cada frame, mismo criterio liviano que el resto de overlays de
   * un solo objeto.
   */
  private updateTransferChannel(pointer: Phaser.Input.Pointer): void {
    if (!this.interaction.transferMode) return;
    if (!this.transferChannelLine) {
      this.transferChannelLine = this.add.graphics().setDepth(RENDER_DEPTH.transferTargetHighlight);
      this.markAsWorldObject(this.transferChannelLine);
    }
    this.transferChannelLine.clear();
    const originCell = this.interaction.transferModeOrigin && this.instanceCell(this.interaction.transferModeOrigin);
    if (!originCell) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hoverCell: GridPosition = { x: Math.floor(worldPoint.x / CELL), y: Math.floor(worldPoint.y / CELL) };
    // Ronda 9: compara contra la HUELLA completa (`occupiedCells`), no solo la
    // celda origen — antes el canal solo aparecía con el cursor exactamente
    // sobre la celda superior-izquierda de una pieza > 1×1, aunque el click en
    // cualquier celda de su sprite sí resolvía la acción (`findInstanceAtCell`
    // en el controller ya usaba la huella completa; acá faltaba igualar).
    const candidate = this.interaction.transferModeCandidates.find((entry) => {
      const placement = this.instancePlacement(entry.instanceId);
      if (!placement) return false;
      return occupiedCells(placement).some((cell) => cell.x === hoverCell.x && cell.y === hoverCell.y);
    });
    if (!candidate) return;
    const route = computeConduitRoute(this.mission.shipFloorplan, this.walkableGrid, originCell, hoverCell, "fluido");
    const color = candidate.blocked ? CRISIS_FATAL_COLOR : CRISIS_SAFE_COLOR;
    this.transferChannelLine.lineStyle(3, color, 0.9);
    if (route.length < 2) {
      const from = this.cellCenterPx(originCell);
      const to = this.cellCenterPx(hoverCell);
      this.transferChannelLine.lineBetween(from.x, from.y, to.x, to.y);
      return;
    }
    this.transferChannelLine.beginPath();
    this.transferChannelLine.moveTo(route[0]!.x, route[0]!.y);
    for (const point of route.slice(1)) this.transferChannelLine.lineTo(point.x, point.y);
    this.transferChannelLine.strokePath();
  }

  private createObjectivesButton(): void {
    this.objectivesButton = createKenneyButton(
      this.rex,
      OBJECTIVES_BUTTON_X,
      HEADER_HEIGHT / 2,
      t("ui.floorplan.mission.objectives"),
      {
        width: 150,
        height: 30,
        fontSize: "12px",
        onClick: () => this.toggleObjectivesPanel(),
      },
    ).setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.objectivesButton);
  }

  /** Botón "Capas" (Fase 11f) — abre/cierra el panel flotante de toggles, mismo patrón que `createObjectivesButton`/`toggleObjectivesPanel`. */
  private createLayersButton(): void {
    this.layersButton = createKenneyButton(this.rex, LAYERS_BUTTON_X, HEADER_HEIGHT / 2, t("ui.floorplan.mission.layers"), {
      width: 90,
      height: 30,
      fontSize: "12px",
      onClick: () => this.toggleLayerTogglePanel(),
    }).setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.layersButton);
  }

  private toggleLayerTogglePanel(): void {
    if (this.layerTogglePanel) {
      this.layerTogglePanel.destroy(true);
      this.layerTogglePanel = undefined;
      this.layerTogglePanelOpen = false;
      return;
    }
    this.renderLayerTogglePanel();
  }

  private renderLayerTogglePanel(): void {
    this.layerTogglePanel?.destroy(true);
    const container = this.add.container(0, 0).setDepth(RENDER_DEPTH.hudModal);

    const { panel } = createKenneyPanel(
      this,
      LAYER_PANEL_CENTER_X,
      LAYER_PANEL_CENTER_Y,
      LAYER_PANEL_WIDTH,
      LAYER_PANEL_HEIGHT,
    );
    container.add(panel);

    const rowWidth = FLOORPLAN_LAYER_IDS.length * 126 + (FLOORPLAN_LAYER_IDS.length - 1) * 6;
    container.add(
      renderFloorplanLayerTogglePanel(this.rex, {
        x: LAYER_PANEL_CENTER_X - rowWidth / 2 + 126 / 2,
        y: LAYER_PANEL_CENTER_Y,
        activeLayers: this.activeFloorplanLayers,
        onToggle: (layer) => this.toggleFloorplanLayer(layer),
      }),
    );

    this.markAsHudObject(container);
    this.layerTogglePanel = container;
    this.layerTogglePanelOpen = true;
  }

  /** Alterna una capa: opacidad de la línea estática Y del flujo animado se atenúan juntas — un único sistema de visibilidad, no dos paralelos (texto de la Fase 11f). */
  private toggleFloorplanLayer(layer: FloorplanLayerId): void {
    if (this.activeFloorplanLayers.has(layer)) {
      this.activeFloorplanLayers.delete(layer);
    } else {
      this.activeFloorplanLayers.add(layer);
    }
    this.applyLayerAlpha(layer);
    if (this.layerTogglePanelOpen) this.renderLayerTogglePanel();
    // "estructural" no dibuja nada (placeholder) — el label del botón se
    // quedó corto a propósito para no desbordar sobre el vecino, así que el
    // aviso "próximamente" se comunica acá en vez de en el texto del botón.
    if (layer === "estructural") this.setStatus(t("ui.floorplan.layer.estructural-hint"));
    // Fase 13b: el dial/inspector de energía solo se muestran con esta capa activa.
    if (layer === "energia") this.redrawEnergyControls();
  }

  private applyLayerAlpha(layer: FloorplanLayerId): void {
    const active = this.activeFloorplanLayers.has(layer);
    const alpha = active ? 1 : CONDUIT_LAYER_INACTIVE_ALPHA;
    this.floorplanRender.conduitLayers[layer].setAlpha(alpha);
    // El grafo de señal (nodos + cables) es parte de la capa `señales` (Fase 11f.3):
    // se atenúa con el mismo toggle, junto a los conductos `senal`.
    if (layer === "senal") this.signalGraphics?.setAlpha(alpha);
  }

  /**
   * Dial +1/-1 por sección (Fase 13b): visible solo con la capa "energia"
   * activa Y en modo pausa (mismo criterio de gating que `createWorkbenchButton`).
   * Se reconstruye bajo demanda (toggle de capa, cambio de modo, cada click
   * del propio dial) en vez de cada frame — a diferencia de los redibujos de
   * `Graphics` (baratos), estos son objetos interactivos reales.
   */
  private redrawEnergyControls(): void {
    for (const { outer, slider } of this.energyDialContainers.values()) {
      slider.destroy();
      outer.destroy();
    }
    this.energyDialContainers.clear();
    this.energyControlWorldBounds = [];

    const shouldShow = this.activeFloorplanLayers.has("energia") && this.mission.coreLoop.mode === "planning";
    if (!shouldShow) {
      this.closeEnergyPriorityPanel();
      return;
    }

    const totalBudget = this.mission.totalPowerBudget();
    // Sin presupuesto total (ningún arquetipo salvo Exploración por ahora), no
    // hay nada que repartir — no se dibuja ningún control.
    if (totalBudget <= 0) return;

    const bounds: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (const section of this.mission.shipFloorplan.sections) {
      const { x, y } = sectionCentroidPx(section);
      const units = this.mission.sectionPowerAllocation(section.id);
      const slider = renderPowerAllocationSlider(this, {
        x,
        y: y - 2,
        maxUnits: totalBudget,
        capUnits: units + this.unallocatedPowerUnits(),
        units,
        grantedUnits: this.mission.sectionPowerGranted(section.id),
        // Ancho útil del panel: la etiqueta se encoge sola si no entra (ronda 7,
        // "Sin energía libre" se desbordaba). Derivado de la MISMA constante que
        // el panel para no duplicar el número en dos archivos.
        maxLabelWidth: ENERGY_CONTROL_BOX.width - ENERGY_CONTROL_BOX.padding * 2,
        enabled: true,
        onChange: (nextUnits) => {
          this.mission.setSectionPowerUnits(section.id, nextUnits);
          this.syncEnergySliderCaps(section.id);
          // 13d (fix de playtest ronda 1): dejar una sección sin energía cambia
          // el riesgo de desmontar lo que hay dentro — el badge del panel de
          // acciones tiene que responder en el acto, no al reabrirlo.
          this.interaction?.refreshActionPanel();
        },
      });
      const priorityButton = createKenneyButton(
        this.rex,
        x,
        y + 22,
        t("ui.floorplan.layer.energia-priority-button"),
        {
          width: 90,
          height: 20,
          fontSize: "10px",
          onClick: () => this.openEnergyPriorityPanel(section.id),
        },
      );
      // Fondo del cluster (fix ronda 3): sueltos sobre el plano, slider y botón
      // se mezclaban con el mapa. Reutiliza el mismo `NineSlice` que el resto
      // de paneles del proyecto. Se inserta PRIMERO para quedar detrás.
      // Ronda 7: una copia oscura desplazada hace de sombra dura, para despegar
      // el cuadro del plano.
      const { panel: shadowPanel } = createKenneyPanel(
        this,
        x + ENERGY_CONTROL_BOX.offsetX + ENERGY_CONTROL_SHADOW.offsetX,
        y + ENERGY_CONTROL_BOX.offsetY + ENERGY_CONTROL_SHADOW.offsetY,
        ENERGY_CONTROL_BOX.width,
        ENERGY_CONTROL_BOX.height,
      );
      shadowPanel.setTint(0x000000).setAlpha(ENERGY_CONTROL_SHADOW.alpha);
      const { panel } = createKenneyPanel(
        this,
        x + ENERGY_CONTROL_BOX.offsetX,
        y + ENERGY_CONTROL_BOX.offsetY,
        ENERGY_CONTROL_BOX.width,
        ENERGY_CONTROL_BOX.height,
      );
      // Depth explícito (fix post-playtest): sin esto, el contenedor heredaba
      // el depth `background` (0) de `floorplanRender.base` y quedaba oculto
      // detrás de las sombras dinámicas/paredes/luces (`RENDER_DEPTH.effect`
      // es el mismo nivel que usan otros controles interactivos de mundo,
      // ej. `fireLocalStatic`). NO se reparenta a `floorplanRender.base`
      // (ese container fija el depth de TODOS sus hijos a `background`).
      const outer = this.add
        .container(0, 0, [shadowPanel, panel, slider.container, priorityButton])
        .setDepth(RENDER_DEPTH.effect);
      this.markAsWorldObject(outer);
      this.energyDialContainers.set(section.id, { outer, slider });
      // Mismo rectángulo que el panel de fondo — derivado de la MISMA constante
      // para que el fondo visible y la zona que bloquea el click de mapa no
      // puedan desincronizarse.
      bounds.push({
        x: x + ENERGY_CONTROL_BOX.offsetX - ENERGY_CONTROL_BOX.width / 2,
        y: y + ENERGY_CONTROL_BOX.offsetY - ENERGY_CONTROL_BOX.height / 2,
        width: ENERGY_CONTROL_BOX.width,
        height: ENERGY_CONTROL_BOX.height,
      });
    }
    this.energyControlWorldBounds = bounds;

    // Si el panel de prioridad de una sección estaba abierto y esa sección ya
    // no es visible (capa apagada/salió de pausa), cerrarlo con el resto.
    if (this.energyPriorityPanelSectionId) {
      this.openEnergyPriorityPanel(this.energyPriorityPanelSectionId);
    }
  }

  /** Unidades de energía sin asignar a ninguna sección (Fase 13b ronda 3, tope global del reparto). */
  private unallocatedPowerUnits(): number {
    const assigned = this.mission.shipFloorplan.sections.reduce(
      (sum, section) => sum + this.mission.sectionPowerAllocation(section.id),
      0,
    );
    return Math.max(0, this.mission.totalPowerBudget() - assigned);
  }

  /**
   * Reajusta el tope de los sliders de las OTRAS secciones tras un cambio de
   * asignación. No se reconstruyen los controles: eso destruiría el widget que
   * el jugador está arrastrando en ese mismo instante (la razón por la que en
   * la ronda 2 se quitó el rebuild-por-cambio).
   */
  private syncEnergySliderCaps(changedSectionId: SectionId): void {
    const remaining = this.unallocatedPowerUnits();
    for (const [sectionId, { slider }] of this.energyDialContainers) {
      // Lo otorgado se refresca en TODAS, incluida la que se está arrastrando:
      // resolver un déficit en una sección puede devolverle energía a otra.
      slider.setGranted(this.mission.sectionPowerGranted(sectionId));
      if (sectionId === changedSectionId) continue;
      slider.setCap(this.mission.sectionPowerAllocation(sectionId) + remaining);
    }
  }

  private closeEnergyPriorityPanel(): void {
    this.energyPriorityPanel?.destroy();
    this.energyPriorityPanel = undefined;
    this.energyPriorityPanelSectionId = undefined;
  }

  /** Inspector de prioridad de UNA sección (Fase 13b) — reordenar componentes ↑/↓ fija su prioridad de energía. */
  private openEnergyPriorityPanel(sectionId: SectionId): void {
    this.energyPriorityPanel?.destroy();
    this.energyPriorityPanelSectionId = sectionId;

    const order = this.mission.instancePowerPriorityOrder(sectionId);
    const rows = order.map((instanceId) => {
      const instance = this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === instanceId);
      const label = (instance && this.nameByComponentId.get(instance.componentDefinitionId as string)) ?? String(instanceId);
      return { instanceId, label, powered: this.mission.powerRuntime.isInstancePowered(instanceId) };
    });

    this.energyPriorityPanel = renderPowerPriorityList(
      this.rex,
      640,
      360,
      rows,
      {
        title: t("ui.floorplan.layer.energia-priority-title"),
        close: t("ui.floorplan.layer.energia-priority-close"),
        hint: t("ui.floorplan.layer.energia-priority-hint"),
      },
      (instanceId) => {
        this.mission.reorderInstancePriority(sectionId, instanceId, -1);
        this.openEnergyPriorityPanel(sectionId);
      },
      (instanceId) => {
        this.mission.reorderInstancePriority(sectionId, instanceId, 1);
        this.openEnergyPriorityPanel(sectionId);
      },
      () => this.closeEnergyPriorityPanel(),
    ).setDepth(RENDER_DEPTH.hudModal);
    this.markAsHudObject(this.energyPriorityPanel);
  }

  /**
   * Abre la mesa de creación como overlay sobre la misión pausada (11c.2). Solo
   * en planificación (el reloj congelado ya se garantiza en pausa, coherente con
   * la trayectoria fantasma de 11a.3) y con un tripulante seleccionado (es quien
   * paga el tiempo de fabricación). Al confirmar, la mesa entrega la creación:
   * se encola una tarea `combine` y la creación queda disponible para instalar
   * recién al completarse (materialización diferida, `MissionRuntime`).
   */
  private openWorkbench(stationInstanceId: PlacedComponentInstanceId): void {
    // Los dos guards siguen siendo la defensa en profundidad; lo que cambió en
    // 13e ronda 2 es CÓMO se comunica el rechazo. `setStatus` escribe una línea
    // discreta en el header que el jugador no mira al hacer clic en el plano,
    // así que el clic parecía no hacer nada. Ahora el botón ya avisa que hay
    // que pausar (`fabricatorBlocked`) y este camino, si se llega igual, lo
    // dice con una notificación.
    if (this.mission.coreLoop.mode !== "planning") {
      this.notifications?.push({
        title: t("ui.floorplan.mission.workbench-need-pause"),
        type: "warning",
      });
      return;
    }
    const actorId = this.interaction.selectedActorId;
    if (!actorId) {
      this.notifications?.push({
        title: t("ui.floorplan.mission.workbench-need-actor"),
        type: "warning",
      });
      return;
    }
    // Subfase 13e: la mesa se abre desde un APARATO del plano y entra directo
    // en su dominio — el toggle libre Física/Química desapareció, porque un
    // banco de trabajo no sintetiza sustancias ni al revés (Obs 4).
    const domain = this.mission.fabricatorDomainOfInstance(stationInstanceId);
    if (!domain) {
      return;
    }

    // Bloquea el input del plano mientras la mesa está encima, para que un click
    // sobre el fondo del modal no llegue al mapa de la misión de atrás.
    this.input.enabled = false;
    // Handoff de un solo uso (NO por `scene.data`, que Phaser retiene y filtraba
    // el contexto al modo creativo — ver `setPendingMissionWorkbenchContext`).
    setPendingMissionWorkbenchContext({
      domain,
      elementStockOf: (elementId: ChemicalSubstanceId) =>
        elementStockOf(this.mission.elementStock.get(), elementId),
      onFabricate: (definition: PhysicalComponentDefinition) => {
        this.mission.queueFabrication(actorId, definition, stationInstanceId);
        this.nameByComponentId.set(definition.id as string, definition.name);
        this.setStatus(t("ui.floorplan.mission.workbench-queued").replace("{name}", definition.name));
        this.redrawQueuePanel();
      },
      onSynthesize: (selectedElementIds: ReadonlyArray<ChemicalSubstanceId>) => {
        const name = this.mission.queueSynthesis(actorId, selectedElementIds, stationInstanceId);
        this.setStatus(
          name
            ? t("ui.floorplan.mission.workbench-synthesizing").replace("{name}", name)
            : t("ui.floorplan.mission.workbench-no-elements"),
        );
        this.redrawQueuePanel();
      },
      onPreviewSynthesis: (selectedElementIds: ReadonlyArray<ChemicalSubstanceId>) =>
        this.mission.previewSynthesis(selectedElementIds),
      onClose: () => {
        this.scene.stop(SCENE_KEYS.creativeWorkbench);
        this.scene.resume();
        this.input.enabled = true;
      },
    });
    this.scene.launch(SCENE_KEYS.creativeWorkbench);
    this.scene.pause();
  }

  /** Alterna el panel de objetivos (el briefing explicativo — el checklist ya está siempre visible en `objectivesStrip`). */
  private toggleObjectivesPanel(): void {
    if (this.objectivesPanel) {
      this.objectivesPanel.destroy(true);
      this.objectivesPanel = undefined;
      this.objectivesOpen = false;
      return;
    }
    this.renderObjectivesPanel();
  }

  private renderObjectivesPanel(): void {
    this.objectivesPanel?.destroy(true);
    const cx = 640;
    const cy = 360;
    const width = 540;
    const height = 260;
    const container = this.add.container(0, 0).setDepth(RENDER_DEPTH.hudModal);

    const { panel, title } = createKenneyPanel(this, cx, cy, width, height, t("ui.floorplan.mission.objectives-title"));
    container.add(panel);
    if (title) container.add(title);

    // Briefing en una caja scrolleable de alto fijo (recordar el objetivo, sin
    // desbordar el panel por más largo que sea el texto, playtest #16). El
    // checklist de bullets ya NO se repite acá (playtest de Fase 11d): vive
    // siempre visible en la columna lateral (`renderObjectivesStrip`).
    const briefingKey = this.mission.crisisDefinition.briefingKey;
    const briefingTop = cy - height / 2 + 52;
    const briefingHeight = 150;
    if (briefingKey) {
      container.add(
        createScrollableText(this.rex, cx, briefingTop + briefingHeight / 2, width - 40, briefingHeight, t(briefingKey), {
          fontSize: "13px",
          align: "left",
        }),
      );
    }

    const close = createKenneyButton(this.rex, cx, cy + height / 2 - 30, t("ui.floorplan.mission.objectives-close"), {
      width: 160,
      height: 30,
      fontSize: "12px",
      onClick: () => this.toggleObjectivesPanel(),
    });
    container.add(close);

    this.markAsHudObject(container);
    this.objectivesPanel = container;
    this.objectivesOpen = true;
  }

  /**
   * Franja compacta de bullets del checklist de objetivos, SIEMPRE visible en
   * la columna lateral (playtest de Fase 11d: antes había que abrir el modal
   * de "Objetivos" para ver el progreso, y no había ningún feedback al
   * completar uno). Se redibuja en cada `task-completed` (mismo punto donde
   * antes solo se refrescaba el modal si estaba abierto). Flashea en verde la
   * línea de cualquier objetivo que ACABA de pasar a cumplido — se detecta
   * comparando contra `objectivesDoneKeys` de la vez anterior.
   */
  private renderObjectivesStrip(): void {
    this.objectivesStrip?.destroy(true);
    const x = SIDE_PANEL_X - 10;
    const y = OBJECTIVES_STRIP_Y;
    const width = SIDE_PANEL_WIDTH;
    const container = this.add.container(0, 0).setDepth(RENDER_DEPTH.hudContent);

    container.add(
      this.add
        .rectangle(x, y - 8, width, OBJECTIVES_STRIP_HEIGHT, 0x0a0a0f, 0.72)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x2a3040, 1),
    );

    const statuses = this.mission.objectiveStatuses();
    const previouslyDone = this.objectivesDoneKeys;
    const nowDone = new Set<string>();
    const flashTargets: number[] = [];
    const newlyDoneLabels: string[] = [];
    let lineY = y;
    statuses.forEach((objective, index) => {
      const label = objective.objectiveKey ? t(objective.objectiveKey) : "";
      if (objective.done && objective.objectiveKey) nowDone.add(objective.objectiveKey);
      if (objective.done && objective.objectiveKey && !previouslyDone.has(objective.objectiveKey)) {
        flashTargets.push(lineY);
        newlyDoneLabels.push(label);
      }
      container.add(
        this.add
          .text(x + 10, lineY, `${objective.done ? "✓" : "○"}  ${label}`, {
            fontFamily: "sans-serif",
            fontSize: "11px",
            color: objective.done ? OBJECTIVE_DONE_COLOR : LABEL_COLOR,
            wordWrap: { width: width - 20 },
          })
          .setOrigin(0, 0),
      );
      lineY += 16;
      if (index < statuses.length - 1) lineY += 2;
    });
    this.objectivesDoneKeys = nowDone;

    // Notificar objetivos recién completados (12c.7), salvo en el primer render
    // (donde `previouslyDone` está vacío y marcaría como "nuevos" los ya cumplidos).
    if (this.objectivesNotifyReady) {
      for (const label of newlyDoneLabels) {
        this.notifications?.push({ title: t("ui.floorplan.notification.objective-done"), lines: [label], type: "success" });
      }
    }
    this.objectivesNotifyReady = true;

    this.markAsHudObject(container);
    this.objectivesStrip = container;

    for (const flashY of flashTargets) {
      const flash = this.add
        .rectangle(x, flashY - 2, width, 18, 0x64dc78, 0.5)
        .setOrigin(0, 0)
        .setDepth(RENDER_DEPTH.hudContent);
      this.markAsHudObject(flash);
      this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    }
  }

  // --- Panel de cola de tareas -------------------------------------------

  /**
   * Etiqueta corta traducida por `TaskType` (fix de playtest de Fase 11e):
   * antes la cola mostraba el `TaskType` crudo (`"analyze-substance"`), el más
   * largo de todos — de punta a punta con el nombre del actor y la sección,
   * empujaba el sufijo de tiempo fuera del ancho visible de la fila.
   */
  private taskTypeLabel(type: TaskType): string {
    return t(`ui.floorplan.mission.queue.task-label.${type}`);
  }

  /**
   * Cola UNIFICADA (playtest #16b): todas las tareas de todos los tripulantes,
   * aplanadas en una sola lista en orden de encolado, cada una con el índice del
   * actor (para el chip de color) y si su actor está seleccionado. Se reconstruye
   * entera cada vez — objetos planos, baratos — porque el input (cancelar/scroll)
   * lo resuelve la escena por hit-test, no vive en las filas.
   */
  private redrawQueuePanel(): void {
    const selectedId = this.interaction.selectedActorId;
    const tasks: UnifiedQueueTask[] = [];
    this.mission.activeCrew.forEach((actor, index) => {
      for (const task of this.mission.scheduler.queueFor(actor.id)) {
        if (task.state === "completed") continue;
        tasks.push({
          taskId: task.id,
          actorIndex: index,
          actorName: actor.name,
          label: task.targetSectionId
            ? `${this.taskTypeLabel(task.type)} → ${task.targetSectionId}`
            : this.taskTypeLabel(task.type),
          state: task.state,
          estimatedDurationSeconds: task.estimatedDurationSeconds,
          elapsedSeconds: task.elapsedSeconds,
          selected: actor.id === selectedId,
        });
      }
    });

    if (this.queuePanel) {
      this.queuePanel.container.destroy(true);
      this.queuePanel.mask.destroy();
    }
    this.queuePanel = renderCrewQueue(
      this,
      QUEUE_BOX_X,
      QUEUE_BOX_Y,
      SIDE_PANEL_WIDTH,
      QUEUE_PANEL_HEIGHT,
      tasks,
      t("ui.floorplan.mission.empty-queue"),
    );
    this.queuePanel.container.setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.queuePanel.container);
    // Reaplica el scroll (clamp por si la lista se acortó) desplazando las filas.
    const maxScroll = Math.max(0, this.queuePanel.contentHeight - this.queuePanel.viewHeight);
    this.queueScrollY = Phaser.Math.Clamp(this.queueScrollY, 0, maxScroll);
    this.queuePanel.rowsContainer.y = this.queuePanel.contentTop - this.queueScrollY;
    this.updateSelectedActorHighlight();
  }

  /** Tira horizontal de tripulantes bajo el mapa; reconstrucción completa (objetos planos). */
  private redrawCrewStrip(): void {
    this.crewStrip?.container.destroy(true);
    // HP VIVO: se toma del `crewState` (mutado por las descargas del cap. 2),
    // cayendo al snapshot estático solo si por algún motivo falta. Se mapea
    // sobre `activeCrew` para preservar orden/índice (colores por tripulante).
    const liveCrew = this.mission.activeCrew.map(
      (actor) => this.mission.crewState.get(actor.id) ?? actor,
    );
    this.crewStrip = renderCrewStrip(
      this,
      0,
      CREW_STRIP_Y,
      MAP_VIEWPORT_WIDTH,
      CREW_STRIP_HEIGHT,
      liveCrew,
      this.interaction.selectedActorId,
    );
    this.crewStrip.container.setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(this.crewStrip.container);
  }

  /**
   * HUD de estado permanente de la nave (Subfase 11g) — se llama cada frame
   * desde `update()`, pero solo redibuja si el snapshot agregado cambió
   * (fracciones redondeadas a 2 decimales + cantidad de sustancias
   * disponibles) o si es el parpadeo de un indicador `critical` lo que hay
   * que animar; mismo criterio de throttle que `redrawUnpoweredSectionScar`
   * (parpadeo != reconstrucción completa de texto/rects cada frame).
   */
  private redrawShipStatusHud(): void {
    const snapshot = this.mission.shipStatus;
    const substancesCount = this.mission.availableSubstances.length;
    const hasCritical =
      snapshot.atmosphere.level === "critical" ||
      snapshot.lifeSupport.level === "critical" ||
      snapshot.hullIntegrity.level === "critical" ||
      snapshot.energy.level === "critical";
    const key = hasCritical
      ? undefined // un indicador crítico parpadea — siempre redibuja para animar el alpha.
      : [snapshot.atmosphere, snapshot.lifeSupport, snapshot.hullIntegrity, snapshot.energy]
          .map((indicator) => `${indicator.level}:${indicator.fraction.toFixed(2)}`)
          .concat(String(substancesCount))
          .join("|");
    if (key !== undefined && key === this.shipStatusRedrawKey) return;
    this.shipStatusRedrawKey = key;

    this.shipStatusHudContainer?.destroy(true);
    this.shipStatusHudContainer = renderShipStatusHud(
      this.rex,
      SIDE_PANEL_X,
      SHIP_STATUS_HUD_Y,
      SIDE_PANEL_WIDTH - 20,
      SHIP_STATUS_HUD_HEIGHT,
      snapshot,
      substancesCount,
      {
        atmosphere: t("ui.floorplan.hud.atmosphere"),
        lifeSupport: t("ui.floorplan.hud.life-support"),
        hullIntegrity: t("ui.floorplan.hud.hull-integrity"),
        energy: t("ui.floorplan.hud.energy"),
        substancesButton: (count) => t("ui.floorplan.hud.substances-button").replace("{count}", String(count)),
      },
      { onOpenSubstances: () => this.interaction.openSubstancesList() },
      this.time.now / 1000,
    );
    this.markAsHudObject(this.shipStatusHudContainer);
  }

  /** Ajusta el scroll de la cola (rueda sobre su caja) y desplaza las filas. */
  private scrollQueue(deltaY: number): void {
    if (!this.queuePanel) return;
    const maxScroll = Math.max(0, this.queuePanel.contentHeight - this.queuePanel.viewHeight);
    this.queueScrollY = Phaser.Math.Clamp(this.queueScrollY + (deltaY > 0 ? 24 : -24), 0, maxScroll);
    this.queuePanel.rowsContainer.y = this.queuePanel.contentTop - this.queueScrollY;
  }

  /** Muestra el anillo de selección solo en el token del actor seleccionado en el panel (playtest #11). */
  private updateSelectedActorHighlight(): void {
    const selectedId = this.interaction.selectedActorId;
    for (const [actorId, token] of this.crewTokens) {
      token.selectionRing.setVisible(actorId === selectedId);
    }
  }

  // --- Overlay dinámico (componentes + señales) ---------------------------

  private redrawOverlay(): void {
    this.overlayContainer?.destroy(true);
    // Fase 11f: pasar plano + grilla para que un cable de señal cross-section
    // se dibuje ruteado por los conductos `senal`, no en recta.
    const overlay = renderMissionOverlay(
      this,
      this.mission.blueprint,
      this.mission.shipFloorplan,
      this.walkableGrid,
      // Deuda #8 (12c.5): resolver de definición para dibujar creaciones con los
      // sprites reales de sus partes en vez del rectángulo placeholder.
      (id) => this.mission.definitionOf(id),
    );
    this.overlayContainer = overlay.container;
    this.signalGraphics = overlay.signalGraphics;
    this.ledIndicators = overlay.ledIndicatorsByInstanceId;
    this.lcdDisplays = overlay.lcdDisplaysByInstanceId;
    this.componentSprites = overlay.componentSpritesByInstanceId;
    this.markAsWorldObject(this.overlayContainer);
    // El grafo de señal (nodos + cables) es la capa `señales` (Fase 11f.3): al
    // reconstruirse el overlay reaplica el estado actual del toggle.
    this.applyLayerAlpha("senal");
  }

  // --- Proyectiles ferromagnéticos y trayectoria fantasma (Fase 11a.3) ----

  /**
   * Detecta una promoción NUEVA a proyectil suelto (`LooseFerromagneticPromoter`, dentro del mismo tick
   * que instala la pieza) y fuerza un `redrawOverlay()` para borrar el sprite fantasma que quedaría
   * pegado en la celda — el overlay solo se redibuja por defecto ante eventos de tarea (`task-completed`),
   * que ya corrieron ANTES de que el promoter la sacara de `placedComponents` en el mismo tick.
   */
  private syncNewlyPromotedProjectiles(): void {
    const currentRefs = this.mission.projectiles.all.map((state) => state.ref);
    const hasNewRef = currentRefs.some((ref) => !this.knownProjectileRefs.has(ref));
    this.knownProjectileRefs = new Set(currentRefs);
    if (hasNewRef) {
      this.redrawOverlay();
    }
  }

  /** Redibujo por frame en ejecución — la posición del proyectil es continua, no animada por evento discreto. */
  private redrawProjectileTokens(): void {
    this.projectileContainer?.destroy(true);
    this.projectileContainer = renderProjectileTokens(this, this.mission.projectiles.all, (ref) =>
      this.mission.loosePromoter.definitionIdForRef(ref),
    );
    this.markAsWorldObject(this.projectileContainer);
  }

  /** Calculado UNA vez al entrar en pausa táctica (ver `core-loop-mode-changed`), no por frame. */
  private redrawTrajectoryGhost(): void {
    this.trajectoryGhostContainer?.destroy(true);
    this.trajectoryGhostContainer = undefined;
    if (this.mission.coreLoop.mode !== "planning" || this.mission.projectiles.all.length === 0) {
      return;
    }
    const trajectories = this.mission.previewProjectileTrajectories();
    this.trajectoryGhostContainer = renderTrajectoryGhost(this, this.mission.projectiles.all, trajectories);
    this.markAsWorldObject(this.trajectoryGhostContainer);
  }

  /**
   * Celda donde ocurrió un evento cinético, para posicionar su efecto de
   * partículas. `magnetic-acceleration` referencia el proyectil directo
   * (`event.ref`); `kinetic-impact` referencia al blanco (`event.targetRef`),
   * que en producción es siempre un componente colocado — el motor todavía
   * no resuelve colisión contra tripulación por celda (ver
   * PENDIENTES_OBSERVACIONES.md).
   */
  private kineticEventPosition(event: KineticDomainEvent): GridPosition | undefined {
    if (event.kind === "magnetic-acceleration") {
      return this.mission.projectiles.stateOf(event.ref)?.position;
    }
    return this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === event.targetRef)?.placement
      .position;
  }

  // --- Atmósfera por sección (Fase 11b) ------------------------------------

  /**
   * `createGasLeakEffect`/`createFreezingEffect`/`createHeatVaporEffect`
   * (`atmosphere-state-effects.ts`) ya existían completos pero sin llamador
   * en misión real — el propio comentario del archivo deja anotado que
   * "quien llama a `update()`" queda pendiente. `MissionAtmosphereRuntime`
   * (Fase 11b) es el primer estado vivo que puede alimentarlos; un trío por
   * sección, arrancado una vez, actualizado cada frame en `update()`.
   */
  private initSectionAtmosphereEffects(): void {
    for (const section of this.mission.shipFloorplan.sections) {
      const position = sectionCentroidCell(section);
      const gasLeak = createGasLeakEffect(this.registerParticleEmitter);
      const gasLeakSound = createGasLeakSound();
      const freezing = createFreezingEffect(this.registerParticleEmitter);
      const heatVapor = createHeatVaporEffect(this.registerParticleEmitter);
      gasLeak.start(this, position);
      gasLeakSound.start(this);
      freezing.start(this, position);
      heatVapor.start(this, position);
      this.sectionAtmosphereEffects.set(section.id, { gasLeak, gasLeakSound, freezing, heatVapor });
    }
  }

  /**
   * Registra cada emisor que un efecto state-driven crea internamente: depth de
   * efecto + cámara de mundo (`markAsWorldObject`), igual que `fireFabricationEffect`.
   * Sin esto, la `hudCamera` los pinta sin scroll y las partículas no se ven en
   * el mapa (bug de doble-cámara). Arrow field para conservar `this` al pasarlo
   * como callback a los factories de efectos.
   */
  private readonly registerParticleEmitter = (emitter: Phaser.GameObjects.Particles.ParticleEmitter): void => {
    emitter.setDepth(RENDER_DEPTH.effect);
    this.markAsWorldObject(emitter);
  };

  /**
   * Mismo registro que `registerParticleEmitter`, para las `Image` sueltas de
   * los tokens viajeros de flujo de conducto (Fase 11f.5, `FlowTokenHook`) —
   * no son `ParticleEmitter`, pero necesitan el mismo depth + cámara de mundo.
   */
  private readonly registerFlowToken = (token: Phaser.GameObjects.Image): void => {
    token.setDepth(RENDER_DEPTH.effect);
    this.markAsWorldObject(token);
  };

  /**
   * Mismo registro que `registerParticleEmitter`, para las luces aditivas
   * persistentes (Fase 12a, `LightHook`) — un `PointLight` es tan susceptible
   * al bug de doble-cámara como un emisor de partículas.
   *
   * Depth `dynamicLight` (Fase 12d, cierre / Obs 16): la luz de ambientación se
   * pinta sobre el SUELO, por debajo de sprites y paredes. Vivía en `effect`
   * (7), encima de todo, y ese aditivo lavaba las piezas — lo que el operador
   * leyó como "los sprites no se ven afectados por la luz". Ahora el brillo del
   * sprite lo da su tinte (`applyLightShading`), no una luz encima.
   */
  private readonly registerLight: LightHook = (light: Phaser.GameObjects.PointLight): void => {
    light.setDepth(RENDER_DEPTH.dynamicLight);
    this.markAsWorldObject(light);
    // Toda luz dinámica proyecta sombras (Fase 12d): la capa de sombras la
    // enumera para recortar la oscuridad con su polígono de visibilidad.
    this.shadowLayer?.addLight(light);
  };

  /**
   * Registro de CUALQUIER objeto creado por un efecto de evento
   * (`fireEventEffect`). Cierra la deuda #16 y su generalización: hasta el
   * cierre de 12d, solo `salvage-hazard-effect.ts` pasaba este hook — el resto
   * de los 15 efectos del registro creaba sus emisores y luces sin cámara de
   * mundo ni depth, así que la `hudCamera` los repintaba fijos en pantalla
   * ("explosiones sueltas", como ya documentaba `handleCrewEvent`).
   *
   * El depth se fija solo para emisores y luces: un DECAL (charco, quemadura)
   * eligió a propósito su propia capa (`bloodDecal`, `substanceSpill`) y
   * subirlo a `effect` lo pondría por encima de las piezas y la tripulación.
   *
   * Una luz va por `registerBurstLight`, así el fogonazo de un incendio también
   * ILUMINA la sala y proyecta sombras mientras dura, igual que cualquier otra
   * luz del proyecto — antes quedaba fuera del sistema de sombras.
   */
  private readonly registerEffectObject = (obj: Phaser.GameObjects.GameObject): void => {
    if (obj instanceof Phaser.GameObjects.PointLight) {
      this.registerBurstLight(obj);
      return;
    }
    if (obj instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
      obj.setDepth(RENDER_DEPTH.effect);
    }
    this.markAsWorldObject(obj);
  };

  /** Opciones por defecto de todo efecto de evento disparado sobre el plano. */
  private readonly worldEffectOptions: EventEffectOptions = {
    onObjectCreated: (obj) => this.registerEffectObject(obj),
  };

  /**
   * Tinte PROPIO de cada objeto teñible del plano, antes de aplicarle la luz
   * (Fase 12d, cierre — Obs 16). Existe porque `setTint` es un recurso ya
   * disputado: lo escriben el tinte por `condition` del overlay, el estado
   * ON/OFF del LED, el resaltado del modo de trasvase y el color de personaje
   * de cada tripulante. Si el sombreado por luz escribiera directamente sobre
   * `setTint`, cada uno de esos caminos leería como "color original" un valor
   * YA sombreado y se irían pisando (el trasvase, además, quedaría invisible:
   * el frame siguiente lo sobreescribe).
   *
   * Regla: todos esos caminos escriben acá (`setBaseTint`); el ÚNICO que llama
   * a `setTint`/`setFillStyle` con el color final es `applyLightShading`.
   * `WeakMap` porque `redrawOverlay` destruye y re-crea los sprites.
   */
  private readonly baseTints = new WeakMap<Phaser.GameObjects.GameObject, number>();

  /**
   * Tinte base de un objeto. La primera vez que se lo ve, su tinte actual ES la
   * base (todavía no pasó por el sombreado) — así el tinte por `condition` que
   * fija `mission-overlay-renderer.ts` al crear el sprite se captura solo, sin
   * tener que cambiar la firma del renderer.
   */
  private baseTintOf(target: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle): number {
    const known = this.baseTints.get(target);
    if (known !== undefined) return known;
    const current =
      target instanceof Phaser.GameObjects.Rectangle
        ? target.fillColor
        : target.isTinted
          ? target.tintTopLeft
          : NEUTRAL_TINT;
    this.baseTints.set(target, current);
    return current;
  }

  /** Fija el tinte propio de un objeto. El color visible lo resuelve `applyLightShading`. */
  private setBaseTint(target: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, tint: number): void {
    this.baseTints.set(target, tint);
  }

  /** Pinta el color final = tinte base × nivel de luz de su celda. */
  private applyShadedTint(
    target: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
    level: number,
  ): void {
    const color = shade(this.baseTintOf(target), level);
    if (target instanceof Phaser.GameObjects.Rectangle) {
      target.setFillStyle(color, target.fillAlpha);
    } else {
      target.setTint(color);
    }
  }

  /**
   * Oscurece los sprites del plano según la luz que les llega (Fase 12d,
   * cierre — Obs 16). La RT de sombras vive DEBAJO de los sprites (criterio de
   * sombra top-down: oscurece el suelo, no el objeto que la proyecta), así que
   * sin este paso los componentes y la tripulación quedaban a brillo plano
   * constante, "pegados encima" del mapa, sin importar si su sección estaba
   * iluminada o a oscuras.
   *
   * Los niveles salen de `DynamicShadowLayer.lightGrid`, que usa la MISMA
   * geometría de oclusión que la RT que se acaba de pintar: un sprite no puede
   * quedar brillante dentro de una sombra dibujada.
   *
   * NO se sombrean las affordances de UI que viven sobre el mapa (resaltado de
   * hover, anillos de selección, marcador de problema, líneas de conducto): son
   * chrome, no objetos del mundo, y atenuarlas sería perder legibilidad justo
   * donde el jugador necesita ver (patrón 3 del checklist de playtest).
   */
  private applyLightShading(): void {
    if (!this.shadowLayer) return;
    // Modo de trasvase (12d.6): el oscurecido del 72% ya ES el atenuado que
    // pide ese modo; multiplicarlo además por el nivel de luz dejaba las piezas
    // al ~14% de brillo ("todos los componentes se ven super oscuros"). Se
    // devuelve todo a brillo pleno y se deja que el rectángulo haga su trabajo.
    if (this.interaction.transferMode) {
      this.clearLightShading();
      return;
    }
    const { width, height } = this.mission.shipFloorplan.gridSize;
    const grid = this.shadowLayer.lightGrid(width, height, CELL);
    this.forEachShadedTarget((target, isActor) => {
      const center = target.getCenter();
      const level = grid.levelAtPixel(center.x, center.y);
      // Tripulación y enemigos con PISO de brillo: un actor en una sala sin luz
      // se oscurece, pero nunca hasta volverse invisible o inclickeable.
      this.applyShadedTint(target, isActor ? actorLightLevel(level) : level);
    });
  }

  /**
   * Tecla de dev (F): dispara un `DomainEvent` de muestra en la celda
   * SELECCIONADA, ciclando el catálogo de `dev-event-samples.ts` en cada
   * pulsación (12d.6).
   *
   * Existe porque varios fenómenos del registro **no tienen todavía un llamador
   * real en partida** — combustión y neutralización dependen de
   * `CrisisDefinition.scriptedReactions`, que ningún capítulo autora (13a cableó
   * el runtime, nunca se autoró el contenido). Sin esto no hay forma de
   * provocarlos jugando, que es exactamente lo que reportó el operador.
   *
   * Pasa por el MISMO camino que la simulación real (`fireEventEffect` con
   * `worldEffectOptions` + `fireEventSound`); un atajo no verificaría nada. Y va
   * en esta escena y no en la galería porque el bug de doble-cámara solo se
   * manifiesta acá, donde conviven la cámara de mundo y la `hudCamera`.
   */
  /** Puntero del ciclo de la tecla F sobre `DEV_EVENT_SAMPLES`. */
  private devEventSampleIndex = 0;

  private fireDevEventSample(): void {
    const cell = this.interaction.selectedCell;
    if (!cell) {
      this.notifications?.push({ title: t("ui.floorplan.dev.no-cell"), type: "warning" });
      return;
    }
    const sample = DEV_EVENT_SAMPLES[this.devEventSampleIndex % DEV_EVENT_SAMPLES.length]!;
    this.devEventSampleIndex += 1;

    const event = sample.buildEvent();
    fireEventEffect(this, cell, event, this.worldEffectOptions);
    fireEventSound(this, event);
    // La etiqueta del fenómeno NO se traduce: es una herramienta de desarrollo,
    // y el catálogo la trae en un único idioma a propósito.
    this.notifications?.push({
      title: `${t("ui.floorplan.dev.fired")}: ${sample.label}`,
      type: "info",
    });
  }

  /**
   * Tecla de dev (H): provoca una explosión REAL en la sección de la celda
   * seleccionada (Subfase 13f).
   *
   * A diferencia de la tecla F —que dispara solo el efecto visual de una
   * muestra— esto emite un `CombustionEvent` por el emisor de reacciones del
   * motor, o sea que recorre el camino de producción entero: daña la vida de
   * la sección, puede colapsarla, abre la brecha, drena la presión, desgasta
   * la maquinaria y dispara las explosiones del colapso.
   *
   * Existe porque **ningún capítulo autorado tiene hoy un camino real para
   * dañar el casco**: `scriptedReactions` está vacío en todos, el único
   * escritor con camino jugable es el impacto cinético (que exige montar el
   * cañón de riel) y la corrosión no tiene sustancia `CORR` viva en ningún
   * lado. Sin esta tecla, los pasos de prueba manual de esta subfase serían
   * instrucciones imposibles de ejecutar.
   */
  private fireDevSectionDamage(): void {
    const cell = this.interaction.selectedCell;
    const section = cell && this.mission.sectionAt(cell);
    if (!section) {
      this.notifications?.push({ title: t("ui.floorplan.dev.no-cell"), type: "warning" });
      return;
    }
    this.mission.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "medium",
      sectionId: section.id,
      elapsedSeconds: this.mission.elapsedSeconds,
    });
  }

  /** Devuelve todo a brillo pleno (nivel 1). Ver `applyLightShading`. */
  private clearLightShading(): void {
    this.forEachShadedTarget((target) => this.applyShadedTint(target, 1));
  }

  /**
   * Lista única de objetos del plano que reciben el sombreado por luz, para que
   * `applyLightShading` y `clearLightShading` no puedan divergir. `isActor`
   * marca a los que llevan piso de brillo (tripulación y enemigos).
   */
  private forEachShadedTarget(
    visit: (target: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, isActor: boolean) => void,
  ): void {
    for (const sprites of this.componentSprites.values()) {
      for (const sprite of sprites) {
        if (sprite.active) visit(sprite, false);
      }
    }
    // Los LED tienen su propio mapa (el overlay los separa para poder
    // encenderlos/apagarlos), así que no entran por `componentSprites`.
    for (const led of this.ledIndicators.values()) {
      if (led.active) visit(led, false);
    }
    for (const { dot } of this.crewTokens.values()) {
      if (dot.active) visit(dot, true);
    }
    for (const { shape } of this.enemyTokens.values()) {
      if (shape.active) visit(shape, true);
    }
  }

  /**
   * Variante de `registerLight` para el fogonazo de un BURST (combustión,
   * electrocución): se queda en `RENDER_DEPTH.effect`, junto a las partículas
   * que acompaña — bajarlo a `dynamicLight` dejaría el destello detrás de su
   * propia llama y de las paredes. Igual proyecta sombras mientras dura.
   */
  private readonly registerBurstLight: LightHook = (light: Phaser.GameObjects.PointLight): void => {
    light.setDepth(RENDER_DEPTH.effect);
    this.markAsWorldObject(light);
    this.shadowLayer?.addLight(light);
  };

  private updateSectionAtmosphereEffects(deltaSeconds: number): void {
    for (const [sectionId, effects] of this.sectionAtmosphereEffects) {
      const atmosphere = this.mission.atmosphereRuntime.atmosphereOf(sectionId);
      const temperatureCelsius = atmosphere?.temperatureCelsius ?? 21;
      effects.freezing.update({ temperatureCelsius }, deltaSeconds);
      effects.heatVapor.update({ temperatureCelsius }, deltaSeconds);

      // Se pinta CUALQUIER sustancia en el aire, no solo la que hace daño
      // (13e ronda 2). Antes esto leía `contaminantAt`, que filtra a TOX/CORR:
      // verter o derramar agua era literalmente invisible aunque el motor la
      // tuviera en `atmosphere.gases`, y dos sustancias del mismo tag se veían
      // idénticas. El color sale ahora de la sustancia concreta.
      const airborne = this.mission.airborneSubstanceAt(sectionId);
      const concentration = airborne?.concentration ?? 0;
      effects.gasLeak.update(
        {
          concentration,
          tint: airborne
            ? chemicalSubstanceColor(airborne.substanceId, airborne.tags)
            : CLOUD_TINT["corrosive-exposure"],
        },
        deltaSeconds,
      );
      // El SONIDO sigue atado al contaminante peligroso: el siseo de fuga
      // tóxica es una alarma, y sonarla por vapor de agua sería mentir.
      effects.gasLeakSound.update({ concentration: this.mission.contaminantAt(sectionId)?.concentration ?? 0 });
    }
  }

  // --- Flujo animado en conductos (Fase 11f, GDD §10) ----------------------

  /**
   * Un `createConduitPathFlowEffect` por conducto, arrancado sobre la
   * polilínea ya calculada por `renderFloorplan` (`floorplanRender.conduitPaths`
   * — no se recalcula acá). Clave `${a}-${b}-${kind}`: `ConduitConnection` no
   * tiene id propio (ver deuda técnica registrada en `PENDIENTES_OBSERVACIONES.md`).
   */
  private initConduitFlowEffects(): void {
    for (const path of this.floorplanRender.conduitPaths) {
      const effect = createConduitPathFlowEffect(path.waypoints, this.registerFlowToken);
      effect.start(this, path.waypoints[0]!);
      this.conduitFlowEffects.set(conduitFlowKey(path.conduit), effect);
    }
  }

  /**
   * A diferencia de la línea estática del conducto (que solo se ATENÚA al
   * desactivar su capa, `CONDUIT_LAYER_INACTIVE_ALPHA` vía `applyLayerAlpha`),
   * el flujo animado se OCULTA por completo (`visible: false`) cuando su capa
   * está apagada — feedback del operador (Fase 11f.6): un flujo tenue pero
   * visible de una capa "apagada" confunde más que ayuda. El flujo interno
   * (spawn/avance) sigue corriendo oculto, ver `ConduitPathFlowState.visible`.
   */
  private updateConduitFlowEffects(deltaSeconds: number): void {
    const activeSignalSections = computeSectionSignalActivity(this.mission);
    for (const path of this.floorplanRender.conduitPaths) {
      const effect = this.conduitFlowEffects.get(conduitFlowKey(path.conduit));
      if (!effect) continue;
      const { active, intensity } = conduitFlowIntensity(path.conduit, this.mission, activeSignalSections);
      const visible = this.activeFloorplanLayers.has(path.conduit.kind);
      effect.update({ active, intensity, kind: path.conduit.kind, visible }, deltaSeconds);
    }
  }

  /**
   * A diferencia del flujo de los conductos FÍSICOS (arriba, uno por cruce de
   * pared del plano, fijo desde `create()`), el grafo de CABLES lo arma el
   * jugador en vivo (modo cableado, Fase 10) — un `createConduitPathFlowEffect`
   * por `SignalEdge` existente, sincronizado cada vez que el overlay se
   * redibuja (`redrawOverlay`, único punto donde `signalGraph.edges` puede
   * haber cambiado). Clave `edge.id` (a diferencia de los conductos físicos,
   * un `SignalEdge` SÍ tiene id propio). Reutiliza el MISMO
   * `createConduitPathFlowEffect`/`computeSignalWireRoute` que ya rutea el
   * cable estático por los conductos `senal` (Fase 11f) — mismo camino exacto
   * que ve el jugador, la animación no puede desviarse de la línea dibujada.
   */
  private syncSignalWireFlowEffects(): void {
    const nodeById = new Map(this.mission.blueprint.signalGraph.nodes.map((node) => [node.id, node]));
    const currentEdgeIds = new Set<SignalEdgeId>();
    for (const edge of this.mission.blueprint.signalGraph.edges) {
      currentEdgeIds.add(edge.id);
      if (this.signalWireFlowEffects.has(edge.id)) continue;
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) continue;
      const path = computeSignalWireRoute(this.mission.shipFloorplan, this.walkableGrid, from.position, to.position);
      if (path.length < 2) continue;
      const effect = createConduitPathFlowEffect(path, this.registerFlowToken);
      effect.start(this, path[0]!);
      this.signalWireFlowEffects.set(edge.id, effect);
    }
    // Cables removidos (dueño desmontado): detener y liberar su efecto.
    for (const [edgeId, effect] of this.signalWireFlowEffects) {
      if (currentEdgeIds.has(edgeId)) continue;
      effect.stop();
      this.signalWireFlowEffects.delete(edgeId);
    }
  }

  private updateSignalWireFlowEffects(deltaSeconds: number): void {
    const visible = this.activeFloorplanLayers.has("senal");
    for (const edge of this.mission.blueprint.signalGraph.edges) {
      const effect = this.signalWireFlowEffects.get(edge.id);
      if (!effect) continue;
      const { active, intensity } = signalWireFlowIntensity(edge, this.mission);
      effect.update({ active, intensity, kind: "senal", visible }, deltaSeconds);
    }
  }

  /**
   * Indicador LED (Subfase 11h): tinte por estado ON/OFF de su propio nodo
   * `REC` — se lee `signalRuntime.outputOf` cada tick (operación barata, sin
   * acumulador) porque, a diferencia del LCD, un tinte binario no necesita
   * throttle para leerse bien.
   */
  private updateLedIndicators(): void {
    if (this.ledIndicators.size === 0) return;
    const nodeByOwner = new Map(
      this.mission.blueprint.signalGraph.nodes
        .filter((node) => node.role === "receptor")
        .map((node) => [node.ownerRef, node]),
    );
    for (const [instanceId, sprite] of this.ledIndicators) {
      const node = nodeByOwner.get(instanceId);
      const active = node ? this.mission.signalRuntime.outputOf(node.id) : false;
      const color = active ? LED_ACTIVE_TINT : LED_INACTIVE_TINT;
      // Tinte BASE, no el visible: el color final (base × luz de la celda) lo
      // pinta `applyLightShading` — ver `baseTints`.
      this.setBaseTint(sprite, color);
      this.syncLedLight(instanceId, sprite, active);
    }
  }

  /**
   * El LED encendido emite una luz real (Fase 12d): antes solo cambiaba de
   * tinte. Al encender crea una `PointLight` (registrada vía `registerLight`,
   * así entra al sistema de sombras); al apagar la destruye. Consecuente con
   * el resto de luces del proyecto — un `PointLight` autocontenido, sin setup.
   */
  private syncLedLight(
    instanceId: PlacedComponentInstanceId,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
    active: boolean,
  ): void {
    const existing = this.ledLights.get(instanceId);
    if (active && !existing) {
      // El sprite del LED es `setOrigin(0,0)` (su x/y es la esquina sup-izq),
      // así que la luz se centra sobre el sprite con medio display size.
      const cx = sprite.x + sprite.displayWidth / 2;
      const cy = sprite.y + sprite.displayHeight / 2;
      const light = createDynamicLight(this, cx, cy, LED_ACTIVE_TINT, LED_LIGHT_RADIUS_PX, LED_LIGHT_INTENSITY, this.registerLight);
      this.ledLights.set(instanceId, light);
    } else if (!active && existing) {
      existing.destroy();
      this.ledLights.delete(instanceId);
    }
  }

  /**
   * Pantalla LCD (Subfase 11h, doc fuente §2): valor real resuelto por
   * `resolveLcdDisplayValue` (canal de lectura directa, no el booleano del
   * grafo de señales), con throttle propio (`lcdRedrawAccumulatorMs`) para no
   * reformatear texto cada frame — mismo criterio que `queueRedrawAccumulatorMs`.
   */
  private updateLcdDisplays(deltaSeconds: number): void {
    if (this.lcdDisplays.size === 0) return;
    this.lcdRedrawAccumulatorMs += deltaSeconds * 1000;
    if (this.lcdRedrawAccumulatorMs < 300) return;
    this.lcdRedrawAccumulatorMs = 0;
    const atmosphereOf = (sectionId: SectionId) => this.mission.atmosphereRuntime.atmosphereOf(sectionId);
    for (const [instanceId, text] of this.lcdDisplays) {
      const value = resolveLcdDisplayValue(this.mission.blueprint, this.mission.shipFloorplan, instanceId, atmosphereOf);
      if (!value) {
        text.setText(t("ui.floorplan.lcd.no-data"));
        continue;
      }
      text.setText(`${value.pressureKpa.toFixed(1)} ${t("ui.floorplan.lcd.pressure-unit")}`);
    }
  }

  /**
   * Cicatriz visual de "sección sin energía" (Fase 11b, decisión del
   * operador; desacoplada de `unpoweredSectionIds` en la ronda 2 de playtest
   * de 13b): tinte EXCLUSIVO (`UNPOWERED_SECTION_TINT`, nunca reutilizado)
   * más un parpadeo sinusoidal continuo (`sectionScarFlickerAlpha`) — ninguno
   * de los dos solo alcanzaría el principio 6 (un tinte fijo se confunde con
   * la paleta ya oscura de `SECTION_FILL_COLORS`). Fuente: `sectionHasNoPowerGranted`
   * (déficit VIVO, honesto, sin excepciones) — NO `blueprint.unpoweredSectionIds`
   * (que solo refleja la cicatriz permanente y gatea señales/HUD). Sigue
   * parpadeando en pausa táctica a propósito: no es un efecto de la
   * simulación que la pausa deba congelar.
   */
  private redrawUnpoweredSectionScar(elapsedSeconds: number): void {
    this.unpoweredSectionOverlay?.destroy();
    this.unpoweredSectionOverlay = undefined;

    const darkSections = this.mission.shipFloorplan.sections.filter((section) =>
      this.mission.sectionHasNoPowerGranted(section.id),
    );
    if (darkSections.length === 0) {
      return;
    }

    const graphics = this.add.graphics().setDepth(RENDER_DEPTH.sectionScar);
    graphics.fillStyle(UNPOWERED_SECTION_TINT, sectionScarFlickerAlpha(elapsedSeconds));
    for (const section of darkSections) {
      for (const cell of section.cells) {
        graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
      }
    }
    this.markAsWorldObject(graphics);
    this.unpoweredSectionOverlay = graphics;
  }

  /**
   * Luz ambiental de sección sin energía (Fase 12a, corrección post-playtest —
   * ejemplo del texto original de la fase que había quedado sin implementar,
   * solo el tinte de `redrawUnpoweredSectionScar` existía). Una `PointLight`
   * por sección, creada una vez y nunca removida (misma cicatriz sin retorno
   * que el tinte), centrada en `sectionCentroidPx`, con intensidad
   * parpadeante (`unpoweredSectionLightIntensity`).
   */
  /**
   * Casters móviles que proyectan sombra (Fase 12d.2): componentes colocados
   * (footprint real) + tokens de tripulación y enemigos (caja chica centrada).
   * Los objetos estáticos de Tiled ya son oclusores estáticos (`extractOccluderGrid`
   * incluye la capa `objects`), no hace falta re-agregarlos acá.
   */
  private collectDynamicOccluderEdges(): Segment[] {
    const edges: Segment[] = [];

    for (const instance of this.mission.blueprint.placedComponents) {
      const { width, height } = effectiveFootprintExtent(instance.placement);
      const minX = instance.placement.position.x * CELL;
      const minY = instance.placement.position.y * CELL;
      edges.push(...rectEdges(minX, minY, minX + width * CELL, minY + height * CELL));
    }

    const TOKEN_HALF = CELL * 0.3;
    for (const { dot } of this.crewTokens.values()) {
      edges.push(...rectEdges(dot.x - TOKEN_HALF, dot.y - TOKEN_HALF, dot.x + TOKEN_HALF, dot.y + TOKEN_HALF));
    }
    for (const { shape } of this.enemyTokens.values()) {
      edges.push(...rectEdges(shape.x - TOKEN_HALF, shape.y - TOKEN_HALF, shape.x + TOKEN_HALF, shape.y + TOKEN_HALF));
    }

    return edges;
  }

  private syncUnpoweredSectionLights(elapsedSeconds: number): void {
    for (const section of this.mission.shipFloorplan.sections) {
      const dark = this.mission.sectionHasNoPowerGranted(section.id);
      const existing = this.unpoweredSectionLights.get(section.id);
      if (dark && !existing) {
        const { x, y } = sectionCentroidPx(section);
        const light = createDynamicLight(
          this,
          x,
          y,
          UNPOWERED_SECTION_LIGHT_COLOR,
          UNPOWERED_SECTION_LIGHT_RADIUS_PX,
          unpoweredSectionLightIntensity(elapsedSeconds, sectionFlickerSeed(section.id)),
          this.registerLight,
        );
        this.unpoweredSectionLights.set(section.id, light);
      } else if (!dark && existing) {
        existing.destroy();
        this.unpoweredSectionLights.delete(section.id);
      }
    }
    for (const [sectionId, light] of this.unpoweredSectionLights) {
      light.intensity = unpoweredSectionLightIntensity(elapsedSeconds, sectionFlickerSeed(sectionId));
    }
  }

  /**
   * Chispas + luz de conductor sobrecargado (Fase 12a, cicatriz
   * `Blueprint.overloadedRefs`, `MissionOverloadRuntime`): un efecto por
   * instancia, creado la primera vez que aparece en la cicatriz y nunca
   * removido — mismo criterio "sin retorno" que `redrawUnpoweredSectionScar`.
   * A diferencia de esa función (que destruye/recrea un `Graphics` cada
   * frame porque es barato), acá se crean partículas/luz UNA VEZ y solo se
   * actualiza el parpadeo, porque recrear un `ParticleEmitter`/`PointLight`
   * cada frame sí sería costoso.
   */
  private syncOverloadedConductorEffects(elapsedSeconds: number, deltaSeconds: number): void {
    const placedById = new Map(this.mission.blueprint.placedComponents.map((entry) => [entry.instanceId, entry]));
    const overloaded = new Set(this.mission.blueprint.overloadedRefs);

    for (const instanceId of overloaded) {
      if (this.overloadedConductorEffects.has(instanceId)) continue;
      const instance = placedById.get(instanceId);
      if (!instance) continue;
      const effect = createOverloadedConductorEffect(this.registerParticleEmitter, this.registerLight);
      effect.start(this, instance.placement.position);
      this.overloadedConductorEffects.set(instanceId, effect);
    }
    // Cleanup (feedback de playtest): al desmontar el conductor (o si deja de
    // estar sobrecargado) el efecto quedaba colgado — partículas + luz que no
    // se iban, más un radio de luz fantasma. `stop()` destruye ambos y
    // `pruneDeadLights` saca la luz del set de sombras.
    for (const [instanceId, effect] of this.overloadedConductorEffects) {
      if (overloaded.has(instanceId) && placedById.has(instanceId)) continue;
      effect.stop();
      this.overloadedConductorEffects.delete(instanceId);
    }
    for (const effect of this.overloadedConductorEffects.values()) {
      effect.update({ elapsedSeconds }, deltaSeconds);
    }
  }

  /**
   * Overlay de alerta de pantalla completa (Fase 12a): parpadeo rojo sobre
   * TODO el canvas (`hudCamera`, fijo — no debe scrollear con el mapa) ante
   * una crisis crítica en curso. Redibujado cada frame como
   * `redrawUnpoweredSectionScar`, mismo criterio "cicatriz/alerta, no
   * simulación": sigue parpadeando en pausa táctica.
   */
  private redrawScreenAlertOverlay(elapsedSeconds: number, active: boolean): void {
    if (!active) {
      this.screenAlertOverlay?.setVisible(false);
      return;
    }
    if (!this.screenAlertOverlay) {
      this.screenAlertOverlay = this.add
        .image(0, 0, this.ensureVignetteTexture())
        .setOrigin(0, 0)
        .setDisplaySize(this.scale.width, this.scale.height)
        .setTint(SCREEN_ALERT_TINT)
        .setDepth(RENDER_DEPTH.screenAlert);
      this.markAsHudObject(this.screenAlertOverlay);
    }
    this.screenAlertOverlay.setVisible(true);
    // La viñeta ya trae el degradado; el pulso solo modula su opacidad global.
    this.screenAlertOverlay.setAlpha(screenAlertFlickerAlpha(elapsedSeconds));
  }

  /**
   * Textura de viñeta (radial, transparente al centro → opaca en los bordes)
   * generada por código una sola vez (12c.4). Sin asset externo: se dibuja con
   * un gradiente radial sobre un `CanvasTexture`, reutilizable por cualquier
   * overlay de alerta que la tinte.
   */
  private ensureVignetteTexture(): string {
    const key = "vignette-alert";
    if (this.textures.exists(key)) return key;
    const w = this.scale.width;
    const h = this.scale.height;
    const canvasTexture = this.textures.createCanvas(key, w, h);
    const ctx = canvasTexture?.getContext();
    if (canvasTexture && ctx) {
      const cx = w / 2;
      const cy = h / 2;
      const inner = Math.min(w, h) * 0.35;
      const outer = Math.hypot(cx, cy);
      const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.7, "rgba(255,255,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      canvasTexture.refresh();
    }
    return key;
  }

  // --- Tokens de tripulación (persistentes, para poder animar el salto) ---

  private initCrewTokens(): void {
    // Base gris tint-ready del sprite genérico (idempotente): sin ella los
    // tokens caerían a la textura cruda amarilla sin identidad por personaje.
    ensureCrewTintTexture(this);
    this.mission.activeCrew.forEach((actor, index) => {
      const color = CREW_TOKEN_COLORS[index % CREW_TOKEN_COLORS.length]!;
      const sectionId = this.mission.scheduler.getActor(actor.id)?.currentSectionId;
      const pos = this.pixelPositionForSection(sectionId);

      // Sprite genérico de tripulante teñido con el color del personaje
      // (reemplaza el círculo placeholder). El PNG mira a la izquierda; el
      // volteo por dirección de marcha lo maneja `chainHops`/`stepAside` con
      // `faceX`. Ancho derivado de la altura conservando el aspecto del PNG.
      const dot = this.add.image(pos.x, pos.y, CREW_SPRITE_TINT_TEXTURE).setDepth(RENDER_DEPTH.crewEntity);
      dot.setDisplaySize(CREW_TOKEN_HEIGHT_PX * (dot.width / dot.height), CREW_TOKEN_HEIGHT_PX);
      dot.setTint(color);
      this.markAsWorldObject(dot);

      // Anillo de "trabajando" (ajuste post-playtest #3): visible mientras
      // el actor tiene una tarea `busy` en curso, sea cual sea el tipo
      // (desmontar/instalar/conectar antes no daban NINGÚN feedback visual,
      // solo `go-to` animaba algo al completarse). Mismo patrón de tween
      // pulsante que `initProblemMarker`, siempre corriendo — se alterna
      // visibilidad, no se recrea el tween en cada cambio de estado.
      const workingRing = this.add
        .circle(pos.x, pos.y, 16)
        .setStrokeStyle(2, color, 1)
        .setFillStyle(color, 0)
        .setDepth(RENDER_DEPTH.crewEntity)
        .setVisible(false);
      this.markAsWorldObject(workingRing);
      this.tweens.add({
        targets: workingRing,
        alpha: { from: 1, to: 0.3 },
        scale: { from: 0.85, to: 1.2 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const label = this.add
        .text(pos.x, pos.y - 20, actor.name, { fontFamily: "monospace", fontSize: "9px", color: LABEL_COLOR })
        .setOrigin(0.5, 1)
        .setDepth(RENDER_DEPTH.crewEntity);
      this.markAsWorldObject(label);

      // Anillo de selección (playtest #11): marca al tripulante elegido en el
      // panel para saber a cuál nos referimos. Estático y verde (mismo color que
      // la celda seleccionada), a diferencia del `workingRing` pulsante del color
      // del token — se distinguen aunque un mismo actor esté seleccionado y busy.
      const selectionRing = this.add
        .circle(pos.x, pos.y, 15)
        .setStrokeStyle(3, SELECTED_CELL_COLOR, 1)
        .setDepth(RENDER_DEPTH.crewEntity)
        .setVisible(false);
      this.markAsWorldObject(selectionRing);

      this.crewTokens.set(actor.id, { dot, label, workingRing, selectionRing });
      this.updateCrewTokenWorking(actor.id);
    });
  }

  /** Un token por enemigo activo de la misión, en su celda real (`EnemyActor.cell`, a diferencia de la tripulación que solo tiene sección). */
  private initEnemyTokens(): void {
    for (const enemy of this.mission.enemyState.all()) {
      const pos = this.cellCenterPx(enemy.cell);
      const token = createEnemyToken(this, (obj) => this.markAsWorldObject(obj), enemy, pos);
      this.enemyTokens.set(enemy.id, token);
    }
  }

  /** Avance/ataque/derrota de enemigo (Fase 11d.3) — Observer sobre `mission.enemyEvents`, `/engine` no conoce Phaser. */
  private handleEnemyEvent(event: EnemyDomainEvent): void {
    const token = this.enemyTokens.get(event.enemyId);
    if (!token) return;
    switch (event.kind) {
      case "enemy-advanced": {
        const enemy = this.mission.enemyState.get(event.enemyId);
        if (enemy) this.travelEnemyToken(event.enemyId, token, enemy.cell);
        break;
      }
      case "enemy-attacked":
        flashEnemyAttack(this, token);
        break;
      case "enemy-defeated":
        destroyEnemyToken(token);
        this.enemyTokens.delete(event.enemyId);
        break;
    }
  }

  /**
   * Anima el viaje del token de enemigo hasta `toCell` encadenando un
   * `hopMove` POR CELDA (Fase 11d.4, fix de animación) — antes saltaba
   * directo del punto A al B en un solo hop, lo que con waypoints separados
   * por varias celdas se veía como un teletransporte en vez de una caminata.
   * Mismo mecanismo que `travelCrewToken`: camino transitable
   * (`travelWaypoints`) + `chainHops`, repartiendo la duración REAL del
   * segmento (diferencia de `arrivalSeconds` entre el waypoint anterior y el
   * actual, `enemySegmentDurationMs`) entre esas celdas. Sin grilla
   * transitable o sin poder resolver la duración del segmento, cae al salto
   * directo (`hopEnemyToken`) — nunca deja al enemigo sin animarse.
   */
  private travelEnemyToken(enemyId: EnemyActorId, token: EnemyToken, toCell: GridPosition): void {
    const toPx = this.cellCenterPx(toCell);
    const durationMs = this.enemySegmentDurationMs(this.mission.enemyRoutes.get(enemyId), toCell);
    const waypoints =
      durationMs !== undefined ? this.travelWaypoints({ x: token.shape.x, y: token.shape.y }, toPx) : undefined;
    if (waypoints && durationMs !== undefined) {
      const perHopMs = Math.max(60, durationMs / waypoints.length);
      this.chainHops({ dot: token.shape }, waypoints, perHopMs, "normal", 0, enemyJumpSignature(token));
    } else {
      this.trackHopTween(hopEnemyToken(this, token, toPx));
    }
  }

  /** Duración real (ms) del tramo de ruta que termina en `cell` — diferencia de `arrivalSeconds` contra el waypoint anterior. `undefined` si no hay ruta o `cell` es el primer waypoint (no debería disparar `enemy-advanced`). */
  private enemySegmentDurationMs(route: ScriptedRoute | undefined, cell: GridPosition): number | undefined {
    if (!route) return undefined;
    const index = route.waypoints.findIndex((wp) => wp.cell.x === cell.x && wp.cell.y === cell.y);
    if (index <= 0) return undefined;
    const seconds = route.waypoints[index]!.arrivalSeconds - route.waypoints[index - 1]!.arrivalSeconds;
    return seconds > 0 ? seconds * 1000 : undefined;
  }


  private pixelPositionForSection(sectionId: SectionId | undefined): { x: number; y: number } {
    const section = sectionId
      ? this.mission.shipFloorplan.sections.find((entry) => entry.id === sectionId)
      : undefined;
    return section ? sectionCentroidPx(section) : { x: 0, y: 0 };
  }

  private updateCrewTokenLabel(actorId: CrewActorId): void {
    const token = this.crewTokens.get(actorId);
    const actor = this.mission.activeCrew.find((entry) => entry.id === actorId);
    if (!token || !actor) return;
    const activeTask = this.mission.scheduler
      .queueFor(actorId)
      .find((task) => task.state === "in-progress" || task.state === "blocked");
    const statusLabel = activeTask ? activeTask.type : "";
    token.label.setText(statusLabel.length > 0 ? `${actor.name} (${statusLabel})` : actor.name);
  }

  /** Alterna el anillo pulsante según el estado real del actor en el scheduler — `busy` cubre CUALQUIER tarea en curso, no solo `go-to`. */
  private updateCrewTokenWorking(actorId: CrewActorId): void {
    const token = this.crewTokens.get(actorId);
    if (!token) return;
    token.workingRing.setVisible(this.mission.scheduler.getActor(actorId)?.status === "busy");
  }

  /**
   * Anima el viaje de un tripulante hacia `targetPx` repartido en
   * `durationSeconds` (playtest #8): arranca al INICIAR el `go-to`, no al
   * terminarlo, y el total de saltos ocupa la duración de la tarea para que el
   * token llegue justo cuando el `go-to` completa.
   */
  private travelCrewToken(
    actorId: CrewActorId,
    targetPx: { x: number; y: number },
    durationSeconds: number,
    goToTaskId: CrewTaskId,
  ): void {
    const token = this.crewTokens.get(actorId);
    if (!token) return;
    const waypoints = this.travelWaypoints(token.dot, targetPx);
    if (!waypoints) {
      // Hay grilla pero NO hay ruta transitable al destino: en vez de cruzar la
      // pared en línea recta Y ejecutar la acción igual en el lugar equivocado
      // (bug playtest #10), se aborta el `go-to` y las acciones que dependían de
      // llegar allí. El token no se mueve.
      this.abortUnreachable(actorId, goToTaskId, token.dot);
      return;
    }
    const perHopMs = Math.max(60, (durationSeconds * 1000) / waypoints.length);
    this.chainHops(token, waypoints, perHopMs, this.cadenceForActor(actorId));
  }

  /** Cadencia de salto según el HP VIVO del actor (herido bajo el umbral, `crew-hp-to-cadence.ts`). */
  private cadenceForActor(actorId: CrewActorId): HopCadence {
    const actor = this.mission.crewState.get(actorId);
    return actor ? cadenceForCrewHp(actor) : "normal";
  }

  /**
   * Waypoints en píxeles (centro de celda) siguiendo el plano hasta `target`, o
   * `undefined` si hay grilla pero no existe ruta transitable (el llamador avisa
   * y no mueve al token). Sin grilla (nave sin tile art, sin paredes que
   * respetar) cae a una línea recta PARTIDA en pasos de ~1 celda
   * (`straightLineWaypoints`) para que igual salte por pasos.
   */
  private travelWaypoints(
    from: { x: number; y: number },
    target: { x: number; y: number },
  ): { x: number; y: number }[] | undefined {
    if (!this.walkableGrid) return this.straightLineWaypoints(from, target);
    const start = { x: Math.floor(from.x / CELL), y: Math.floor(from.y / CELL) };
    const goal = { x: Math.floor(target.x / CELL), y: Math.floor(target.y / CELL) };
    const path = findPath(this.walkableGrid, start, goal);
    if (!path || path.length === 0) return undefined;
    const points = path.map((cell) => ({ x: (cell.x + 0.5) * CELL, y: (cell.y + 0.5) * CELL }));
    // Que aterrice EXACTAMENTE en la celda pedida (no en el centro de su celda por redondeo).
    points[points.length - 1] = target;
    return points;
  }

  /**
   * Destino inalcanzable (playtest #10): el motor modela el `go-to` como un puro
   * temporizador (no conoce paredes), así que sin este aborto la acción se
   * ejecutaría igual en el lugar equivocado al vencer el timer. Como el `go-to`
   * y sus acciones NO están vinculados por dependencia (van secuenciales en la
   * cola del actor, `mission-runtime.ts`), se cancela el `go-to` Y el tramo
   * contiguo de acciones que iban a ese destino (todo lo que sigue hasta el
   * próximo `go-to`, que ya sería otro tramo/sección). El token no se mueve; se
   * avisa con texto flotante + `console.warn` para diagnosticar la conectividad.
   */
  private abortUnreachable(actorId: CrewActorId, goToTaskId: CrewTaskId, at: { x: number; y: number }): void {
    const fromCell = { x: Math.floor(at.x / CELL), y: Math.floor(at.y / CELL) };
    console.warn(`[pathfinding] sin ruta para ${actorId} desde la celda (${fromCell.x}, ${fromCell.y}); tarea cancelada.`);

    const tick = { dtSeconds: 0, elapsedSeconds: this.mission.coreLoop.elapsed };
    const queue = this.mission.scheduler.queueFor(actorId);
    const startIndex = queue.findIndex((task) => task.id === goToTaskId);
    if (startIndex >= 0) {
      this.mission.scheduler.cancel(goToTaskId, tick);
      // Cancela el tramo contiguo de acciones de ESTE destino; corta en el próximo `go-to`.
      for (let i = startIndex + 1; i < queue.length; i += 1) {
        if (queue[i]!.type === "go-to") break;
        this.mission.scheduler.cancel(queue[i]!.id, tick);
      }
    }
    this.updateCrewTokenLabel(actorId);
    this.updateCrewTokenWorking(actorId);
    this.redrawQueuePanel();

    const label = this.add
      .text(at.x, at.y - 26, t("ui.floorplan.mission.no-path"), {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#ff5a5a",
        backgroundColor: "#000000cc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(RENDER_DEPTH.problemMarker);
    this.markAsWorldObject(label);
    this.tweens.add({
      targets: label,
      y: at.y - 46,
      alpha: { from: 1, to: 0 },
      duration: 2200,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  /** Línea recta de `from` a `to` partida en pasos de ~1 celda (fallback sin ruta). */
  private straightLineWaypoints(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
    const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / CELL));
    const points: { x: number; y: number }[] = [];
    for (let i = 1; i <= steps; i += 1) {
      points.push({ x: from.x + (to.x - from.x) * (i / steps), y: from.y + (to.y - from.y) * (i / steps) });
    }
    return points;
  }

  /**
   * Encadena un `hopMove` por waypoint con duración fija por salto (reparte
   * el viaje total entre esos pasos). Genérico sobre cualquier `HopTarget`
   * (Fase 11d.4, fix de animación): antes solo tripulación (`Phaser.GameObjects.Arc`),
   * ahora también tokens de enemigo (`Rectangle`) con su propia `JumpSignature`
   * — mismo mecanismo de viaje celda a celda, firma de salto distinta.
   */
  private chainHops(
    token: { readonly dot: HopTarget },
    waypoints: ReadonlyArray<{ x: number; y: number }>,
    perHopMs: number,
    cadence: HopCadence = "normal",
    index = 0,
    signature: JumpSignature = CREW_SIGNATURE,
  ): void {
    if (index >= waypoints.length) return;
    const next = waypoints[index]!;
    // Paso sobre piso metálico (playtest): solo tripulación, no enemigos —
    // `signature` distingue por identidad de referencia (`CREW_SIGNATURE` es
    // el único singleton usado para tokens de tripulación, ver `enemyJumpSignature`
    // para el resto de llamadas a `chainHops`).
    if (signature === CREW_SIGNATURE) {
      this.sound.play(pickSoundKey(AUDIO_KEYS.footstep), { volume: 0.25 });
      this.faceHopTarget(token.dot, next.x);
    }
    const tween = hopMove(this, token.dot, { x: token.dot.x, y: token.dot.y }, next, cadence, signature, perHopMs);
    this.trackHopTween(tween);
    tween.once("complete", () => this.chainHops(token, waypoints, perHopMs, cadence, index + 1, signature));
  }

  /**
   * Registra un tween de salto para que `update()` pueda pausarlo/reanudarlo
   * según `coreLoop.mode` (Fase 12f, Obs 3). Se auto-remueve al completar —
   * no depende de que el llamador lo saque explícitamente.
   */
  private trackHopTween(tween: Phaser.Tweens.Tween): void {
    this.activeHopTweens.add(tween);
    tween.once("complete", () => this.activeHopTweens.delete(tween));
  }

  /**
   * Voltea el token para que "mire hacia donde camina" (`faceX`): el sprite de
   * tripulante mira a la izquierda por defecto → al ir a la derecha se voltea.
   * No-op en tokens sin `setFlipX` (enemigos = `Rectangle`), así que es seguro
   * llamarlo sobre el `HopTarget` genérico.
   */
  private faceHopTarget(target: HopTarget, toX: number): void {
    const flippable = target as { flipX?: boolean; setFlipX?: (value: boolean) => unknown };
    if (typeof flippable.setFlipX !== "function") return;
    flippable.setFlipX(faceX(target.x, toX, flippable.flipX ?? false));
  }

  private cellCenterPx(cell: GridPosition): { x: number; y: number } {
    return { x: (cell.x + 0.5) * CELL, y: (cell.y + 0.5) * CELL };
  }

  /** ¿El actor tiene alguna tarea no terminal encolada? Si no, se quedaría parado en el sitio. */
  private hasPendingWork(actorId: CrewActorId): boolean {
    return this.mission.scheduler
      .queueFor(actorId)
      .some((task) => task.state !== "completed" && task.state !== "cancelled" && task.state !== "failed");
  }

  /**
   * Salto corto del token a una celda adyacente transitable (playtest #9): tras
   * terminar una acción sin más trabajo pendiente, el tripulante estaría parado
   * justo sobre la celda que tocó, tapando el objeto instalado/desmontado. Un
   * paso al costado lo deja visible. Sin grilla (nave sin tile art) o sin vecino
   * transitable, no se mueve.
   */
  private stepAsideCrewToken(actorId: CrewActorId): void {
    const token = this.crewTokens.get(actorId);
    if (!token) return;
    const from = { x: token.dot.x, y: token.dot.y };
    const currentCell = { x: Math.floor(from.x / CELL), y: Math.floor(from.y / CELL) };
    const aside = this.adjacentWalkableCell(currentCell);
    if (!aside) return;
    this.sound.play(pickSoundKey(AUDIO_KEYS.footstep), { volume: 0.25 });
    const asidePx = this.cellCenterPx(aside);
    this.faceHopTarget(token.dot, asidePx.x);
    this.trackHopTween(hopMove(this, token.dot, from, asidePx, this.cadenceForActor(actorId), CREW_SIGNATURE));
  }

  /** Primer vecino ortogonal transitable de `cell`, o `undefined` si no hay grilla / ninguno lo es. */
  private adjacentWalkableCell(cell: GridPosition): GridPosition | undefined {
    const grid = this.walkableGrid;
    if (!grid) return undefined;
    const neighbors: GridPosition[] = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ];
    return neighbors.find((n) => grid.isWalkable(n.x, n.y));
  }

  /** Celda de la primera acción (no `go-to`) que sigue al `go-to` dado en la cola del actor — el destino REAL del viaje, no el centroide de la sección. */
  private nextActionCellFor(actorId: CrewActorId, goToTaskId: CrewTaskId): GridPosition | undefined {
    const queue = this.mission.scheduler.queueFor(actorId);
    const startIndex = queue.findIndex((task) => task.id === goToTaskId);
    for (let i = startIndex + 1; i < queue.length; i += 1) {
      const task = queue[i]!;
      if (task.state === "cancelled" || task.state === "failed" || task.state === "completed") continue;
      const cell = this.taskTargetCell(task);
      if (cell) return cell;
    }
    return undefined;
  }

  /** Celda de una instancia colocada por id, o `undefined` si no existe (ronda 7: extraído del lookup que ya hacía `taskTargetCell` para `dismantle`, reusado también por el modo de trasvase). */
  private instanceCell(instanceId: PlacedComponentInstanceId): GridPosition | undefined {
    return this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === instanceId)
      ?.placement.position;
  }

  /** Placement completo (posición + footprint + rotación) de una instancia colocada — ronda 8, resaltado por contorno de footprint real en vez de un círculo suelto. */
  private instancePlacement(instanceId: PlacedComponentInstanceId): PlacedFootprint | undefined {
    return this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === instanceId)?.placement;
  }

  /** Celda donde ocurre físicamente una tarea de acción, derivada de su payload. */
  private taskTargetCell(task: CrewTask): GridPosition | undefined {
    const payload = task.payload;
    if (!payload) return undefined;
    if (payload.kind === "install") return payload.placement.position;
    if (payload.kind === "dismantle") {
      return this.instanceCell(payload.instanceId);
    }
    if (payload.kind === "connect") {
      return this.mission.blueprint.signalGraph.nodes.find((node) => node.id === payload.toNodeId)?.position;
    }
    return undefined;
  }

  /** Celda actual del token del actor (fallback cuando la del payload ya no es resoluble, ej. desmontaje: la instancia ya se removió). */
  private crewTokenCell(actorId: CrewActorId): GridPosition | undefined {
    const token = this.crewTokens.get(actorId);
    if (!token) return undefined;
    return { x: Math.floor(token.dot.x / CELL), y: Math.floor(token.dot.y / CELL) };
  }

  /**
   * Dispara las partículas de una acción de tripulación (instalar/desmontar,
   * playtest #11/#12) al ARRANCAR la tarea, emitiendo durante toda su duración
   * estimada. La celda sale del payload de la tarea (al iniciar, la instancia a
   * desmontar todavía existe en el blueprint); cae a la celda del token si no se
   * pudiera resolver. Marca los emisores como objetos de mundo y les fija la
   * profundidad (doble cámara).
   */
  private fireFabricationEffect(type: CrewTask["type"], task: CrewTask | undefined, actorId: CrewActorId): void {
    if (type !== "install" && type !== "dismantle") return;
    const cell = (task ? this.taskTargetCell(task) : undefined) ?? this.crewTokenCell(actorId);
    if (!cell) return;
    const durationMs = Math.max(300, (task?.estimatedDurationSeconds ?? 0) * 1000);
    const emitters =
      type === "install"
        ? installEffect(this, cell, durationMs)
        : dismantleEffect(this, cell, durationMs);
    for (const emitter of emitters) {
      emitter.setDepth(RENDER_DEPTH.effect);
      this.markAsWorldObject(emitter);
    }
  }

  // --- Eventos de dominio ---------------------------------------------------

  private handleCoreLoopEvent(event: CoreLoopDomainEvent): void {
    switch (event.kind) {
      case "task-completed": {
        // `crewState.currentCell` se sincroniza cada frame en `update()`
        // (fix post-11d.4) a partir de la posición VISUAL del token, no acá.
        // El movimiento ahora se anima al ARRANCAR el `go-to` (ver
        // `task-started`), no al completarlo — acá solo se refresca overlay/
        // etiquetas. El overlay se redibuja para acciones que mutan el plano
        // (install/dismantle/connect); el efecto ya corrió antes del evento
        // (fix del desfase, motor), así que el estado está actualizado.
        if (event.type !== "go-to") {
          if (event.type === "install") {
            this.sound.play(pickSoundKey(AUDIO_KEYS.install), { volume: 0.6 });
          }
          this.redrawOverlay();
          // El grafo de cables pudo cambiar (connect/dismantle del dueño de un
          // nodo) — sincronizar sus efectos de flujo en el mismo punto (Fase 11f.6).
          this.syncSignalWireFlowEffects();
          // Al terminar una acción, si el actor no tiene más trabajo encolado
          // (se quedaría PARADO justo sobre la celda que acaba de tocar, tapando
          // el objeto instalado/desmontado), da un salto a una celda adyacente
          // transitable para que se vea lo que hizo (playtest #9).
          if (!this.hasPendingWork(event.actorId)) {
            this.stepAsideCrewToken(event.actorId);
          }
          // Una acción mutó el plano: el checklist de objetivos puede haber
          // cambiado — la franja siempre visible se refresca siempre (playtest
          // de Fase 11d), el modal del briefing solo si está abierto (#15).
          this.renderObjectivesStrip();
          if (this.objectivesOpen) this.renderObjectivesPanel();
          // Feedback de "obtuviste X" al desarmar un compuesto (playtest de
          // Fase 11d): sin esto, el stock se acreditaba en silencio —
          // principio 6, todo estado relevante necesita representación.
          // 12c.5: un texto ascendente POR elemento (no un string concatenado) +
          // una partícula coleccionable por elemento que vuela hacia la mesa.
          if (event.obtained && event.obtained.length > 0) {
            const task = this.mission.scheduler.getTask(event.taskId);
            const cell = (task ? this.taskTargetCell(task) : undefined) ?? this.crewTokenCell(event.actorId);
            if (cell) this.fireElementCollection(cell, event.obtained);
            // Detalle legible del desmantelamiento por el sistema de notificaciones (12c.7).
            // 13c fix ronda 1: la línea dice ADEMÁS con qué desgaste volvió la
            // pieza, y la notificación entera pasa a `warning` si alguna sufrió
            // en este desmontaje. Antes siempre era `success` con el mismo
            // texto, así que "el novato rompió algo" y "salió limpio" eran
            // indistinguibles — una tirada sin feedback es una tirada invisible.
            const anyDegraded = event.obtained.some((entry) => entry.degraded === true);
            this.notifications?.push({
              title: t("ui.floorplan.notification.dismantled"),
              lines: event.obtained.map((entry) => {
                const name = this.nameByComponentId.get(entry.componentId as string) ?? entry.componentId;
                const wear = entry.wear && entry.wear !== "nuevo" ? ` ${t(`component.wear.${entry.wear}`)}` : "";
                return `×${entry.quantity} ${name}${wear}`;
              }),
              type: anyDegraded ? "warning" : "success",
            });
          }
          // Síntesis/fabricación completada (tarea `combine`, 12c.7): el motor ya
          // materializó la sustancia/creación (su listener corre antes) y guardó
          // EXACTAMENTE qué produjo esta tarea (`materializedByTaskId`, ronda 5)
          // — antes se detectaba comparando `availableSubstances.length` antes/
          // después, un `Set` deduplicado que no crecía (y por tanto no
          // notificaba) si la sustancia sintetizada ya existía en algún
          // reservorio.
          if (event.type === "combine") {
            const materialized = this.mission.consumeMaterializedByTask(event.taskId);
            if (materialized) {
              this.notifications?.push({
                title:
                  materialized.kind === "substance"
                    ? t("ui.floorplan.notification.synthesized")
                    : t("ui.floorplan.notification.fabricated"),
                lines: [materialized.name],
                type: "success",
              });
            }
          }
          this.notifySubstanceTaskResult(event);
          // Bark de resultado al TERMINAR una acción asignada ("listo").
          this.barkForActor(event.actorId, "success");
        }
        this.updateCrewTokenLabel(event.actorId);
        this.updateCrewTokenWorking(event.actorId);
        this.redrawQueuePanel();
        // Una síntesis pudo sumar una sustancia nueva a la lista idle, o un
        // "Analizar Sustancia" pudo cambiar el estado `analyzed` de la que ya
        // se estaba mostrando (Fase 11e) — sin esto, el panel de acciones
        // quedaba desactualizado hasta la próxima interacción manual.
        this.interaction.refreshActionPanel();
        break;
      }
      case "task-started": {
        if (event.type === "go-to") {
          const task = this.mission.scheduler.getTask(event.taskId);
          if (task) {
            const cell = this.nextActionCellFor(event.actorId, event.taskId);
            const targetPx = cell ? this.cellCenterPx(cell) : this.pixelPositionForSection(task.targetSectionId);
            this.travelCrewToken(event.actorId, targetPx, task.estimatedDurationSeconds, event.taskId);
          }
        } else {
          // Partículas de la acción (instalar/desmontar) MIENTRAS se lleva a cabo
          // (playtest #12): emisión continua durante la duración de la tarea, no
          // un burst al terminar.
          this.fireFabricationEffect(event.type, this.mission.scheduler.getTask(event.taskId), event.actorId);
          // Bark al EMPEZAR una acción asignada ("me pongo con esto").
          this.barkForActor(event.actorId, "dangerous-task");
        }
        this.updateCrewTokenLabel(event.actorId);
        this.updateCrewTokenWorking(event.actorId);
        this.redrawQueuePanel();
        break;
      }
      case "task-blocked":
      case "task-cancelled":
      case "task-failed": {
        // Solo una tarea FALLIDA da bark ("no salió"); bloqueo/cancelación no.
        if (event.kind === "task-failed") this.barkForActor(event.actorId, "failure");
        // Notificación de tarea fallida/bloqueada (12c.7) — la cancelación es
        // acción voluntaria del jugador, no amerita aviso.
        if (event.kind === "task-failed" || event.kind === "task-blocked") {
          const failedTask = this.mission.scheduler.getTask(event.taskId);
          // Ronda 10 de fixes de playtest 13e: un bloqueo por falta de
          // energía es un motivo distinto (accionable por el jugador
          // reasignando energía) y merece su propio texto en vez del genérico
          // — mismo criterio que la distinción "warning"/"error" por tipo de
          // evento, ahora también por motivo.
          const titleKey =
            event.kind === "task-failed"
              ? "ui.floorplan.notification.task-failed"
              : event.kind === "task-blocked" && event.reason === "no-power"
                ? "ui.floorplan.notification.task-blocked-no-power"
                : "ui.floorplan.notification.task-blocked";
          this.notifications?.push({
            title: t(titleKey),
            lines: failedTask ? [this.taskTypeLabel(failedTask.type)] : undefined,
            type: event.kind === "task-failed" ? "error" : "warning",
          });
        }
        this.updateCrewTokenLabel(event.actorId);
        this.updateCrewTokenWorking(event.actorId);
        this.redrawQueuePanel();
        break;
      }
      case "core-loop-mode-changed": {
        this.updatePlayPauseButton();
        this.redrawEnergyControls();
        this.updateHeader();
        // Fase 11a.3: el fantasma se calcula UNA vez al entrar en pausa (el
        // reloj congelado garantiza que nada de lo que alimenta la
        // predicción cambia mientras el jugador lo mira) y se destruye al
        // reanudar — el token real (`redrawProjectileTokens`, en `update()`)
        // retoma el relevo.
        this.redrawTrajectoryGhost();
        // El panel de acciones depende del modo desde 13e ronda 2 (el botón de
        // la mesa se deshabilita en ejecución). Sin este refresco el label
        // quedaba congelado en "pausá primero" DESPUÉS de pausar — verificado
        // corriendo el juego, no en revisión de código.
        this.interaction.refreshActionPanel();
        break;
      }
    }
  }

  /**
   * Feedback de las tareas de sustancia (13e, fix de playtest ronda 2).
   *
   * Las cuatro terminaban EN SILENCIO: el motor calculaba el resultado, lo
   * devolvía en su `TaskEffectResult`… y ahí moría, porque el scheduler no lo
   * copiaba al evento. El operador purgó su único tanque de agua y no vio nada
   * — ni cuánto perdía al aceptar, ni que había ocurrido al terminar.
   */
  private notifySubstanceTaskResult(event: TaskCompletedEvent): void {
    if (event.obtainedElements && event.obtainedElements.length > 0) {
      // Agrupado por elemento: "×10 Hidrógeno" se lee, diez líneas iguales no.
      const counts = new Map<string, number>();
      for (const id of event.obtainedElements) {
        counts.set(id as string, (counts.get(id as string) ?? 0) + 1);
      }
      this.notifications?.push({
        title: t("ui.floorplan.notification.elements-extracted"),
        lines: [...counts].map(
          ([id, count]) =>
            `×${count} ${this.mission.substanceNameOf(id as ChemicalSubstanceId) ?? id}`,
        ),
        type: "success",
      });
      // Ronda 5: la extracción de un reservorio no volaba ninguna "moneda" —
      // el desmontaje físico sí, y es el mismo tipo de evento ("obtuviste
      // materia prima"). Una moneda por SUSTANCIA distinta (no por unidad,
      // mismo criterio que `fireElementCollection`), hacia la estación
      // QUÍMICA — es donde se consume `elementStock`, no el banco físico.
      const task = this.mission.scheduler.getTask(event.taskId);
      const cell = (task ? this.taskTargetCell(task) : undefined) ?? this.crewTokenCell(event.actorId);
      if (cell) {
        this.fireCollectionBurst(cell, this.mission.benchCell("quimica"), counts.size);
      }
    }
    if (event.type === "transfer-substance" && event.pouredSubstanceId && event.pouredAmount) {
      // Ronda 7: un trasvase exitoso NO derrama nada (a diferencia de verter/
      // purgar) — antes ni siquiera se reportaba `pouredSubstanceId` en este
      // caso, así que un trasvase 100% exitoso no disparaba ninguna
      // notificación ni efecto visual y la sustancia "desaparecía" a los ojos
      // del jugador. Rama propia con su propio título y una moneda (no un
      // charco) hacia el reservorio destino elegido.
      const name = this.mission.substanceNameOf(event.pouredSubstanceId) ?? event.pouredSubstanceId;
      this.notifications?.push({
        title: t("ui.floorplan.notification.substance-transferred"),
        lines: [`${name} — ${event.pouredAmount}`],
        type: "success",
      });
      const task = this.mission.scheduler.getTask(event.taskId);
      const originCell = (task ? this.taskTargetCell(task) : undefined) ?? this.crewTokenCell(event.actorId);
      const targetCell =
        task?.payload?.kind === "transfer-substance" ? this.instanceCell(task.payload.toInstanceId) : undefined;
      if (originCell && targetCell) {
        this.fireCollectionBurst(originCell, targetCell, 1);
      }
    } else if (event.pouredSubstanceId && event.pouredAmount) {
      const name = this.mission.substanceNameOf(event.pouredSubstanceId) ?? event.pouredSubstanceId;
      // Purgar es una PÉRDIDA y verter es un uso deliberado: mismo fenómeno
      // físico, distinta intención, distinto tono de aviso.
      const purged = event.type === "purge-reservoir";
      this.notifications?.push({
        title: t(
          purged
            ? "ui.floorplan.notification.reservoir-purged"
            : "ui.floorplan.notification.substance-poured",
        ),
        lines: [`${name} — ${event.pouredAmount}`],
        type: purged ? "warning" : "info",
      });
      // Y se VE dónde cayó: el mismo charco del derrame de 13d, en la celda de
      // la tarea (principio 6 — el motor lo metió en la atmósfera, así que la
      // pantalla tiene que mostrarlo).
      const task = this.mission.scheduler.getTask(event.taskId);
      const cell = (task ? this.taskTargetCell(task) : undefined) ?? this.crewTokenCell(event.actorId);
      if (cell) {
        firePouredSubstance(
          this,
          cell,
          event.pouredAmount,
          chemicalSubstanceColor(
            event.pouredSubstanceId,
            this.mission.substanceTagsOf(event.pouredSubstanceId),
          ),
          (obj) => this.markAsWorldObject(obj),
        );
      }
    }
    if (event.overflowAmount && event.overflowAmount > 0) {
      this.notifications?.push({
        title: t("ui.floorplan.notification.transfer-overflow"),
        lines: [`${event.overflowAmount}`],
        type: "warning",
      });
    }
  }

  /**
   * Daño/muerte de tripulante (consecuencia `crew-damage` del cap. 2). Feedback
   * en TRES capas para que se lea como daño A ESE tripulante:
   *  1. efecto AMBIENTAL en el mundo — arco eléctrico desde una pared cercana
   *     AL token (`environmental-damage-effect.ts`), con sus objetos marcados de
   *     mundo + depth `effect` (evita el bug de doble-cámara del `fireEventEffect`
   *     genérico, que no asignaba cámara y se veía como "explosiones sueltas");
   *  2. flash rojo en el TOKEN y pulso de escala;
   *  3. flash rojo en la TARJETA del tripulante + redibujo de la tira para que la
   *     barra de HP baje en vivo.
   * Más el bark de daño y la cadencia "herido" (`cadenceForActor`), que ya usa el
   * HP vivo del `crewState`. Para causas que no son "ambientales" (no hay hoy en
   * misión, pero p.ej. una muerte por fuego futura) cae al efecto de cuerpo del
   * registro. El HP herido ya vive en `crewState` y se persiste en `toUpdatedSave`.
   */
  private handleCrewEvent(event: CrewDomainEvent): void {
    const token = this.crewTokens.get(event.actorId);
    if (token) {
      const target = { x: token.dot.x, y: token.dot.y };
      const origin = this.nearestWallPx(target);
      const objects = fireEnvironmentalDamage(this, event.cause, target, { origin });
      if (objects.length > 0) {
        // Mismo registro que cualquier otro efecto de evento (cierre de 12d):
        // antes esto duplicaba el depth + cámara a mano y dejaba la luz del
        // arco fuera del sistema de sombras.
        for (const obj of objects) this.registerEffectObject(obj);
      } else {
        // Causa sin fenómeno ambiental propio: cae al efecto de cuerpo del registro.
        const cell = { x: Math.floor(token.dot.x / CELL), y: Math.floor(token.dot.y / CELL) };
        fireEventEffect(this, cell, event, this.worldEffectOptions);
        fireEventSound(this, event);
      }
      this.flashCrewToken(event.actorId);
    }
    this.flashCrewCard(event.actorId);
    this.redrawCrewStrip();
    // Reacción del RETRATO (12c.2): sacudida + destello por causa, y en muerte
    // estática analógica + apagado. Va DESPUÉS del redibujo porque la tira se
    // reconstruye por completo — se anima el retrato recién creado, no uno que
    // el redibujo va a destruir a continuación.
    this.reactCrewPortrait(event);
    this.barkForActor(event.actorId, event.kind === "crew-death" ? "crew-death" : "severe-injury");
  }

  /**
   * Reacción visual del retrato del tripulante ante daño/muerte (12c.2):
   *  - Sacudida horizontal + rotación (violenta en muerte, contenida en daño).
   *  - Destello de color POR CAUSA sobre el retrato: verde para corrosión
   *    (tóxico), rojo para el resto — legible a qué murió/se hirió.
   *  - Muerte: tras la sacudida, "estática analógica" (parpadeo rápido de alpha)
   *    y apagado a un retrato tenue.
   */
  private reactCrewPortrait(event: CrewDomainEvent): void {
    const portrait = this.crewStrip?.portraits.get(event.actorId);
    if (!portrait) return;
    const death = event.kind === "crew-death";
    const baseX = portrait.x;
    const amp = death ? 9 : 5;
    this.tweens.killTweensOf(portrait);
    this.tweens.add({
      targets: portrait,
      x: baseX + amp,
      angle: death ? 8 : 4,
      duration: death ? 45 : 60,
      yoyo: true,
      repeat: death ? 5 : 3,
      ease: "Sine.easeInOut",
      onComplete: () => {
        portrait.x = baseX;
        portrait.angle = 0;
        if (death) this.playAnalogStatic(portrait);
      },
    });
    // Destello de color por causa, sobre el retrato.
    const flashColor = event.cause === "corrosion" ? 0x6adc7a : 0xe0483f;
    const overlay = this.add
      .rectangle(portrait.x, portrait.y, portrait.displayWidth, portrait.displayHeight, flashColor, 0.55)
      .setOrigin(0.5)
      .setDepth(RENDER_DEPTH.hudContent + 1);
    this.markAsHudObject(overlay);
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: death ? 700 : 380,
      onComplete: () => overlay.destroy(),
    });
  }

  /** Parpadeo rápido de alpha ("estática analógica") y apagado tenue del retrato tras la muerte (12c.2). */
  private playAnalogStatic(portrait: CrewPortraitObject): void {
    this.tweens.add({
      targets: portrait,
      alpha: { from: 1, to: 0.35 },
      duration: 55,
      yoyo: true,
      repeat: 5,
      ease: "Steps.easeInOut",
      onComplete: () => {
        this.tweens.add({ targets: portrait, alpha: 0.25, duration: 300 });
        // Apagado analógico: grayscale del retrato muerto (preFX null bajo Canvas → se omite).
        if (portrait instanceof Phaser.GameObjects.Image) {
          portrait.preFX?.addColorMatrix().grayscale(1);
        }
      },
    });
  }

  /**
   * Sincroniza el overlay de parpadeo tóxico por tripulante (12c.2): crea/actualiza
   * un rectángulo verdoso (TOX) o ámbar (CORR) sobre la tarjeta del tripulante que
   * está en una sección con ese contaminante, y lo retira cuando deja de estarlo.
   * Persistente (no vive en el widget, que se reconstruye) para que el flicker no
   * se corte con cada redibujo de la tira.
   */
  private syncCrewToxicOverlays(): void {
    const hits = this.crewStrip?.cardHitAreas ?? [];
    const toxicNow = new Set<CrewActorId>();
    for (const hit of hits) {
      const actor = this.mission.crewState.get(hit.actorId) ?? this.mission.activeCrew.find((a) => a.id === hit.actorId);
      const sectionId = actor?.currentSectionId;
      const contaminant = sectionId ? this.mission.contaminantAt(sectionId) : undefined;
      if (!contaminant) continue;
      toxicNow.add(hit.actorId);
      const color = CHEMICAL_TAG_COLORS[contaminant.tag];
      let overlay = this.crewToxicOverlays.get(hit.actorId);
      if (!overlay) {
        overlay = this.add
          .rectangle((hit.xMin + hit.xMax) / 2, CREW_STRIP_Y + CREW_STRIP_HEIGHT / 2, hit.xMax - hit.xMin, CREW_STRIP_HEIGHT, color, 0.001)
          .setDepth(RENDER_DEPTH.hudContent + 1);
        this.markAsHudObject(overlay);
        this.tweens.add({
          targets: overlay,
          alpha: 0.22,
          duration: 620,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.crewToxicOverlays.set(hit.actorId, overlay);
      } else {
        // La tarjeta pudo moverse (reorden/selección) — reancla y recolorea.
        overlay.setPosition((hit.xMin + hit.xMax) / 2, CREW_STRIP_Y + CREW_STRIP_HEIGHT / 2);
        overlay.setFillStyle(color, overlay.alpha);
      }
    }
    // Retirar overlays de quienes ya no están expuestos (o desaparecieron de la tira).
    for (const [actorId, overlay] of this.crewToxicOverlays) {
      if (!toxicNow.has(actorId)) {
        this.tweens.killTweensOf(overlay);
        overlay.destroy();
        this.crewToxicOverlays.delete(actorId);
      }
    }
  }

  /**
   * Centro en píxeles de la celda de PARED más cercana al punto dado (para el
   * origen del arco eléctrico). Escanea anillos crecientes sobre la grilla
   * transitable (una celda no transitable es pared/obstáculo). Sin grilla (nave
   * sin arte) o sin pared cerca, cae a un punto por encima del objetivo.
   */
  private nearestWallPx(targetPx: { x: number; y: number }): { x: number; y: number } {
    const grid = this.walkableGrid;
    const cx = Math.floor(targetPx.x / CELL);
    const cy = Math.floor(targetPx.y / CELL);
    if (grid) {
      for (let r = 1; r <= 4; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // solo el borde del anillo
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
            if (!grid.isWalkable(x, y)) {
              return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
            }
          }
        }
      }
    }
    // Fallback: el arco cae "desde arriba".
    return { x: targetPx.x, y: targetPx.y - CELL * 1.5 };
  }

  /** Flash rojo + pulso de escala sobre el token del tripulante golpeado. */
  private flashCrewToken(actorId: CrewActorId): void {
    const token = this.crewTokens.get(actorId);
    if (!token) return;
    const flash = this.add
      .circle(token.dot.x, token.dot.y, token.dot.displayHeight / 2 + 4, 0xe0483f, 0.6)
      .setDepth(RENDER_DEPTH.effect);
    this.markAsWorldObject(flash);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 320, onComplete: () => flash.destroy() });
    // Pulso RELATIVO a la escala en reposo (el sprite usa una escala fraccional
    // de `setDisplaySize`, no 1): multiplicar por 1.4, no fijar 1.4 absoluto.
    this.tweens.add({
      targets: token.dot,
      scaleX: token.dot.scaleX * 1.4,
      scaleY: token.dot.scaleY * 1.4,
      duration: 90,
      yoyo: true,
    });
  }

  /**
   * "Satisfacción de deconstrucción" (12c.5): al desmontar un compuesto, por
   * CADA elemento atómico obtenido dispara (1) un texto ascendente propio (no
   * un string concatenado) y (2) una partícula coleccionable que arquea desde
   * la celda hacia el botón de la MESA, al estilo de la recolección de loot de
   * otros juegos. Construye sobre el toast de `obtained-toast.ts`.
   *
   * El texto es objeto de MUNDO (sigue la celda); la partícula es objeto de HUD
   * (vuela a un botón que vive en coords de pantalla), así que su origen se
   * convierte mundo→pantalla con la misma fórmula que `updateActionPanelAnchor`.
   */
  private fireElementCollection(
    cell: GridPosition,
    obtained: ReadonlyArray<{ readonly componentId: string; readonly quantity: number }>,
  ): void {
    // Un botón de pieza física por TIPO obtenido (no por unidad) — mismo
    // criterio que la extracción química de `fireCollectionBurst`.
    this.fireCollectionBurst(cell, this.mission.benchCell("fisica"), obtained.length);
  }

  /**
   * Stagea N "monedas" desde `originCell` hacia `targetCell` (banco de
   * trabajo), con la misma trayectoria en arco y el mismo espaciado que ya
   * usaba `fireElementCollection` para el desmontaje físico (12c.5). Extraído
   * como helper común (ronda 5) porque la extracción de elementos de un
   * reservorio químico necesitaba exactamente el mismo efecto hacia la
   * ESTACIÓN QUÍMICA — antes solo existía para el banco físico, así que el
   * mismo tipo de evento ("obtuviste materia prima") se veía distinto según
   * el origen, violando el principio 6 (dos fenómenos iguales deben verse
   * igual).
   *
   * Sin banco visible del dominio pedido (destruido/nunca construido), cae al
   * centro del header, que es donde vivía el botón de mesa antes de 13e.
   */
  private fireCollectionBurst(
    originCell: GridPosition,
    targetCell: { readonly x: number; readonly y: number } | undefined,
    count: number,
  ): void {
    const cam = this.cameras.main;
    const startX = (originCell.x * CELL + CELL / 2 - cam.scrollX) * cam.zoom;
    const startY = HEADER_HEIGHT + (originCell.y * CELL + CELL / 2 - cam.scrollY) * cam.zoom;
    const targetX = targetCell
      ? (targetCell.x * CELL + CELL / 2 - cam.scrollX) * cam.zoom
      : WORKBENCH_BUTTON_X;
    const targetY = targetCell
      ? HEADER_HEIGHT + (targetCell.y * CELL + CELL / 2 - cam.scrollY) * cam.zoom
      : HEADER_HEIGHT / 2;

    // Partícula coleccionable por elemento con trayectoria en arco hacia la mesa
    // (12c.5). El detalle textual legible (qué se obtuvo) va por el sistema de
    // notificaciones (12c.7), no como toasts de mundo por-elemento superpuestos.
    for (let index = 0; index < count; index++) {
      this.time.delayedCall(index * 90, () => this.fireCollectibleToWorkbench(startX, startY, targetX, targetY));
    }
  }

  /**
   * Una "bola de energía" dorada que arquea de `start` a `target` (coords de
   * pantalla) y hace "pop" el botón de la mesa al llegar (12c.5). La luz que
   * pidió el playtest (12c.7, obs #3) va acá, sobre la ficha que vuela: un halo
   * aditivo que pulsa alrededor del núcleo brillante — el HUD no está iluminado
   * por `PointLight` (cámara fija sin luces), así que el "glow" se hace con un
   * arco de blend ADD, no con una luz real del motor de render.
   */
  private fireCollectibleToWorkbench(startX: number, startY: number, targetX: number, targetY: number): void {
    const glow = this.add
      .circle(startX, startY, 13, 0xffe27a, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(RENDER_DEPTH.hudContent + 1);
    const dot = this.add
      .circle(startX, startY, 5, 0xfff4c2, 1)
      .setStrokeStyle(1, 0xffffff, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(RENDER_DEPTH.hudContent + 2);
    this.markAsHudObject(glow);
    this.markAsHudObject(dot);
    // Pulso del halo: sube/baja de tamaño y alpha para leerse como luz viva.
    const halo = this.tweens.add({
      targets: glow,
      scale: 1.5,
      alpha: 0.75,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // Punto de control por encima de la recta start→target → arco visible.
    const control = new Phaser.Math.Vector2((startX + targetX) / 2, Math.min(startY, targetY) - 80);
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(startX, startY),
      control,
      new Phaser.Math.Vector2(targetX, targetY),
    );
    const proxy = { t: 0 };
    const point = new Phaser.Math.Vector2();
    this.tweens.add({
      targets: proxy,
      t: 1,
      duration: 620,
      ease: "Cubic.easeIn",
      onUpdate: () => {
        curve.getPoint(proxy.t, point);
        const shrink = 1 - proxy.t * 0.4;
        dot.setPosition(point.x, point.y).setScale(shrink);
        glow.setPosition(point.x, point.y);
      },
      onComplete: () => {
        halo.stop();
        glow.destroy();
        dot.destroy();
        if (this.workbenchButton) clickReaction(this, this.workbenchButton as unknown as Phaser.GameObjects.Container);
      },
    });
  }

  /** Flash rojo breve sobre la tarjeta del tripulante golpeado en la tira inferior. */
  private flashCrewCard(actorId: CrewActorId): void {
    const hit = this.crewStrip?.cardHitAreas.find((a) => a.actorId === actorId);
    if (!hit) return;
    const flash = this.add
      .rectangle(hit.xMin, CREW_STRIP_Y, hit.xMax - hit.xMin, CREW_STRIP_HEIGHT, 0xe0483f, 0.45)
      .setOrigin(0, 0)
      .setDepth(RENDER_DEPTH.hudContent);
    this.markAsHudObject(flash);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  }
}

/** `ConduitConnection` no tiene id propio (Fase 11f) — clave compuesta para `conduitFlowEffects`. */
function conduitFlowKey(conduit: ConduitPath["conduit"]): string {
  return `${conduit.a}-${conduit.b}-${conduit.kind}`;
}

/** Hash determinístico simple de un `SectionId` a semilla de `unpoweredSectionLightIntensity` (Fase 12a) — desincroniza el parpadeo si hay más de una sección sin energía a la vez. */
function sectionFlickerSeed(sectionId: SectionId): number {
  let hash = 0;
  for (let i = 0; i < sectionId.length; i += 1) {
    hash = (hash * 31 + sectionId.charCodeAt(i)) % 1000;
  }
  return hash;
}
