import {
  CANONICAL_SHIP_FLOORPLANS,
  CHAPTER_REGISTRY,
  CoreLoopModeMachine,
  CrisisRuntime,
  ENEMY_SEED_BY_CHAPTER_ID,
  EnemyThreatRuntime,
  EventEmitter,
  LooseFerromagneticPromoter,
  MissionAtmosphereRuntime,
  MissionProjectileWorld,
  MissionOverloadRuntime,
  MissionPowerRuntime,
  MissionReactionRuntime,
  MissionSignalRuntime,
  MissionStructuralRuntime,
  ShipStatusQuery,
  MutableAtomicStock,
  MutableCrewState,
  MutableEnemyState,
  MutableShipState,
  previewMissionTrajectory,
  stockOf,
  ProjectileSimulation,
  ReactionResolver,
  TaskScheduler,
  allEmittersActive,
  pressureAwareEmitterInputs,
  motionAwareEmitterInputs,
  CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS,
  CHAPTER_01_SEAL_DRAIN_RATE_KPA_PER_SECOND,
  CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE,
  CHAPTER_01_SEAL_RECOVERY_RATE_KPA_PER_SECOND,
  CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE,
  sealBreachPressureSink,
  buildChemicalCatalog,
  buildComponentCatalog,
  createCrewTask,
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
  createShipTaskEffect,
  deriveMixtureHazardPreview,
  durationMultiplierFor,
  baseDurationFor,
  isCompositeEntity,
  sectionCombustionAtmosphere,
  sectionContainingCell,
  synthesizeSubstance,
  toReactant,
  totalPowerBudget,
  MapEntityRegistry,
} from "engine";
import type {
  CellBlockedQuery,
  EmitterInputSource,
  MixtureHazardPreview,
  PhysicalComponentDefinition,
  ShipStatusIndicator,
  ShipStatusSnapshot,
} from "engine";
import { listCustomCreations, loadCustomCreation } from "../meta/save-adapter.js";
import { sectionCentroidCell } from "../render/floorplan-renderer.js";
import type {
  Blueprint,
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
  ComponentId,
  CoreLoopDomainEvent,
  CrewActor,
  CrewActorId,
  CrewDomainEvent,
  CrewTaskId,
  CrisisDefinition,
  CrisisDomainEvent,
  CrisisState,
  CampaignSaveState,
  EnemyActorId,
  EnemyDomainEvent,
  EnemySeed,
  FailureDomainEvent,
  Footprint,
  GridPosition,
  KineticDomainEvent,
  InstancePowerPriority,
  ReactantSubstance,
  ReactionDomainEvent,
  ScriptedRoute,
  SectionPowerAllocation,
  SignalDomainEvent,
  PlacedComponentInstanceId,
  SectionId,
  ShipFloorplan,
  SignalEdgeId,
  SignalNodeId,
  TrajectoryPreviewStep,
} from "engine";

/** Acciones del core loop con afinidad de especialidad (GDD 6.6); `combine` = fabricar en la mesa (11c.2). */
type ModulatedTaskType = "dismantle" | "install" | "connect" | "combine" | "analyze-substance";

/**
 * Orquestador de una misión en curso (Fase 10d) — el equivalente en `/game` de
 * lo que `engine/src/mission/` dejó listo en 10b, cableado con datos reales de
 * una `CampaignSaveState` en vez de fixtures de test. Construye y posee TODAS
 * las piezas de motor de una misión (scheduler, runtime de crisis, driver de
 * modo) para que `FloorplanScene` solo tenga que orquestar Phaser, no motor.
 */
