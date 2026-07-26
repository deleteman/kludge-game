import Phaser from "phaser";
import {
  ATOMIC_COMPONENT_CATALOG,
  GRID_CELL_SIZE_PX,
  advanceChapterProgress,
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
  ScriptedRoute,
  SectionId,
  TaskType,
} from "engine";

import { t } from "../i18n/i18n.js";
import {
  FLOORPLAN_LAYER_IDS,
  renderFloorplan,
  sectionCentroidCell,
  sectionCentroidPx,
  type FloorplanLayerId,
  type FloorplanRender,
} from "../render/floorplan-renderer.js";
import type { ConduitPath } from "../render/conduit-path.js";
import { computeSignalWireRoute } from "../render/conduit-path.js";
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
import { dismantleEffect, installEffect } from "../particles/effects/fabrication-effect.js";
import { fireObtainedToast } from "../ui/widgets/obtained-toast.js";
import { fireEventEffect } from "../particles/effect-registry.js";
import { fireEnvironmentalDamage } from "../particles/effects/environmental-damage-effect.js";
import {
  createFreezingEffect,
  createGasLeakEffect,
  createHeatVaporEffect,
} from "../particles/effects/atmosphere-state-effects.js";
import type { GasCloudState } from "../particles/effects/atmosphere-state-effects.js";
import { CLOUD_TINT } from "../particles/effects/hazard-effect.js";
import type { StateDrivenEffect } from "../particles/particle-effect.types.js";
import { RENDER_DEPTH } from "../render/render-depths.js";
import {
  CONDUIT_LAYER_INACTIVE_ALPHA,
  CORE_LOOP_MODE_COLORS,
  CREW_TOKEN_COLORS,
  HEADER_COLOR,
  HOVER_HIGHLIGHT_COLOR,
  LABEL_COLOR,
  OBJECTIVE_DONE_COLOR,
  SEALED_VALVE_COLOR,
  sectionScarFlickerAlpha,
  SELECTED_CELL_COLOR,
  TIMER_TEXT_COLORS,
  UNPOWERED_SECTION_TINT,
  WIRE_HIGHLIGHT_COLOR,
} from "../render/palette.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { buildCrisisOutcome, setPendingCrisisOutcome } from "../meta/crisis-outcome.js";
import { saveCampaignSave } from "../meta/save-adapter.js";
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
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyPanel } from "../ui/widgets/kenney-panel.js";
import { createScrollableText } from "../ui/widgets/scrollable-text.js";
import { renderCrewQueue, type CrewQueueHandle, type UnifiedQueueTask } from "../ui/widgets/crew-queue-panel.js";
import { renderCrewStrip, type CrewStripHandle } from "../ui/widgets/crew-strip.js";
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
const LAYER_PANEL_WIDTH = 700;
const LAYER_PANEL_HEIGHT = 74;

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

  private overlayContainer?: Phaser.GameObjects.Container;
  /** Grafo de señal (nodos + cables) del overlay — capa `señales` del HUD (Fase 11f.3), atenuado por su toggle. */
  private signalGraphics?: Phaser.GameObjects.Graphics;
  /** Tokens de proyectiles ferromagnéticos en vuelo (Fase 11a.3) — redibujado cada frame en ejecución. */
  private projectileContainer?: Phaser.GameObjects.Container;
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
  private objectivesButton?: Phaser.GameObjects.GameObject;
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
  private floorplanRender!: FloorplanRender;
  /** Efecto de flujo animado por conducto (Fase 11f), clave `${a}-${b}-${kind}` — no hay id propio en `ConduitConnection`. */
  private readonly conduitFlowEffects = new Map<string, StateDrivenEffect<ConduitPathFlowState>>();
  /** Efecto de flujo animado por CABLE de señal (Fase 11f.6), clave `edge.id` — ver `syncSignalWireFlowEffects`. */
  private readonly signalWireFlowEffects = new Map<SignalEdgeId, StateDrivenEffect<ConduitPathFlowState>>();

  private readonly crewTokens = new Map<
    CrewActorId,
    {
      readonly dot: Phaser.GameObjects.Arc;
      readonly label: Phaser.GameObjects.Text;
      readonly workingRing: Phaser.GameObjects.Arc;
      /** Anillo estático que marca al tripulante SELECCIONADO en el panel (playtest #11) — distinto del `workingRing` pulsante. */
      readonly selectionRing: Phaser.GameObjects.Arc;
    }
  >();

  /** Tokens visuales de enemigo (Fase 11d.3) — sin contenido de capítulo todavía (11d.4), así que arranca vacío en misión real. */
  private readonly enemyTokens = new Map<EnemyActorId, EnemyToken>();

  /** Efectos state-driven de atmósfera por sección (Fase 11b) — un trío por sección, arrancado una vez en `create()`. */
  private readonly sectionAtmosphereEffects = new Map<
    SectionId,
    {
      readonly gasLeak: StateDrivenEffect<GasCloudState>;
      readonly freezing: StateDrivenEffect<{ readonly temperatureCelsius: number }>;
      readonly heatVapor: StateDrivenEffect<{ readonly temperatureCelsius: number }>;
    }
  >();
  /** Tinte parpadeante de sección sin energía (Fase 11b, cicatriz) — redibujado cada frame, sigue parpadeando en pausa. */
  private unpoweredSectionOverlay?: Phaser.GameObjects.Graphics;

  private dragOrigin?: { readonly x: number; readonly y: number; readonly scrollX: number; readonly scrollY: number };
  private dragDistance = 0;

  /** Zoom mínimo (encajar todo el plano en el viewport), calculado en `create()` según el tamaño de la nave. */
  private minZoom = 1;

  private hoverHighlight?: Phaser.GameObjects.Rectangle;
  private hoverCell?: GridPosition;
  private selectedHighlight?: Phaser.GameObjects.Rectangle;
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
    preloadUiAssets(this);
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

    this.interaction = new MissionInteractionController(
      this.rex,
      this.mission,
      this.nameByComponentId,
      {
        actionPanelWidth: ACTION_PANEL_WIDTH,
        actionPanelHeight: ACTION_PANEL_HEIGHT,
      },
      {
        setStatus: (text) => this.setStatus(text),
        onTaskQueued: () => this.redrawQueuePanel(),
        onWireModeChanged: () => {
          this.updateWireModeButton();
          this.updateWireHighlights();
        },
        markAsHudObject: (obj) => this.markAsHudObject(obj),
        onSelectionChanged: () => this.updateSelectedHighlight(),
        onWireSelectionChanged: () => this.updateWireHighlights(),
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
    // El plano vuelve DOS objetos por profundidad: `base` (suelo/objetos/
    // etiquetas, debajo de tripulación y componentes) y `walls` (paredes, por
    // encima). Ambos se registran en la cámara de mundo (post-playtest #7).
    const floorplanRender = renderFloorplan(this, this.mission.shipFloorplan, this.walkableGrid);
    this.floorplanRender = floorplanRender;
    this.markAsWorldObject(floorplanRender.base);
    if (floorplanRender.walls) this.markAsWorldObject(floorplanRender.walls);
    this.redrawOverlay();
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

    // Resaltado PERSISTENTE de la celda seleccionada (color distinto del
    // hover): queda marcada aunque el mouse se mueva, para no colocar algo en
    // la celda equivocada (bug 6). Se reposiciona vía `onSelectionChanged`.
    this.selectedHighlight = this.add
      .rectangle(0, 0, CELL, CELL)
      .setOrigin(0, 0)
      .setStrokeStyle(3, SELECTED_CELL_COLOR, 1)
      .setFillStyle(SELECTED_CELL_COLOR, 0.22)
      .setDepth(RENDER_DEPTH.hoverHighlight)
      .setVisible(false);
    this.markAsWorldObject(this.selectedHighlight);

    const worldWidth = this.mission.shipFloorplan.gridSize.width * CELL;
    const worldHeight = this.mission.shipFloorplan.gridSize.height * CELL;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    // Zoom mínimo = "encajar todo el plano" (nunca por encima de 1: si el mundo
    // ya cabe en el viewport, no se fuerza un zoom mayor al normal).
    this.minZoom = Math.min(1, MAP_VIEWPORT_WIDTH / worldWidth, MAP_VIEWPORT_HEIGHT / worldHeight);
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
    this.createObjectivesButton();
    this.createWorkbenchButton();
    this.createLayersButton();

    // El fondo del strip lateral ya NO es un rectángulo único: cada panel (cola
    // de tripulación, acciones) trae su propia caja delimitada (playtest #16),
    // para que se vea la separación y ninguno invada al otro.

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
    this.input.keyboard?.on("keydown-ESC", () => {
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
        if (cell) fireEventEffect(this, cell, event);
      }),
      this.mission.signalEvents.onAny((event) => {
        const cell = this.mission.blueprint.signalGraph.nodes.find((node) => node.id === event.nodeId)?.position;
        if (cell) fireEventEffect(this, cell, event);
      }),
      // Fase 11b: `structuralDegradedEffect`/`structuralFailureEffect` ya
      // existían completos pero sin llamador en misión real (solo demostrados
      // en la galería) — `MissionStructuralRuntime` es el primer emisor real.
      this.mission.failureEvents.onAny((event) => {
        const cell = this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === event.ref)?.placement
          .position;
        if (cell) fireEventEffect(this, cell, event);
      }),
      this.mission.crisisEvents.onAny((event) => {
        this.updateHeader();
        this.updateProblemMarkerVisibility();
        if (event.kind === "crisis-resolved") {
          this.goToCrisisResult(event.outcome);
        }
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of missionSubscriptions) unsubscribe();
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
    // Proyectiles (Fase 11a.3): posición continua, no animada por evento
    // discreto — se redibuja cada frame mientras el reloj corre. En pausa no
    // hace falta (el reloj congelado no mueve nada; el fantasma ya lo cubre).
    if (this.mission.coreLoop.mode === "execution") {
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
    // El flujo de conductos (Fase 11f, fix 11f.7): a diferencia de la cicatriz
    // de arriba (una marca estática que solo parpadea), los tokens de flujo
    // SE MUEVEN — es una animación de simulación, y todo lo que se mueve debe
    // congelarse en pausa (mismo criterio que proyectiles/atmósfera). Solo se
    // actualiza en "execution"; en pausa los tokens quedan fijos donde estaban.
    if (this.mission.coreLoop.mode === "execution") {
      this.updateConduitFlowEffects(delta / 1000);
      this.updateSignalWireFlowEffects(delta / 1000);
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
    if (cell) {
      const camera = this.cameras.main;
      const rawPoint = {
        x: (cell.x * CELL + CELL / 2 - camera.scrollX) * camera.zoom,
        y: HEADER_HEIGHT + (cell.y * CELL + CELL / 2 - camera.scrollY) * camera.zoom,
      };
      const maxX = SIDE_PANEL_X - 10 - ACTION_PANEL_WIDTH - 20;
      const maxY = 720 - ACTION_PANEL_HEIGHT - 8;
      x = Phaser.Math.Clamp(rawPoint.x + ACTION_PANEL_ANCHOR_OFFSET_X, 10, maxX);
      y = Phaser.Math.Clamp(rawPoint.y + ACTION_PANEL_ANCHOR_OFFSET_Y, HEADER_HEIGHT + 8, maxY);
    } else {
      x = SUBSTANCES_PANEL_POSITION.x;
      y = SUBSTANCES_PANEL_POSITION.y;
    }
    this.interaction.repositionActionPanel({ x, y });
    // Bounds reales del container (ver `mission-action-panel.ts`): el fondo
    // arranca en (-10,-8) relativo al origen del panel.
    this.actionPanelBounds = { x: x - 10, y: y - 8, width: ACTION_PANEL_WIDTH + 20, height: ACTION_PANEL_HEIGHT };
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

  private isOverFixedUi(pointer: Phaser.Input.Pointer): boolean {
    if (pointer.y < HEADER_HEIGHT || pointer.x >= SIDE_PANEL_X - 10 || this.isOverCrewStrip(pointer)) return true;
    // Panel de acciones flotante (Subfase 11g): a diferencia de la franja
    // lateral fija, puede estar posicionado SOBRE el mapa — sin este chequeo,
    // un click en uno de sus botones también dispararía `handleMapClick`
    // sobre la celda que hay debajo.
    const bounds = this.actionPanelBounds;
    if (!bounds) return false;
    return (
      pointer.x >= bounds.x &&
      pointer.x <= bounds.x + bounds.width &&
      pointer.y >= bounds.y &&
      pointer.y <= bounds.y + bounds.height
    );
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
        compositionTitle: t("ui.floorplan.mission.composition-title"),
      }).setDepth(RENDER_DEPTH.hudContent);
      this.markAsHudObject(this.tooltip);
      this.tooltipCell = cell;
    }
    this.tooltip.setVisible(true);
    const bounds = this.tooltip.getBounds();
    // A la derecha/abajo del cursor por defecto; se voltea si se saldría del área de mapa.
    let x = pointer.x + 14;
    let y = pointer.y + 16;
    if (x + bounds.width > SIDE_PANEL_X - 10) x = pointer.x - 14 - bounds.width;
    if (y + bounds.height > 720) y = pointer.y - 16 - bounds.height;
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

  /** Reposiciona/oculta el resaltado persistente de la celda seleccionada (bug 6), según `interaction.selectedCell`. */
  private updateSelectedHighlight(): void {
    if (!this.selectedHighlight) return;
    const cell = this.interaction.selectedCell;
    if (!cell) {
      this.selectedHighlight.setVisible(false);
      return;
    }
    this.selectedHighlight.setPosition(cell.x * CELL, cell.y * CELL).setVisible(true);
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
    this.briefingContainer = renderMissionBriefingModal(
      this.rex,
      this.mission.crisisDefinition.name,
      t(briefingKey),
      t("ui.floorplan.mission.briefing.understood"),
      () => {
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
  }

  private applyLayerAlpha(layer: FloorplanLayerId): void {
    const active = this.activeFloorplanLayers.has(layer);
    const alpha = active ? 1 : CONDUIT_LAYER_INACTIVE_ALPHA;
    this.floorplanRender.conduitLayers[layer].setAlpha(alpha);
    // El grafo de señal (nodos + cables) es parte de la capa `señales` (Fase 11f.3):
    // se atenúa con el mismo toggle, junto a los conductos `senal`.
    if (layer === "senal") this.signalGraphics?.setAlpha(alpha);
  }

  private createWorkbenchButton(): void {
    (this.workbenchButton as Phaser.GameObjects.GameObject | undefined)?.destroy();
    // La mesa solo se abre en planificación; en ejecución el botón se muestra
    // atenuado para que su inactividad se vea (además del `setStatus` de respaldo
    // si igual se clickea) — feedback que faltaba (playtest 11c.2).
    const enabled = this.mission.coreLoop.mode === "planning";
    const button = createKenneyButton(
      this.rex,
      WORKBENCH_BUTTON_X,
      HEADER_HEIGHT / 2,
      t("ui.floorplan.mission.workbench"),
      {
        width: 130,
        height: 30,
        fontSize: "12px",
        onClick: () => this.openWorkbench(),
      },
    ).setDepth(RENDER_DEPTH.hudContent);
    button.setAlpha(enabled ? 1 : 0.45);
    this.workbenchButton = button;
    this.markAsHudObject(this.workbenchButton);
  }

  /**
   * Abre la mesa de creación como overlay sobre la misión pausada (11c.2). Solo
   * en planificación (el reloj congelado ya se garantiza en pausa, coherente con
   * la trayectoria fantasma de 11a.3) y con un tripulante seleccionado (es quien
   * paga el tiempo de fabricación). Al confirmar, la mesa entrega la creación:
   * se encola una tarea `combine` y la creación queda disponible para instalar
   * recién al completarse (materialización diferida, `MissionRuntime`).
   */
  private openWorkbench(): void {
    if (this.mission.coreLoop.mode !== "planning") {
      this.setStatus(t("ui.floorplan.mission.workbench-need-pause"));
      return;
    }
    const actorId = this.interaction.selectedActorId;
    if (!actorId) {
      this.setStatus(t("ui.floorplan.mission.workbench-need-actor"));
      return;
    }

    // Bloquea el input del plano mientras la mesa está encima, para que un click
    // sobre el fondo del modal no llegue al mapa de la misión de atrás.
    this.input.enabled = false;
    // Handoff de un solo uso (NO por `scene.data`, que Phaser retiene y filtraba
    // el contexto al modo creativo — ver `setPendingMissionWorkbenchContext`).
    setPendingMissionWorkbenchContext({
      onFabricate: (definition: PhysicalComponentDefinition) => {
        this.mission.queueFabrication(actorId, definition);
        this.nameByComponentId.set(definition.id as string, definition.name);
        this.setStatus(t("ui.floorplan.mission.workbench-queued").replace("{name}", definition.name));
        this.redrawQueuePanel();
      },
      onSynthesize: (selectedElementIds: ReadonlyArray<ChemicalSubstanceId>) => {
        const name = this.mission.queueSynthesis(actorId, selectedElementIds);
        this.setStatus(
          name
            ? t("ui.floorplan.mission.workbench-synthesizing").replace("{name}", name)
            : t("ui.floorplan.mission.workbench-synthesizing-generic"),
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
    let lineY = y;
    statuses.forEach((objective, index) => {
      const label = objective.objectiveKey ? t(objective.objectiveKey) : "";
      if (objective.done && objective.objectiveKey) nowDone.add(objective.objectiveKey);
      if (objective.done && objective.objectiveKey && !previouslyDone.has(objective.objectiveKey)) {
        flashTargets.push(lineY);
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
    );
    this.overlayContainer = overlay.container;
    this.signalGraphics = overlay.signalGraphics;
    this.markAsWorldObject(this.overlayContainer);
    // El grafo de señal (nodos + cables) es la capa `señales` (Fase 11f.3): al
    // reconstruirse el overlay reaplica el estado actual del toggle.
    this.applyLayerAlpha("senal");
  }

  // --- Proyectiles ferromagnéticos y trayectoria fantasma (Fase 11a.3) ----

  /** Redibujo por frame en ejecución — la posición del proyectil es continua, no animada por evento discreto. */
  private redrawProjectileTokens(): void {
    this.projectileContainer?.destroy(true);
    this.projectileContainer = renderProjectileTokens(this, this.mission.projectiles.all);
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
      const freezing = createFreezingEffect(this.registerParticleEmitter);
      const heatVapor = createHeatVaporEffect(this.registerParticleEmitter);
      gasLeak.start(this, position);
      freezing.start(this, position);
      heatVapor.start(this, position);
      this.sectionAtmosphereEffects.set(section.id, { gasLeak, freezing, heatVapor });
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

  private updateSectionAtmosphereEffects(deltaSeconds: number): void {
    for (const [sectionId, effects] of this.sectionAtmosphereEffects) {
      const atmosphere = this.mission.atmosphereRuntime.atmosphereOf(sectionId);
      const temperatureCelsius = atmosphere?.temperatureCelsius ?? 21;
      effects.freezing.update({ temperatureCelsius }, deltaSeconds);
      effects.heatVapor.update({ temperatureCelsius }, deltaSeconds);

      // Clasificar TOX vs CORR es del que pinta (comentario de
      // `atmosphere-state-effects.ts`): reutiliza el MISMO `CLOUD_TINT` que
      // `hazard-effect.ts` ya usa para el burst discreto del mismo fenómeno
      // (principio 6 — una fuga de gas se ve igual sea cual sea el disparador).
      const contaminant = this.mission.contaminantAt(sectionId);
      effects.gasLeak.update(
        {
          concentration: contaminant?.concentration ?? 0,
          tint: CLOUD_TINT[contaminant?.tag === "TOX" ? "toxic-threshold" : "corrosive-exposure"],
        },
        deltaSeconds,
      );
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
   * Cicatriz de "sección sin energía" (Fase 11b, decisión del operador):
   * tinte EXCLUSIVO (`UNPOWERED_SECTION_TINT`, nunca reutilizado) más un
   * parpadeo sinusoidal continuo (`sectionScarFlickerAlpha`) — ninguno de los
   * dos solo alcanzaría el principio 6 (un tinte fijo se confunde con la
   * paleta ya oscura de `SECTION_FILL_COLORS`). Sigue parpadeando en pausa
   * táctica a propósito: es una marca persistente de la nave, no un efecto
   * de la simulación que la pausa deba congelar.
   */
  private redrawUnpoweredSectionScar(elapsedSeconds: number): void {
    this.unpoweredSectionOverlay?.destroy();
    this.unpoweredSectionOverlay = undefined;

    const unpoweredSectionIds = this.mission.blueprint.unpoweredSectionIds;
    if (unpoweredSectionIds.length === 0) {
      return;
    }

    const graphics = this.add.graphics().setDepth(RENDER_DEPTH.sectionScar);
    graphics.fillStyle(UNPOWERED_SECTION_TINT, sectionScarFlickerAlpha(elapsedSeconds));
    for (const sectionId of unpoweredSectionIds) {
      const section = this.mission.shipFloorplan.sections.find((entry) => entry.id === sectionId);
      if (!section) continue;
      for (const cell of section.cells) {
        graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
      }
    }
    this.markAsWorldObject(graphics);
    this.unpoweredSectionOverlay = graphics;
  }

  // --- Tokens de tripulación (persistentes, para poder animar el salto) ---

  private initCrewTokens(): void {
    this.mission.activeCrew.forEach((actor, index) => {
      const color = CREW_TOKEN_COLORS[index % CREW_TOKEN_COLORS.length]!;
      const sectionId = this.mission.scheduler.getActor(actor.id)?.currentSectionId;
      const pos = this.pixelPositionForSection(sectionId);

      // Token más grande y con borde de contraste fijo (ajuste post-playtest
      // #3): un círculo de relleno plano de 7px podía perderse contra tiles
      // de color parecido — el stroke oscuro garantiza contraste sin
      // depender de la paleta de fondo.
      const dot = this.add
        .circle(pos.x, pos.y, 11, color)
        .setStrokeStyle(2, 0x0a0a0f, 1)
        .setDepth(RENDER_DEPTH.crewEntity);
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
      hopEnemyToken(this, token, toPx);
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
    const tween = hopMove(this, token.dot, { x: token.dot.x, y: token.dot.y }, next, cadence, signature, perHopMs);
    tween.once("complete", () => this.chainHops(token, waypoints, perHopMs, cadence, index + 1, signature));
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
    hopMove(this, token.dot, from, this.cellCenterPx(aside), this.cadenceForActor(actorId), CREW_SIGNATURE);
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

  /** Celda donde ocurre físicamente una tarea de acción, derivada de su payload. */
  private taskTargetCell(task: CrewTask): GridPosition | undefined {
    const payload = task.payload;
    if (!payload) return undefined;
    if (payload.kind === "install") return payload.placement.position;
    if (payload.kind === "dismantle") {
      return this.mission.blueprint.placedComponents.find((entry) => entry.instanceId === payload.instanceId)
        ?.placement.position;
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
    const emitters = type === "install" ? installEffect(this, cell, durationMs) : dismantleEffect(this, cell, durationMs);
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
          if (event.obtained && event.obtained.length > 0) {
            const task = this.mission.scheduler.getTask(event.taskId);
            const cell = (task ? this.taskTargetCell(task) : undefined) ?? this.crewTokenCell(event.actorId);
            if (cell) {
              const pixel = this.cellCenterPx(cell);
              const text = event.obtained
                .map((entry) => `x${entry.quantity} ${this.nameByComponentId.get(entry.componentId as string) ?? entry.componentId}`)
                .join(", ");
              const toast = fireObtainedToast(this, pixel.x, pixel.y, `${t("ui.floorplan.mission.obtained-toast")}: ${text}`);
              toast.setDepth(RENDER_DEPTH.effect);
              this.markAsWorldObject(toast);
            }
          }
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
        this.updateCrewTokenLabel(event.actorId);
        this.updateCrewTokenWorking(event.actorId);
        this.redrawQueuePanel();
        break;
      }
      case "core-loop-mode-changed": {
        this.updatePlayPauseButton();
        this.createWorkbenchButton();
        this.updateHeader();
        // Fase 11a.3: el fantasma se calcula UNA vez al entrar en pausa (el
        // reloj congelado garantiza que nada de lo que alimenta la
        // predicción cambia mientras el jugador lo mira) y se destruye al
        // reanudar — el token real (`redrawProjectileTokens`, en `update()`)
        // retoma el relevo.
        this.redrawTrajectoryGhost();
        break;
      }
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
        for (const obj of objects) {
          obj.setDepth(RENDER_DEPTH.effect);
          this.markAsWorldObject(obj);
        }
      } else {
        // Causa sin fenómeno ambiental propio: cae al efecto de cuerpo del registro.
        const cell = { x: Math.floor(token.dot.x / CELL), y: Math.floor(token.dot.y / CELL) };
        fireEventEffect(this, cell, event);
      }
      this.flashCrewToken(event.actorId);
    }
    this.flashCrewCard(event.actorId);
    this.redrawCrewStrip();
    this.barkForActor(event.actorId, event.kind === "crew-death" ? "crew-death" : "severe-injury");
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
      .circle(token.dot.x, token.dot.y, token.dot.radius + 4, 0xe0483f, 0.6)
      .setDepth(RENDER_DEPTH.effect);
    this.markAsWorldObject(flash);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 320, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: token.dot, scale: 1.4, duration: 90, yoyo: true });
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