export class MissionRuntime {
  readonly shipFloorplan: ShipFloorplan;
  readonly shipState: MutableShipState;
  readonly coreLoopEvents = new EventEmitter<CoreLoopDomainEvent>();
  readonly crisisEvents = new EventEmitter<CrisisDomainEvent>();
  /** Eventos de daño/muerte de tripulante (consecuencia `crew-damage`, cap. 2) — `/game` los pinta. */
  readonly crewEvents = new EventEmitter<CrewDomainEvent>();
  readonly scheduler: TaskScheduler;
  readonly crisisRuntime: CrisisRuntime;
  readonly crisisDefinition: CrisisDefinition;
  readonly coreLoop: CoreLoopModeMachine;
  readonly activeCrew: ReadonlyArray<CrewActor>;
  /** Estado vivo de HP de la tripulación activa — fuente del write-back de HP al save (10f). */
  readonly crewState: MutableCrewState;
  /** Estado vivo de los enemigos de la misión (Fase 11d.2) — sin contenido de capítulo todavía (11d.4). */
  readonly enemyState: MutableEnemyState;
  /** Ruta scripteada de cada enemigo (Fase 11d.4, fix de animación) — `/game` la usa para animar el viaje celda a celda, no solo el motor para resolver posición. */
  readonly enemyRoutes: ReadonlyMap<EnemyActorId, ScriptedRoute>;
  /** Eventos de avance/ataque/derrota de enemigo (Fase 11d.2) — `/game` los pinta en 11d.3. */
  readonly enemyEvents = new EventEmitter<EnemyDomainEvent>();
  /** Ruta scripteada + amenaza de cada enemigo (Fase 11d.2), tickeado junto al resto del motor. */
  readonly enemyThreatRuntime: EnemyThreatRuntime;
  /** Eventos de señales (latch) — Observer para partículas de la capa de señales. */
  readonly signalEvents = new EventEmitter<SignalDomainEvent>();
  /** Eventos de cinética (estela de aceleración, impacto) — `/game` los pinta (doc §4, Fase 12). */
  readonly kineticEvents = new EventEmitter<KineticDomainEvent>();
  /** Estado de señales vivo de la misión (Fase 11a): qué nodos están energizados AHORA. */
  readonly signalRuntime: MissionSignalRuntime;
  /**
   * Fuente de entradas de emisor compartida por `signalRuntime` y por la
   * predicción de trayectoria (Subfase 11h): envuelve `allEmittersActive` para
   * que un `sensor-presion` se resuelva contra la atmósfera real de su
   * sección en vez de darse siempre por activo. Guardada como campo (no
   * recreada en cada llamado) para que ambos consumidores compartan el mismo
   * criterio. Fase 13a: además envuelve `motionAwareEmitterInputs` para el
   * sensor óptico (`fotorreceptor`), leyendo `motionBlockedQuery` a través de
   * una indirección.
   */
  private readonly emitterInputs: EmitterInputSource;
  /**
   * Bloqueo de línea de visión para el sensor óptico simulado (Fase 13a,
   * deuda #3): `/engine` no conoce paredes, así que arranca en "nada
   * bloqueado" (mismo fallback que el pathing sin tile art) hasta que
   * `FloorplanScene` construya el `WalkableGrid` real del arquetipo y lo
   * inyecte vía `setMotionBlockedQuery`. Mutable a propósito: `emitterInputs`
   * lo lee por indirección en cada tick, no lo captura por valor al construir.
   */
  private motionBlockedQuery: CellBlockedQuery = { isBlocked: () => false };
  /** Proyectiles ferromagnéticos sueltos sobre el plano (Fase 11a). */
  readonly projectiles: ProjectileSimulation;
  /**
   * Promueve piezas ferromagnéticas SUELTAS (instaladas con el flujo normal
   * de siempre) a proyectil en cuanto no son ellas mismas un electroimán
   * activo (Fase 11a.3, ASA 3 — efecto emergente, no un verbo nuevo de
   * jugador, decisión del operador).
   */
  readonly loosePromoter: LooseFerromagneticPromoter;
  /** Atmósfera viva por sección (Fase 11b) — primer llamador de producción de `diffuse()`. */
  readonly atmosphereRuntime: MissionAtmosphereRuntime;
  /** Cicatriz de RE por componente instalado (Fase 11b) — primer llamador de `StructuralIntegrity`. */
  readonly structuralRuntime: MissionStructuralRuntime;
  /** Cicatriz de sobrecarga scripteada por contenido (Fase 12a) — primer llamador de `OverloadRule`. */
  readonly overloadRuntime: MissionOverloadRuntime;
  /** Presupuesto de energía en vivo (Fase 13b) — reemplaza el flag estático de `unpoweredSectionIds` de 11b. */
  readonly powerRuntime: MissionPowerRuntime;
  /** Química viva scripteada por contenido (Fase 13a, deuda #16) — primer llamador de `ReactionResolver` en misión. */
  readonly reactionRuntime: MissionReactionRuntime;
  /** Estado agregado a nivel de nave (Subfase 11g) — consultado por el HUD permanente de `/game`. */
  private readonly shipStatusQuery: ShipStatusQuery;
  /** Eventos de fallo estructural (degradado/fallo, Fase 11b) — `/game` los pinta. */
  readonly failureEvents = new EventEmitter<FailureDomainEvent>();
  /** Eventos de reacción química en vivo (Fase 13a: combustión/neutralización/ignición espontánea) — `/game` los pinta. */
  readonly reactionEvents = new EventEmitter<ReactionDomainEvent>();
  /** Stock vivo de piezas atómicas (rework "sin stock → desarmar → reutilizar") — leído/mutado por `ship-task-effect.ts`. */
  readonly atomicStock: MutableAtomicStock;

  /**
   * Registry de definiciones (atómicos + compuestos de catálogo). Se tipa como
   * `MapEntityRegistry` concreto (no la interfaz `EntityRegistry`) para poder
   * registrar en él las creaciones custom del jugador en `loadInstallableCreations`
   * (11c.1); `buildComponentCatalog` ya construye un `MapEntityRegistry`.
   */
  private readonly componentRegistry: MapEntityRegistry<ComponentId, PhysicalComponentDefinition>;
  /** Creaciones custom del jugador disponibles para instalar en esta misión (11c.1). */
  private customCreations: ReadonlyArray<PhysicalComponentDefinition> = [];
  /**
   * Fabricaciones encoladas pendientes de completar (11c.2): `taskId` → la
   * definición a hacer disponible. La creación se registra en el `componentRegistry`
   * al encolar (para que se pueda resolver), pero NO aparece en el picker de
   * instalación hasta que el tripulante completa su tarea `combine`.
   */
  private readonly pendingFabrications = new Map<CrewTaskId, PhysicalComponentDefinition>();
  private readonly chemicalRegistry: ReturnType<typeof buildChemicalCatalog>["registry"];
  private readonly chemicalFactory: ReturnType<typeof buildChemicalCatalog>["factory"];
  private readonly reactionResolver: ReactionResolver;
  /** Sustancias sintetizadas disponibles (11c.3) — mismo criterio de materialización diferida que `customCreations`. */
  private availableSubstanceIds: ReadonlyArray<ChemicalSubstanceId> = [];
  /**
   * Síntesis encoladas pendientes de completar (11c.3): `taskId` → id de la
   * sustancia ya resuelta (`synthesizeSubstance` es determinístico, se resuelve
   * al encolar; lo que se difiere es solo su disponibilidad, igual que
   * `pendingFabrications`).
   */
  private readonly pendingSynthesis = new Map<CrewTaskId, ChemicalSubstanceId>();
  /**
   * Sustancias ya analizadas por "Analizar Sustancia" (Fase 11e) — estado
   * durable y re-consultado en cada render del tooltip (no un toast de un solo
   * uso como `obtained`), por eso vive en un Set aparte en vez de reenviarse
   * por evento hacia `/game`.
   */
  private readonly analyzedSubstanceIds = new Set<ChemicalSubstanceId>();
  private taskCounter = 0;

  constructor(save: CampaignSaveState) {
    this.shipFloorplan = CANONICAL_SHIP_FLOORPLANS[save.metadata.archetype];
    this.shipState = new MutableShipState(save.shipState);
    this.atomicStock = new MutableAtomicStock(save.atomicStock);
    this.activeCrew = save.crew.filter((actor) => save.activeCrewIds.includes(actor.id));
    this.crewState = new MutableCrewState(this.activeCrew);
    // Fase 11d.4: contenido de enemigo por capítulo (hoy solo el capítulo 2,
    // arquetipo exploración — `ENEMY_SEED_BY_CHAPTER_ID`). Un capítulo sin
    // entrada en ese mapa arranca vacío, mismo criterio que ya regía en 11d.2
    // antes de que existiera contenido real.
    const enemySeed: EnemySeed | undefined = ENEMY_SEED_BY_CHAPTER_ID.get(save.chapterProgress.currentChapterId);
    this.enemyState = new MutableEnemyState(enemySeed?.enemies ?? []);
    this.enemyRoutes = enemySeed?.routes ?? new Map();
    // `componentRegistry` y `powerRuntime` deben existir ANTES de `signalRuntime`
    // (Fase 13b): el presupuesto de energía en vivo reemplaza el objeto inline
    // de `PowerScarSource` que aquí se pasaba antes, y además gatea por
    // instancia (`InstancePowerSource`) — ver comentario en `MissionSignalRuntime`.
    this.componentRegistry = buildComponentCatalog().registry as MapEntityRegistry<
      ComponentId,
      PhysicalComponentDefinition
    >;
    this.powerRuntime = new MissionPowerRuntime(this.shipState, this.shipFloorplan, this.componentRegistry);
    this.emitterInputs = pressureAwareEmitterInputs(
      this.shipState,
      this.shipFloorplan,
      (sectionId) => this.atmosphereRuntime.atmosphereOf(sectionId),
      motionAwareEmitterInputs(
        this.shipState,
        () => [
          ...this.crewState
            .all()
            .filter((actor) => actor.hp > 0 && actor.currentCell !== undefined)
            .map((actor) => actor.currentCell!),
          ...this.enemyState.all().filter((enemy) => enemy.hp > 0).map((enemy) => enemy.cell),
        ],
        { isBlocked: (cell) => this.motionBlockedQuery.isBlocked(cell) },
        allEmittersActive(this.shipState),
      ),
    );
    // Fase 13b: `powerRuntime` reemplaza el objeto inline de `PowerScarSource`
    // (antes leía `unpoweredSectionIds` directo) y además gatea por instancia
    // (`InstancePowerSource`) — el propio `MissionPowerRuntime` relee el
    // `Blueprint` vivo en cada tick, mismo criterio de "no congelar al
    // construir la misión" que regía antes.
    this.signalRuntime = new MissionSignalRuntime(
      this.shipState,
      this.emitterInputs,
      this.signalEvents,
      this.powerRuntime,
      this.powerRuntime,
    );
    const chemicalCatalog = buildChemicalCatalog();
    this.chemicalRegistry = chemicalCatalog.registry;
    this.chemicalFactory = chemicalCatalog.factory;
    this.reactionResolver = new ReactionResolver({ namedRecipeIndex: chemicalCatalog.namedRecipeIndex });
    this.projectiles = new ProjectileSimulation(
      new MissionProjectileWorld(
        this.shipState,
        this.signalRuntime,
        this.componentRegistry,
        this.crewState,
        this.enemyState,
      ),
      this.kineticEvents,
    );
    this.enemyThreatRuntime = new EnemyThreatRuntime({
      enemies: this.enemyState,
      // Un enemigo sembrado sin ruta registrada en `enemyRoutes` simplemente no
      // avanza, sigue atacable desde su celda de spawn si la tripulación
      // entra en rango (mismo comportamiento que regía sin contenido real).
      routes: this.enemyRoutes,
      crew: this.crewState,
      componentRegistry: this.componentRegistry,
      enemyEmitter: this.enemyEvents,
      crewEmitter: this.crewEvents,
    });
    this.loosePromoter = new LooseFerromagneticPromoter(
      this.shipState,
      this.projectiles,
      this.componentRegistry,
    );
    this.atmosphereRuntime = new MissionAtmosphereRuntime(
      this.shipFloorplan,
      save.shipState.sectionAtmospheres,
      // Escenario de fuga del Capítulo 1 (Subfase 11h — ahora objetivo formal
      // de la crisis, ver `chapter-01-primer-aviso.ts`): drena la sección
      // mientras la junta hermética no esté sellada, y la RECUPERA en cuanto
      // el jugador la repara (desmontar+instalar cuenta, se identifica por
      // posición, no por instanceId — mismo criterio que la resolución de
      // crisis `replacement-installed-connected`).
      sealBreachPressureSink(this.shipState, {
        position: CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE[save.metadata.archetype],
        acceptableComponentDefinitionIds: CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS,
        sectionId: CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE[save.metadata.archetype],
        drainRateKpaPerSecond: CHAPTER_01_SEAL_DRAIN_RATE_KPA_PER_SECOND,
        recoveryRateKpaPerSecond: CHAPTER_01_SEAL_RECOVERY_RATE_KPA_PER_SECOND,
      }),
    );
    this.structuralRuntime = new MissionStructuralRuntime(
      this.shipState,
      this.shipFloorplan,
      this.atmosphereRuntime,
      this.componentRegistry,
      this.chemicalRegistry,
      this.failureEvents,
    );
    this.shipStatusQuery = new ShipStatusQuery(
      this.shipState,
      this.shipFloorplan,
      this.atmosphereRuntime,
      this.componentRegistry,
      this.chemicalRegistry,
    );

    this.scheduler = new TaskScheduler({
      emitter: this.coreLoopEvents,
      effect: createShipTaskEffect(this.shipState, this.componentRegistry, this.atomicStock, this.shipFloorplan),
    });

    // Materialización diferida de una fabricación (11c.2): cuando el tripulante
    // completa su tarea `combine`, la creación pendiente pasa a estar disponible
    // en el picker de instalación. El motor no muta el Blueprint al fabricar
    // (crear la pieza ≠ instalarla, GDD 10.1), así que esto vive en el game-layer,
    // clavado en el evento de completación por `taskId` (el payload no viaja en él).
    this.coreLoopEvents.on("task-completed", (event) => {
      if (event.type !== "combine") return;
      const definition = this.pendingFabrications.get(event.taskId);
      if (definition) {
        this.pendingFabrications.delete(event.taskId);
        this.customCreations = [...this.customCreations, definition];
        return;
      }
      const substanceId = this.pendingSynthesis.get(event.taskId);
      if (substanceId) {
        this.pendingSynthesis.delete(event.taskId);
        this.availableSubstanceIds = [...this.availableSubstanceIds, substanceId];
      }
    });

    // "Analizar Sustancia" (Fase 11e): el efecto revela la identidad, no muta
    // el `Blueprint` — este listener solo actualiza el estado "analizada" que
    // consulta `isSubstanceAnalyzed`/`hazardPreviewFor`.
    this.coreLoopEvents.on("task-completed", (event) => {
      if (event.analyzedSubstanceId) {
        this.analyzedSubstanceIds.add(event.analyzedSubstanceId);
      }
    });

    const definition = CHAPTER_REGISTRY.get(save.chapterProgress.currentChapterId);
    if (!definition) {
      throw new Error(
        `MissionRuntime: no hay CrisisDefinition registrada para "${save.chapterProgress.currentChapterId}"`,
      );
    }
    this.crisisDefinition = definition;
    // Fase 12a: sobrecarga scripteada por contenido — sin simulación de carga
    // eléctrica real en el motor (ver comentario de `MissionOverloadRuntime`),
    // el guion de la crisis (`scriptedOverloads`, ausente = ninguno todavía en
    // ningún capítulo) es la única fuente de `load`/`capacity`.
    this.overloadRuntime = new MissionOverloadRuntime(
      this.shipState,
      this.componentRegistry,
      definition.scriptedOverloads ?? [],
      this.failureEvents,
    );
    // Fase 13a: química viva scripteada por contenido — sin fuente real de
    // sustancias/reservorios todavía (deuda #9/#10, Fase 13e), el guion de la
    // crisis (`scriptedReactions`, ausente = ninguna todavía en ningún
    // capítulo) es la única fuente de reactivos; oxígeno e ignición (vía
    // puente a `failureEvents`) sí son reales.
    this.reactionRuntime = new MissionReactionRuntime(
      this.shipState,
      this.shipFloorplan,
      definition.scriptedReactions ?? [],
      this.reactionResolver,
      (sectionId) => this.atmosphereRuntime.atmosphereOf(sectionId),
      this.reactionEvents,
      this.failureEvents,
    );
    this.crisisRuntime = new CrisisRuntime({
      definition,
      shipState: this.shipState,
      componentRegistry: this.componentRegistry,
      registries: {
        triggerRules: createDefaultCrisisTriggerRegistry(),
        resolutionRules: createDefaultCrisisResolutionRegistry(),
      },
      emitter: this.crisisEvents,
      // Al vencer el timer del cap. 2 con el combinador mal cableado, el runtime
      // aplica la consecuencia `crew-damage` sobre esta tripulación y emite el
      // evento por `crewEvents`.
      crew: this.crewState,
      crewEmitter: this.crewEvents,
    });
    // Evaluación inicial síncrona, fuera del `CoreLoopModeMachine` (que arranca
    // en "planning" y no tickea nada): GDD §4 ordena "1. Crisis se dispara. 2.
    // Modo planificación…" — la crisis ya está disparada CUANDO arranca la
    // planificación, no recién cuando el jugador aprieta Play por primera vez.
    this.crisisRuntime.tick({ dtSeconds: 0.001, elapsedSeconds: 0 });

    // Pasada síncrona (Fase 13b), mismo criterio que `crisisRuntime.tick`
    // arriba: el presupuesto de energía debe estar resuelto (cicatriz
    // permanente ∪ déficit de la asignación sembrada) ANTES de que
    // `signalRuntime`/la UI lean `unpoweredSectionIds` por primera vez, sin
    // esperar al primer tick de ejecución.
    this.powerRuntime.tick({ dtSeconds: 0.001, elapsedSeconds: 0 });

    // Pasada síncrona (Fase 11a.3), mismo criterio que `crisisRuntime.tick`
    // arriba: promueve piezas ferromagnéticas sueltas que ya vinieran en el
    // `Blueprint` inicial de la nave/capítulo, sin esperar al primer tick de
    // ejecución.
    this.loosePromoter.promote();

    this.coreLoop = new CoreLoopModeMachine(this.coreLoopEvents);
    this.coreLoop.registerTickable(this.scheduler);
    this.coreLoop.registerTickable(this.crisisRuntime);
    // Fase 11d.2: amenaza enemiga justo después de la crisis y antes de
    // señales/proyectiles — así, si un enemigo y un proyectil dañan al mismo
    // tripulante en el mismo tick, ambos se acumulan sobre el HP más reciente
    // en vez de que uno pise al otro.
    this.coreLoop.registerTickable(this.enemyThreatRuntime);
    // Fase 13b: el presupuesto de energía debe resolverse ANTES que las
    // señales lean `unpoweredSections()`/`isInstancePowered()` este mismo
    // tick — mismo criterio que atmósfera→estructura más abajo.
    this.coreLoop.registerTickable(this.powerRuntime);
    // Fase 11a: señales vivas + promoción de piezas sueltas + proyectiles. El
    // orden importa — las señales se evalúan ANTES que los proyectiles para
    // que una bobina que se energiza en este tick ya pulse en este tick, y no
    // con uno de retraso; la promoción va ENTRE ambas (Fase 11a.3) para que
    // una pieza instalada este tick ya pueda acelerarse en el mismo tick si
    // ya hay campo activo.
    this.coreLoop.registerTickable(this.signalRuntime);
    this.coreLoop.registerTickable(this.loosePromoter);
    this.coreLoop.registerTickable(this.projectiles);
    // Fase 11b: atmósfera viva ANTES que la cicatriz estructural, para que
    // `MissionStructuralRuntime` lea el nivel corrosivo YA difundido este tick.
    this.coreLoop.registerTickable(this.atmosphereRuntime);
    this.coreLoop.registerTickable(this.structuralRuntime);
    // Fase 12a: sin dependencia de dato vivo de otro runtime (el guion ya trae
    // load/capacity fijos), el orden respecto a atmósfera/estructura no
    // importa — se registra al final de este bloque por prolijidad.
    this.coreLoop.registerTickable(this.overloadRuntime);
    // Fase 13a: sin dependencia de dato vivo de otro runtime más allá del
    // puente a `failureEvents` (ya suscrito en el constructor, no en el
    // tick), se registra al final junto a `overloadRuntime`.
    this.coreLoop.registerTickable(this.reactionRuntime);

    const spawnSectionId = this.shipFloorplan.sections[0]?.id;
    for (const actor of this.activeCrew) {
      const sectionId = actor.currentSectionId ?? spawnSectionId;
      this.scheduler.registerActor({ ...actor, currentSectionId: sectionId });
      // Fase 11d.4 (fix de PENDIENTES_OBSERVACIONES.md punto 4, mitad "game"):
      // sin esto `crewState` nunca tenía una celda real, así que ni un
      // proyectil ni un enemigo podían golpear a la tripulación en partida
      // real (solo en tests que construían el `CrewActor` a mano). Se ancla
      // al centroide de la sección de spawn/save; `syncCrewCell`
      // (`floorplan-scene.ts`) la mantiene al día cuando el actor viaja.
      const section = sectionId && this.shipFloorplan.sections.find((entry) => entry.id === sectionId);
      if (section) {
        const live = this.crewState.get(actor.id);
        if (live) this.crewState.set({ ...live, currentCell: sectionCentroidCell(section) });
      }
    }
  }

  /**
   * Inyecta el bloqueo de línea de visión real (Fase 13a, deuda #3) una vez
   * que `FloorplanScene` construye el `WalkableGrid` del arquetipo — el
   * motor no puede tenerlo en el constructor porque `MissionRuntime` no
   * conoce Phaser/Tiled. Sin llamar a esto, el sensor óptico ve a través de
   * cualquier pared (fallback "nada bloqueado", igual criterio que el
   * pathing de tripulación sin tile art).
   */
  setMotionBlockedQuery(query: CellBlockedQuery): void {
    this.motionBlockedQuery = query;
  }

  get crisisState(): CrisisState {
    return this.crisisRuntime.crisisState;
  }

  /** Estado del checklist de objetivos (una meta general por resolución de la crisis), evaluado en vivo. */
  objectiveStatuses(): ReadonlyArray<{ readonly objectiveKey?: string; readonly done: boolean }> {
    return this.crisisRuntime.objectiveStatuses();
  }

  /**
   * Trayectoria fantasma por proyectil vivo (Fase 11a.3, ASA 3): una
   * predicción por proyectil, calculada sobre una copia congelada del estado
   * actual — pensada para llamarse UNA vez al entrar en modo planificación
   * (`FloorplanScene`, caso `"core-loop-mode-changed"`), no por frame, porque
   * el reloj está totalmente congelado en pausa y nada de lo que alimenta la
   * predicción puede cambiar mientras tanto.
   */
  previewProjectileTrajectories(): ReadonlyMap<string, ReadonlyArray<TrajectoryPreviewStep>> {
    const result = new Map<string, ReadonlyArray<TrajectoryPreviewStep>>();
    for (const state of this.projectiles.all) {
      result.set(
        state.ref,
        previewMissionTrajectory({
          blueprint: this.blueprint,
          signalState: this.signalRuntime.signalState,
          emitterInputs: this.emitterInputs,
          registry: this.componentRegistry,
          projectiles: this.projectiles,
          ref: state.ref,
        }),
      );
    }
    return result;
  }

  /**
   * Posición de la instancia que originó la crisis, para el marcador visual
   * (Fase 10d, ajuste post-playtest). Resuelto solo para
   * `jammed-actuator-blocks-section` — único `kind` de trigger que existe
   * hoy; un capítulo futuro con otro `kind` sin posición obvia se resuelve
   * cuando exista, no antes (mismo criterio de "no construir mecanismo antes
   * del caso de uso" ya aplicado en el resto de la fase).
   */
  get problemMarkerPosition(): GridPosition | undefined {
    const trigger = this.crisisDefinition.triggers.find(
      (candidate) => candidate.kind === "jammed-actuator-blocks-section",
    );
    if (!trigger) {
      return undefined;
    }
    return this.blueprint.placedComponents.find((entry) => entry.instanceId === trigger.instanceId)?.placement
      .position;
  }

  /** Sección "efectiva" del actor tras sus tareas ya encoladas (no terminales) — ver plan de 10d. */
  plannedSectionFor(actorId: CrewActorId): SectionId | undefined {
    const queue = this.scheduler.queueFor(actorId);
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      const task = queue[i]!;
      if (task.type === "go-to" && task.state !== "cancelled" && task.state !== "failed") {
        return task.targetSectionId;
      }
    }
    return this.scheduler.getActor(actorId)?.currentSectionId;
  }

  private nextTaskId(): CrewTaskId {
    this.taskCounter += 1;
    return `task-${this.taskCounter}` as CrewTaskId;
  }

  /** Duración modulada por afinidad de especialidad/tier (GDD 6.6) para una acción con afinidad definida. */
  private modulatedDuration(action: ModulatedTaskType, actorId: CrewActorId): number {
    const actor = this.activeCrew.find((entry) => entry.id === actorId);
    const base = baseDurationFor(action);
    if (!actor) {
      return base;
    }
    return base * durationMultiplierFor(action, actor.specialty, actor.tier);
  }

  private queueGoTo(actorId: CrewActorId, targetSectionId: SectionId): void {
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "go-to",
        targetSectionId,
      }),
    );
  }

  private ensureAt(actorId: CrewActorId, targetSectionId: SectionId | undefined): void {
    if (targetSectionId === undefined) {
      return;
    }
    if (this.plannedSectionFor(actorId) !== targetSectionId) {
      this.queueGoTo(actorId, targetSectionId);
    }
  }

  queueDismantle(actorId: CrewActorId, instanceId: PlacedComponentInstanceId): void {
    const instance = this.shipState.get().placedComponents.find((entry) => entry.instanceId === instanceId);
    const targetSectionId = instance && this.sectionIdAt(instance.placement.position);
    this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "dismantle",
        targetSectionId,
        payload: { kind: "dismantle", instanceId },
        estimatedDurationSeconds: this.modulatedDuration("dismantle", actorId),
      }),
    );
  }

  /**
   * Carga las creaciones custom del jugador (mesa de creación / import `.kludge`)
   * y las registra en `componentRegistry` para que se puedan instalar y cablear
   * en misión (11c.1): sin registrarlas, `ship-task-effect.ts::installInstance`
   * no resolvería su definición al completar la tarea y no derivaría sus nodos.
   * Async (lee de disco vía Electron); `FloorplanScene` la dispara al iniciar la
   * misión, mucho antes de que el jugador pueda abrir el picker de instalación.
   * Una creación mal formada se salta sin abortar el resto (mismo criterio
   * tolerante que el resto del sistema de guardado).
   */
  async loadInstallableCreations(): Promise<ReadonlyArray<PhysicalComponentDefinition>> {
    const ids = await listCustomCreations();
    const loaded: PhysicalComponentDefinition[] = [];
    for (const id of ids) {
      try {
        const creation = await loadCustomCreation(id);
        this.componentRegistry.register(creation.definition.id, creation.definition);
        loaded.push(creation.definition);
      } catch {
        // Creación corrupta/incompatible: se omite, no bloquea la misión.
      }
    }
    this.customCreations = loaded;
    return loaded;
  }

  /** Creaciones custom instalables en esta misión (11c.1) — el picker las lista junto a los atómicos. */
  get installableCreations(): ReadonlyArray<PhysicalComponentDefinition> {
    return this.customCreations;
  }

  /** Definición (atómica o compuesta) de un componente por id — para inspector/picker sin acoplar a `ATOMIC_COMPONENT_CATALOG`. */
  definitionOf(componentDefinitionId: ComponentId): PhysicalComponentDefinition | undefined {
    return this.componentRegistry.get(componentDefinitionId);
  }

  /** Unidades disponibles de una pieza atómica en el stock vivo de esta misión — el picker filtra por esto. */
  stockOf(componentId: ComponentId): number {
    return stockOf(this.atomicStock.get(), componentId);
  }

  /** Todo compuesto conocido por el registry de esta misión (catálogo + creaciones ya registradas) — pestaña "Catálogo" del picker. */
  get knownCompositeDefinitions(): ReadonlyArray<PhysicalComponentDefinition> {
    return this.componentRegistry.all().filter(isCompositeEntity);
  }

  /**
   * Encola una fabricación en la mesa (11c.2): la creación ya diseñada por el
   * jugador se registra en el `componentRegistry` (para poder resolverla luego)
   * y se encola una tarea `combine` que consume tiempo del tripulante — modulada
   * por su afinidad de Ingeniero y tier (GDD 6.6). La creación NO queda disponible
   * para instalar hasta que la tarea se completa (materialización diferida, ver la
   * suscripción a `task-completed` en el constructor). Consecuencia de tiempo real,
   * no instantánea (principio 5).
   */
  queueFabrication(actorId: CrewActorId, definition: PhysicalComponentDefinition): void {
    this.componentRegistry.register(definition.id, definition);
    const taskId = this.nextTaskId();
    this.pendingFabrications.set(taskId, definition);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "combine",
        targetSectionId: this.plannedSectionFor(actorId),
        estimatedDurationSeconds: this.modulatedDuration("combine", actorId),
      }),
    );
  }

  /** Sustancias sintetizadas ya disponibles en esta misión (11c.3), consumidas por el inspector de sustancias (Fase 11e). */
  get availableSubstances(): ReadonlyArray<ChemicalSubstanceDefinition> {
    return this.availableSubstanceIds
      .map((id) => this.chemicalRegistry.get(id))
      .filter((definition): definition is ChemicalSubstanceDefinition => definition !== undefined);
  }

  /** true si "Analizar Sustancia" (Fase 11e) ya reveló los valores de riesgo de esta sustancia. */
  isSubstanceAnalyzed(substanceId: ChemicalSubstanceId): boolean {
    return this.analyzedSubstanceIds.has(substanceId);
  }

  /**
   * Ficha de riesgo revelada por el análisis (Fase 11e) — `undefined` si la
   * sustancia todavía no fue analizada. Se recalcula en cada consulta con el
   * O2 ACTUAL de la sección indicada (decisión confirmada con el operador: el
   * radio de combustión mostrado es en vivo, no un número fijo de peor caso).
   */
  hazardPreviewFor(substanceId: ChemicalSubstanceId, sectionId: SectionId): MixtureHazardPreview | undefined {
    if (!this.isSubstanceAnalyzed(substanceId)) {
      return undefined;
    }
    const definition = this.chemicalRegistry.get(substanceId);
    if (!definition) {
      return undefined;
    }
    const atmosphere = this.atmosphereRuntime.atmosphereOf(sectionId);
    const oxygen = atmosphere ? sectionCombustionAtmosphere(atmosphere) : "none";
    return deriveMixtureHazardPreview(definition.data.tags, oxygen);
  }

  /**
   * Encola "Analizar Sustancia" (Fase 11e): revela la ficha de riesgo de una
   * "Mezcla sin identificar" ya disponible. Cualquier tripulante puede
   * ejecutarla — el Médico solo la hace más rápido vía `durationMultiplierFor`
   * (GDD: "cualquier tripulante puede intentar cualquier tarea"), sin gate
   * duro por especialidad.
   */
  queueAnalyzeSubstance(actorId: CrewActorId, substanceId: ChemicalSubstanceId): void {
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "analyze-substance",
        targetSectionId: this.plannedSectionFor(actorId),
        payload: { kind: "analyze-substance", substanceId },
        estimatedDurationSeconds: this.modulatedDuration("analyze-substance", actorId),
      }),
    );
  }

  /**
   * Encola una síntesis química en la mesa (11c.3): cablea `synthesizeSubstance`
   * (motor) al catálogo real de esta misión. La resolución de identidad es
   * determinística (GDD 5.3), así que se resuelve al encolar; lo que se difiere
   * hasta completar la tarea `combine` es solo su disponibilidad
   * (`availableSubstances`) — mismo criterio de "crear ≠ disponible" que
   * `queueFabrication`, y misma afinidad de Ingeniero (GDD 6.6, "Fabricar en la
   * mesa es trabajo de Ingeniero"). Devuelve el nombre resuelto (feedback de
   * playtest de 11c.3: la mesa cerraba sin decir qué se sintetizó) para que el
   * llamador lo muestre; `undefined` si la selección no alcanzó a resolver nada
   * (menos de 2 reactivos — no debería ocurrir si la escena ya validó antes).
   */
  queueSynthesis(
    actorId: CrewActorId,
    selectedElementIds: ReadonlyArray<ChemicalSubstanceId>,
  ): string | undefined {
    const outcome = synthesizeSubstance(
      this.reactionResolver,
      this.chemicalRegistry,
      this.chemicalFactory,
      selectedElementIds,
    );
    if (!outcome.result) {
      return undefined;
    }
    const taskId = this.nextTaskId();
    this.pendingSynthesis.set(taskId, outcome.result.id);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "combine",
        targetSectionId: this.plannedSectionFor(actorId),
        estimatedDurationSeconds: this.modulatedDuration("combine", actorId),
      }),
    );
    return outcome.result.name;
  }

  /**
   * Preview de solo lectura de una síntesis (11c.3, feedback de playtest: no
   * se veían las características del resultado antes de confirmar). A
   * diferencia de `queueSynthesis`/`synthesizeSubstance`, NO registra nada en
   * el catálogo — llama directo al `ReactionResolver` para poder invocarse en
   * cada cambio de selección sin efectos secundarios acumulativos. `null` si
   * hay menos de 2 sustancias seleccionadas (mismo mínimo que exige el motor).
   */
  previewSynthesis(selectedElementIds: ReadonlyArray<ChemicalSubstanceId>): ReactantSubstance | null {
    if (selectedElementIds.length < 2) {
      return null;
    }
    const reactants = selectedElementIds
      .map((id) => this.chemicalRegistry.get(id))
      .filter((definition): definition is ChemicalSubstanceDefinition => definition !== undefined)
      .map((definition) => toReactant(definition));
    if (reactants.length < 2) {
      return null;
    }
    return this.reactionResolver.resolve({
      reactants,
      oxygen: "normal",
      ignitionPresent: false,
      thermalRegulatorOverloaded: false,
      elapsedSeconds: 0,
    }).result;
  }

  queueInstall(
    actorId: CrewActorId,
    componentDefinitionId: ComponentId,
    footprint: Footprint,
    position: GridPosition,
  ): void {
    const targetSectionId = this.sectionIdAt(position);
    this.ensureAt(actorId, targetSectionId);
    const instanceId = `install-${Date.now()}-${this.taskCounter}` as PlacedComponentInstanceId;
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "install",
        targetSectionId,
        payload: {
          kind: "install",
          instanceId,
          componentDefinitionId,
          placement: { position, footprint, rotation: 0 },
        },
        estimatedDurationSeconds: this.modulatedDuration("install", actorId),
      }),
    );
  }

  queueConnect(actorId: CrewActorId, fromNodeId: SignalNodeId, toNodeId: SignalNodeId): void {
    const nodes = this.shipState.get().signalGraph.nodes;
    const fromNode = nodes.find((node) => node.id === fromNodeId);
    const toNode = nodes.find((node) => node.id === toNodeId);
    // Orientar SIEMPRE emisor → receptor sin importar el orden de click: la
    // resolución de señal del cap. 2 (`signal-output-matches`) es sensible a la
    // dirección (un emisor debe ser origen del cable para que el receptor lo lea
    // como entrada), mientras que el cap. 1 (`signal-nodes-wired`) es no dirigido
    // y no se ve afectado. Si el jugador clickeó el receptor antes que el emisor,
    // se invierte para que el cable quede útil.
    let source = fromNodeId;
    let target = toNodeId;
    let targetNode = toNode;
    if (toNode?.role === "emitter" && fromNode?.role !== "emitter") {
      source = toNodeId;
      target = fromNodeId;
      targetNode = fromNode;
    }
    const targetSectionId = targetNode && this.sectionIdAt(targetNode.position);
    this.ensureAt(actorId, targetSectionId);
    const edgeId = `edge-${Date.now()}-${this.taskCounter}` as SignalEdgeId;
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "connect",
        targetSectionId,
        payload: { kind: "connect", edgeId, fromNodeId: source, toNodeId: target },
        estimatedDurationSeconds: this.modulatedDuration("connect", actorId),
      }),
    );
  }

  private sectionIdAt(position: GridPosition): SectionId | undefined {
    return sectionContainingCell(this.shipFloorplan, position)?.id;
  }

  get blueprint(): Blueprint {
    return this.shipState.get();
  }

  /** Estado agregado a nivel de nave (Subfase 11g) — pull-based, se recalcula en cada lectura. */
  get shipStatus(): ShipStatusSnapshot {
    return this.shipStatusQuery.snapshot();
  }

  /** Integridad de casco de UNA sección (Fase 12a, capa "estructural" del HUD del plano). */
  sectionHullIntegrity(sectionId: SectionId): ShipStatusIndicator {
    return this.shipStatusQuery.sectionHullIntegrity(sectionId);
  }

  /** Presupuesto total de unidades de energía de la nave (Fase 13b, capa "energia" del HUD del plano). */
  totalPowerBudget(): number {
    return totalPowerBudget(this.blueprint.placedComponents, this.componentRegistry);
  }

  /** Unidades asignadas por el jugador a una sección (Fase 13b); 0 si no tiene asignación explícita. */
  sectionPowerAllocation(sectionId: SectionId): number {
    return (
      this.blueprint.powerState.sectionAllocations.find((entry) => entry.sectionId === sectionId)?.units ?? 0
    );
  }

  /**
   * Señal puramente cosmética (Fase 13b, ronda 2 de playtest): la sección
   * tiene 0 unidades otorgadas EN VIVO, sin excepciones — a diferencia de
   * `blueprint.unpoweredSectionIds`, que refleja solo la cicatriz permanente
   * y alimenta gating de señales/HUD. Usada exclusivamente por el efecto
   * visual ambiental de sección (`floorplan-scene.ts`).
   */
  sectionHasNoPowerGranted(sectionId: SectionId): boolean {
    return this.powerRuntime.sectionHasNoPowerGranted(sectionId);
  }

  /** Suma de `powerDraw` de los componentes de una sección (Fase 13b, heatmap de la capa "energia"). */
  sectionPowerDemand(sectionId: SectionId): number {
    let demand = 0;
    for (const instance of this.blueprint.placedComponents) {
      if (this.sectionIdAt(instance.placement.position) !== sectionId) {
        continue;
      }
      const definition = this.componentRegistry.get(instance.componentDefinitionId);
      const actuator = definition?.data.functional?.find((property) => property.tag === "ACT");
      if (actuator && actuator.tag === "ACT") {
        demand += actuator.powerDraw ?? 0;
      }
    }
    return demand;
  }

  /**
   * Fija en bloque la asignación de unidades del jugador a una sección
   * (dial +1/-1, Fase 13b, UI en modo pausa). `MissionPowerRuntime` recalcula
   * el resultado en el siguiente tick — este método solo escribe la entrada
   * de datos, no decide qué queda alimentado.
   */
  setSectionPowerUnits(sectionId: SectionId, units: number): void {
    const blueprint = this.shipState.get();
    const clamped = Math.max(0, Math.round(units));
    const withoutSection = blueprint.powerState.sectionAllocations.filter((entry) => entry.sectionId !== sectionId);
    const sectionAllocations: SectionPowerAllocation[] =
      clamped === 0 ? withoutSection : [...withoutSection, { sectionId, units: clamped }];
    this.shipState.set({ ...blueprint, powerState: { ...blueprint.powerState, sectionAllocations } });
  }

  /**
   * Prioridad manual de las instancias de una sección, ordenadas de más a
   * menos prioritaria (Fase 13b, lista de reordenamiento del inspector de la
   * capa). Instancias sin prioridad explícita aparecen al final, en el mismo
   * orden determinista (`instanceId`) que usa `allocateComponentPower`.
   */
  instancePowerPriorityOrder(sectionId: SectionId): ReadonlyArray<PlacedComponentInstanceId> {
    const blueprint = this.shipState.get();
    const priorityByInstance = new Map(
      blueprint.powerState.instancePriorities.map((entry) => [entry.instanceId, entry.priority]),
    );
    return blueprint.placedComponents
      .filter((instance) => this.sectionIdAt(instance.placement.position) === sectionId)
      .map((instance) => instance.instanceId)
      .sort((a, b) => {
        const priorityA = priorityByInstance.get(a) ?? Number.POSITIVE_INFINITY;
        const priorityB = priorityByInstance.get(b) ?? Number.POSITIVE_INFINITY;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a < b ? -1 : a > b ? 1 : 0;
      });
  }

  /**
   * Mueve una instancia un puesto arriba/abajo en la prioridad de su sección
   * (botones ↑/↓, Fase 13b, UI). Reescribe la tabla completa de prioridades
   * de la sección con valores 0..n-1 en el nuevo orden — mantiene el dato
   * compacto en vez de acumular huecos entre reordenamientos sucesivos.
   */
  reorderInstancePriority(sectionId: SectionId, instanceId: PlacedComponentInstanceId, direction: -1 | 1): void {
    const order = [...this.instancePowerPriorityOrder(sectionId)];
    const index = order.indexOf(instanceId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= order.length) {
      return;
    }
    [order[index], order[target]] = [order[target]!, order[index]!];

    const blueprint = this.shipState.get();
    const otherSectionsPriorities = blueprint.powerState.instancePriorities.filter(
      (entry) => !order.includes(entry.instanceId),
    );
    const instancePriorities: InstancePowerPriority[] = [
      ...otherSectionsPriorities,
      ...order.map((id, priority) => ({ instanceId: id, priority })),
    ];
    this.shipState.set({ ...blueprint, powerState: { ...blueprint.powerState, instancePriorities } });
  }

  /**
   * Peor contaminante presente en una sección (Fase 11b), para el efecto
   * state-driven de fuga de gas (`atmosphere-state-effects.ts`). Devuelve el
   * dato de dominio (concentración + tag químico); el tinte concreto por tag
   * lo decide quien pinta (`FloorplanScene`, mismo `CLOUD_TINT` que ya usa
   * `hazard-effect.ts` para el mismo fenómeno — principio 6, no dos colores
   * distintos para lo mismo).
   */
  contaminantAt(sectionId: SectionId): { readonly concentration: number; readonly tag: "TOX" | "CORR" } | undefined {
    const atmosphere = this.atmosphereRuntime.atmosphereOf(sectionId);
    if (!atmosphere) {
      return undefined;
    }
    let worst: { concentration: number; tag: "TOX" | "CORR" } | undefined;
    for (const [gasKey, concentration] of atmosphere.gases) {
      if (concentration <= 0 || (worst && concentration <= worst.concentration)) {
        continue;
      }
      const substance = this.chemicalRegistry.get(gasKey as ChemicalSubstanceId);
      if (!substance) {
        continue;
      }
      const tagName = substance.data.tags.some((tag) => tag.name === "CORR")
        ? "CORR"
        : substance.data.tags.some((tag) => tag.name === "TOX")
          ? "TOX"
          : undefined;
      if (tagName) {
        worst = { concentration, tag: tagName };
      }
    }
    return worst;
  }

  /**
   * Escribe de vuelta el estado VIVO de la misión al formato persistente (10f):
   * la nave modificada (`this.blueprint`, tras desmontajes/instalaciones/cables)
   * pasa a `shipState`, y el `status`/sección de cada tripulante activo se
   * refresca desde el scheduler. `activeCrewIds` y el resto del roster quedan
   * intactos. Es el ÚNICO punto de write-back del estado de misión al save.
   *
   * El HP del tripulante no lo modela el scheduler (`SchedulerActorSnapshot` no
   * lo lleva): el HP vivo (herido por la consecuencia `crew-damage` del cap. 2)
   * vive en `crewState`, de donde se lee aquí. El status/sección sí salen del
   * scheduler. Solo se refresca la tripulación ACTIVA; el resto del roster y
   * `activeCrewIds` quedan intactos.
   */
  toUpdatedSave(base: CampaignSaveState): CampaignSaveState {
    const updatedCrew = base.crew.map((actor) => {
      const live = this.scheduler.getActor(actor.id);
      const damaged = this.crewState.get(actor.id);
      if (!live && !damaged) {
        return actor;
      }
      return {
        ...actor,
        hp: damaged?.hp ?? actor.hp,
        status: live?.status ?? actor.status,
        currentSectionId: live?.currentSectionId ?? actor.currentSectionId,
        currentCell: damaged?.currentCell ?? actor.currentCell,
      };
    });
    return {
      ...base,
      shipState: { ...this.blueprint, sectionAtmospheres: this.atmosphereRuntime.toSnapshots() },
      crew: updatedCrew,
      atomicStock: this.atomicStock.get(),
    };
  }
}
