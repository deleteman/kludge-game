import {
  ALL_COMPOSITE_SPECS,
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
  stockOfWear,
  wearBucketsOf,
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
  composePressureSinks,
  TransientLeakPressureSink,
  dismantleHazardKinds,
  isElectricSource,
  dismantleHazardContext,
  buildChemicalCatalog,
  buildComponentCatalog,
  createCrewTask,
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
  consumeElements,
  contentOf,
  createShipTaskEffect,
  DEFAULT_WEAR,
  elementsPerUnit,
  extractionBlockedReason,
  findFabricators,
  freeCapacity,
  instanceFabricatorDomain,
  instanceReservoirCapacity,
  isFluidTransferReachable,
  FluidOperationRegistry,
  MutableElementStock,
  pourInto,
  TransientGasInjection,
  deriveMixtureHazardPreview,
  durationMultiplierFor,
  baseDurationFor,
  isCompositeEntity,
  sectionCombustionAtmosphere,
  sectionArea,
  sectionContainingCell,
  synthesizeSubstance,
  systemRandom,
  toReactant,
  totalPowerBudget,
  MapEntityRegistry,
  GAS,
} from "engine";
import type {
  ComponentWear,
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
  ChemicalTag,
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
  PowerDomainEvent,
  SalvageDomainEvent,
  DismantleHazardKind,
  ScriptedRoute,
  SectionPowerAllocation,
  SignalDomainEvent,
  PlacedComponentInstanceId,
  SectionId,
  ShipFloorplan,
  SignalEdgeId,
  FabricatorDomain,
  FluidFlow,
  SignalNodeId,
  SubstanceCompositionContext,
  TrajectoryPreviewStep,
} from "engine";

/**
 * Unidades que rinde una síntesis (Subfase 13e). Fijo y no proporcional a los
 * elementos gastados: la resolución de identidad de GDD 5.3 es cualitativa
 * (qué sustancia sale), no estequiométrica — modelar rendimiento por cantidad
 * sería justo la simulación química real que CLAUDE.md descarta. Ajustable en
 * el balanceo de la Fase 23.
 */
const SYNTHESIS_YIELD_UNITS = 10;

/**
 * Segundos de referencia sobre los que se reparte el caudal de una operación de
 * fluido (13e). No es la duración real de la tarea (que varía por tier del
 * tripulante): solo la escala para convertir "cuántas unidades" en "qué tan
 * intenso se ve el conducto".
 */
const FLUID_OPERATION_REFERENCE_SECONDS = 10;

/**
 * Gases de la atmósfera NORMAL (`GAS`, GDD 5.5). Se excluyen de la lectura
 * visual de `airborneSubstanceAt`: pintar una nube por el nitrógeno que
 * respira la tripulación sería ruido permanente en las 8 secciones. Cualquier
 * otra clave del mapa es un `ChemicalSubstanceId` (convención de 13a).
 */
const BASELINE_GAS_KEYS = new Set<string>(Object.values(GAS));

/** Acciones del core loop con afinidad de especialidad (GDD 6.6); `combine` = fabricar en la mesa (11c.2). */
type ModulatedTaskType =
  | "dismantle"
  | "install"
  | "connect"
  | "combine"
  | "analyze-substance"
  // Subfase 13d — tareas de asegurado, con afinidad de Ingeniero.
  | "cut-power"
  | "purge-reservoir"
  | "discharge-source"
  // Subfase 13e — ciclo de vida de una sustancia.
  | "transfer-substance"
  | "apply-substance"
  | "extract-elements";

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
  /** Déficit de energía (Fase 13b ronda 4: se pidió más de lo que la nave entrega) — `/game` lo avisa. */
  readonly powerEvents = new EventEmitter<PowerDomainEvent>();
  /** Riesgo al canibalizar (Subfase 13d: chispa/derrame/fuga al desmontar una pieza viva) — `/game` los pinta. */
  readonly salvageEvents = new EventEmitter<SalvageDomainEvent>();
  /** Fugas acotadas abiertas por desmontar en una sección comprometida (13d). */
  private readonly leakSink = new TransientLeakPressureSink();
  /**
   * Último `elapsedSeconds` visto por el core loop. Los hazards de 13d se
   * disparan DENTRO del efecto de una tarea, que no recibe `TickContext` — sin
   * esto, todos sus eventos de dominio saldrían con `elapsedSeconds: 0`.
   */
  private lastElapsedSeconds = 0;
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
  /** Estación química donde depositar el resultado al completarse (13e). */
  private readonly pendingSynthesisStation = new Map<CrewTaskId, PlacedComponentInstanceId>();
  /**
   * Qué materializó cada tarea `combine` (ronda 5), consultable por
   * `consumeMaterializedByTask`. `FloorplanScene` notificaba una síntesis
   * comparando `availableSubstances.length` antes/después — ese getter es un
   * `Set` deduplicado por sustancia, así que una segunda síntesis de la MISMA
   * sustancia (ya presente en algún reservorio) no crecía el conteo y la
   * notificación no disparaba, aunque el material sí se depositó. Este mapa
   * guarda el dato exacto que ya se conoce en el mismo listener que
   * materializa, sin pasar por ningún conteo indirecto.
   */
  private readonly materializedByTaskId = new Map<
    CrewTaskId,
    { readonly kind: "substance" | "creation"; readonly name: string }
  >();
  /**
   * Sustancias ya analizadas por "Analizar Sustancia" (Fase 11e) — estado
   * durable y re-consultado en cada render del tooltip (no un toast de un solo
   * uso como `obtained`), por eso vive en un Set aparte en vez de reenviarse
   * por evento hacia `/game`.
   */
  private readonly analyzedSubstanceIds = new Set<ChemicalSubstanceId>();
  /**
   * Subfase 13e: inventario de elementos y procedencia de las mezclas. Los dos
   * viajan en el guardado (`schemaVersion` 5) — la procedencia porque sin ella
   * una "Mezcla sin identificar" sería indescomponible para siempre, y las
   * analizadas porque pasaron de ser flavor a PRECONDICIÓN de la extracción.
   */
  readonly elementStock: MutableElementStock;
  private substanceProvenance: Record<string, ReadonlyArray<ChemicalSubstanceId>>;
  /**
   * Buffer de sustancias vertidas sobre la atmósfera, drenado por el runtime de
   * atmósfera. Las dos consultas son closures y no valores porque este campo se
   * inicializa ANTES del cuerpo del constructor: se resuelven al inyectar, no
   * al declarar. Con ellas (ronda 3) solo los gases y volátiles llegan al aire,
   * y la fracción se escala por el volumen de la sección.
   */
  private readonly gasInjection = new TransientGasInjection({
    substanceOf: (substanceId) => this.chemicalRegistry.get(substanceId),
    sectionVolumeOf: (sectionId) => {
      const section = this.shipFloorplan.sections.find((entry) => entry.id === sectionId);
      return section && sectionArea(section);
    },
  });
  /**
   * Operaciones de fluido en curso (13e, deuda #10) — de acá sale el caudal
   * REAL con que se anima la capa `fluido` del plano, en vez de la heurística
   * prestada del booleano de energía.
   */
  readonly fluidOperations = new FluidOperationRegistry();
  /** Caudal declarado por una tarea al encolarse; se activa al empezar y se retira al terminar. */
  private readonly pendingFluidFlows = new Map<CrewTaskId, FluidFlow>();
  private taskCounter = 0;

  constructor(save: CampaignSaveState) {
    this.shipFloorplan = CANONICAL_SHIP_FLOORPLANS[save.metadata.archetype];
    this.shipState = new MutableShipState(save.shipState);
    this.atomicStock = new MutableAtomicStock(save.atomicStock);
    this.elementStock = new MutableElementStock(save.elementStock ?? {});
    this.substanceProvenance = { ...(save.substanceProvenance ?? {}) };
    for (const substanceId of save.analyzedSubstanceIds ?? []) {
      this.analyzedSubstanceIds.add(substanceId);
    }
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
    this.powerRuntime = new MissionPowerRuntime(
      this.shipState,
      this.shipFloorplan,
      this.componentRegistry,
      this.powerEvents,
    );
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
      // Subfase 13d: el runtime acepta UN solo sumidero, así que la junta rota
      // del capítulo y las fugas por desmontaje se componen en uno
      // (`composePressureSinks`) en vez de competir por el mismo hueco.
      composePressureSinks(
        sealBreachPressureSink(this.shipState, {
          position: CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE[save.metadata.archetype],
          acceptableComponentDefinitionIds: CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS,
          sectionId: CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE[save.metadata.archetype],
          drainRateKpaPerSecond: CHAPTER_01_SEAL_DRAIN_RATE_KPA_PER_SECOND,
          recoveryRateKpaPerSecond: CHAPTER_01_SEAL_RECOVERY_RATE_KPA_PER_SECOND,
        }),
        this.leakSink.asSinkSource(),
      ),
      // Subfase 13e: sustancias VERTIDAS sobre la sección ("Aplicar aquí").
      // Es el primer escritor real de un `ChemicalSubstanceId` en
      // `atmosphere.gases`; hasta ahora solo existían lectores.
      this.gasInjection.asInjectionSource(),
    );
    this.salvageEvents.on("dismantle-leak", (event) => this.leakSink.register(event));
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
      // Fase 13b ronda 5: sin esta fuente el indicador de energía del HUD queda
      // clavado en nominal (solo miraría la cicatriz permanente, hoy vacía).
      this.powerRuntime,
    );

    this.scheduler = new TaskScheduler({
      emitter: this.coreLoopEvents,
      effect: createShipTaskEffect(
        this.shipState,
        this.componentRegistry,
        this.atomicStock,
        this.shipFloorplan,
        // Fase 13c: canibalizar degrada la pieza con probabilidad por tier
        // (GDD §6.5). El azar se inyecta desde acá — `/engine` sigue sin
        // llamar `Math.random` por su cuenta — y el lookup de tripulación es
        // lo que permite leer el tier/especialidad de quien ejecuta la tarea.
        { random: systemRandom, actorOf: (actorId) => this.crewState.get(actorId) },
        // Subfase 13d: riesgo sistémico al desmontar. Las tres consultas al
        // mundo vivo que definen "pieza viva" — energía (13b), atmósfera de la
        // sección y el reloj — se inyectan desde acá; `/engine` no conoce
        // ninguno de esos runtimes por su cuenta.
        {
          // Fix de playtest ronda 1: NO `isInstancePowered` (significa "su
          // demanda está satisfecha" y da true para cualquier pieza sin
          // `powerDraw`, incluso con la sección a 0 — ver `instance-energized.ts`).
          // Este es el MISMO dato que pinta el efecto visual de zona oscura.
          sectionHasGrantedPower: (sectionId) => !this.powerRuntime.sectionHasNoPowerGranted(sectionId),
          atmosphereOf: (sectionId) => this.atmosphereRuntime.atmosphereOf(sectionId),
          elapsedSecondsOf: () => this.lastElapsedSeconds,
          handler: {
            emitter: this.salvageEvents,
            crewEmitter: this.crewEvents,
            actorOf: (actorId) => this.crewState.get(actorId),
            setActor: (actor) => this.crewState.set(actor),
          },
        },
        // Subfase 13e: inventario de elementos, buffer atmosférico y catálogo
        // químico + procedencia, para las tres tareas de sustancias.
        {
          elementStock: this.elementStock,
          gasInjection: this.gasInjection,
          // Función y no objeto: se consulta en CADA ejecución de tarea, para
          // que analizar una sustancia a mitad de misión cuente de inmediato.
          composition: () => this.substanceCompositionContext(),
        },
      ),
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
        this.materializedByTaskId.set(event.taskId, { kind: "creation", name: definition.name });
        return;
      }
      const substanceId = this.pendingSynthesis.get(event.taskId);
      if (substanceId) {
        this.pendingSynthesis.delete(event.taskId);
        const stationInstanceId = this.pendingSynthesisStation.get(event.taskId);
        this.pendingSynthesisStation.delete(event.taskId);
        // Subfase 13e: la sustancia se deposita en el reservorio de salida de
        // la estación en vez de quedar como un id flotante. Como
        // `reservoirContents` ya se serializa, persiste sola.
        if (stationInstanceId) {
          this.depositSynthesis(stationInstanceId, substanceId);
        } else {
          this.availableSubstanceIds = [...this.availableSubstanceIds, substanceId];
        }
        const name = this.chemicalRegistry.get(substanceId)?.name ?? substanceId;
        this.materializedByTaskId.set(event.taskId, { kind: "substance", name });
      }
    });

    // Caudal de fluido (13e): la operación vive exactamente mientras la tarea
    // corre, así que se engancha a su ciclo de vida en vez de a un tick propio.
    this.coreLoopEvents.on("task-started", (event) => {
      const flow = this.pendingFluidFlows.get(event.taskId);
      if (flow) {
        this.fluidOperations.begin(event.taskId, flow);
      }
    });
    for (const kind of ["task-completed", "task-cancelled", "task-failed"] as const) {
      this.coreLoopEvents.on(kind, (event) => {
        this.fluidOperations.end(event.taskId);
        this.pendingFluidFlows.delete(event.taskId);
      });
    }

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
      // Subfase 13d: segunda fuente de ignición real — el chispazo de arrancar
      // una pieza viva (§5.5, caso de validación 8).
      this.salvageEvents,
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
    // arriba: el presupuesto de energía debe estar resuelto ANTES de que
    // `signalRuntime`/la UI lean la cicatriz y el déficit por primera vez, sin
    // esperar al primer tick de ejecución (que en pausa no llega nunca).
    this.powerRuntime.recalculate();

    // Pasada síncrona (Fase 11a.3), mismo criterio que `crisisRuntime.tick`
    // arriba: promueve piezas ferromagnéticas sueltas que ya vinieran en el
    // `Blueprint` inicial de la nave/capítulo, sin esperar al primer tick de
    // ejecución.
    this.loosePromoter.promote();

    this.coreLoop = new CoreLoopModeMachine(this.coreLoopEvents);
    // Subfase 13d, PRIMERO de todos: fija el reloj del tick antes de que el
    // scheduler complete tareas (los hazards de desmontaje lo leen para datar
    // sus eventos) y caduca las fugas abiertas. Al ser un `Tickable` del core
    // loop, la pausa táctica congela también el vencimiento de una fuga en vez
    // de dejarla correr mientras el jugador planifica.
    this.coreLoop.registerTickable({
      tick: (ctx) => {
        this.lastElapsedSeconds = ctx.elapsedSeconds;
        this.leakSink.advanceTo(ctx.elapsedSeconds);
      },
    });
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
   * Riesgo VIVO de desmontar esta pieza (Subfase 13d), para el badge del panel
   * de acciones. Reusa la misma evaluación que el efecto de tarea
   * (`assessDismantleHazards` sobre `dismantleHazardContext`) — la UI no puede
   * decir "seguro" mientras el motor dispara un chispazo.
   */
  dismantleHazardsFor(instanceId: PlacedComponentInstanceId): ReadonlyArray<DismantleHazardKind> {
    const ship = this.shipState.get();
    const instance = ship.placedComponents.find((entry) => entry.instanceId === instanceId);
    if (!instance) {
      return [];
    }
    return dismantleHazardKinds(
      dismantleHazardContext(
        ship,
        instance,
        this.shipFloorplan,
        {
          sectionHasGrantedPower: (sectionId: SectionId) =>
            !this.powerRuntime.sectionHasNoPowerGranted(sectionId),
          atmosphereOf: (sectionId: SectionId) => this.atmosphereRuntime.atmosphereOf(sectionId),
          elapsedSecondsOf: () => this.lastElapsedSeconds,
        },
        this.componentRegistry,
      ),
    );
  }

  /**
   * "Cortar energía a la sección" (13d): tarea de asegurado previa a un
   * desmontaje peligroso. Se enlaza con `linkDependency` desde el llamador si
   * hace falta; encolada por el mismo actor, el orden FIFO de su cola ya
   * garantiza que corra antes.
   */
  queueCutPower(actorId: CrewActorId, sectionId: SectionId): void {
    this.ensureAt(actorId, sectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "cut-power",
        targetSectionId: sectionId,
        payload: { kind: "cut-power", sectionId },
        estimatedDurationSeconds: this.modulatedDuration("cut-power", actorId),
      }),
    );
  }

  /**
   * "Purgar reservorio" (13d): vacía el contenido antes de desmontar la pieza.
   * Desde 13e (ronda 2) lo purgado se vuelca en la sección, así que la tarea
   * lleva su `sectionId` — la misma que ya calculaba para el viaje.
   */
  queuePurgeReservoir(actorId: CrewActorId, instanceId: PlacedComponentInstanceId): void {
    const instance = this.shipState.get().placedComponents.find((entry) => entry.instanceId === instanceId);
    const targetSectionId = instance && this.sectionIdAt(instance.placement.position);
    this.ensureAt(actorId, targetSectionId);
    const taskId = this.nextTaskId();
    // Purgar también mueve fluido (13e): la tarea de asegurado de 13d gana
    // representación en la capa `fluido` sin cambiar su comportamiento.
    this.declareFluidFlow(
      taskId,
      targetSectionId,
      undefined,
      this.reservoirContentOf(instanceId)?.amount ?? 0,
    );
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "purge-reservoir",
        targetSectionId,
        payload: { kind: "purge-reservoir", instanceId, sectionId: targetSectionId },
        estimatedDurationSeconds: this.modulatedDuration("purge-reservoir", actorId),
      }),
    );
  }

  /**
   * ¿Esta pieza es una fuente con carga propia todavía sin descargar? (13d,
   * fix ronda 1). Lo consume el panel de acciones para ofrecer la tarea de
   * descarga solo donde tiene sentido — la UI no conoce el catálogo.
   */
  canDischargeSource(instanceId: PlacedComponentInstanceId): boolean {
    const ship = this.shipState.get();
    const instance = ship.placedComponents.find((entry) => entry.instanceId === instanceId);
    if (!instance || ship.powerState.dischargedSourceIds.includes(instanceId)) {
      return false;
    }
    return isElectricSource(this.componentRegistry.get(instance.componentDefinitionId));
  }

  /**
   * "Descargar fuente" (13d, fix ronda 1): una batería o panel solar no se
   * asegura cortando la sección — lleva su propia carga. Descargarla la vuelve
   * segura y le quita su aporte al presupuesto de la nave, para siempre.
   */
  queueDischargeSource(actorId: CrewActorId, instanceId: PlacedComponentInstanceId): void {
    const instance = this.shipState.get().placedComponents.find((entry) => entry.instanceId === instanceId);
    const targetSectionId = instance && this.sectionIdAt(instance.placement.position);
    this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "discharge-source",
        targetSectionId,
        payload: { kind: "discharge-source", instanceId },
        estimatedDurationSeconds: this.modulatedDuration("discharge-source", actorId),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Subfase 13e — destino real de sustancias
  // -------------------------------------------------------------------------

  /**
   * Deposita el resultado de una síntesis en el reservorio de salida de la
   * estación. Si desborda, el excedente se pierde: la capacidad de la estación
   * es real y medir mal cuesta material (Principio 5).
   */
  private depositSynthesis(
    stationInstanceId: PlacedComponentInstanceId,
    substanceId: ChemicalSubstanceId,
  ): void {
    const ship = this.shipState.get();
    const capacity = this.reservoirCapacityOf(stationInstanceId) ?? SYNTHESIS_YIELD_UNITS;
    try {
      const poured = pourInto(
        ship.reservoirContents,
        stationInstanceId,
        substanceId,
        SYNTHESIS_YIELD_UNITS,
        capacity,
      );
      this.shipState.set({ ...ship, reservoirContents: poured.contents });
    } catch {
      // La estación ya contenía otra sustancia: hay que purgarla antes. La
      // síntesis se pierde — el aviso lo da la UI, acá no se rompe la misión.
      this.availableSubstanceIds = [...this.availableSubstanceIds, substanceId];
    }
  }

  /** Capacidad de sustancia de un reservorio, `undefined` si la pieza no lo es. */
  reservoirCapacityOf(instanceId: PlacedComponentInstanceId): number | undefined {
    const instance = this.shipState
      .get()
      .placedComponents.find((entry) => entry.instanceId === instanceId);
    return instance && instanceReservoirCapacity(instance, this.componentRegistry);
  }

  /** Contenido actual de un reservorio (sustancia + cantidad), o `undefined` si está vacío. */
  reservoirContentOf(instanceId: PlacedComponentInstanceId) {
    return contentOf(this.shipState.get().reservoirContents, instanceId);
  }

  /** ¿Esta instancia es un reservorio de sustancia (G/L/T, no una batería)? */
  isSubstanceReservoirInstance(instanceId: PlacedComponentInstanceId): boolean {
    return this.reservoirCapacityOf(instanceId) !== undefined;
  }

  /**
   * Dominio de mesa que habilita una pieza (13e). La UI lo consulta para
   * decidir qué ofrece el panel contextual — sin conocer el catálogo ni ningún
   * `ComponentId` literal.
   */
  fabricatorDomainOfInstance(instanceId: PlacedComponentInstanceId): FabricatorDomain | undefined {
    const instance = this.shipState
      .get()
      .placedComponents.find((entry) => entry.instanceId === instanceId);
    return instance && instanceFabricatorDomain(instance, this.componentRegistry);
  }

  /**
   * TODOS los reservorios de la nave (distintos del propio) a los que
   * `fromInstanceId` podría trasvasar, con el motivo de bloqueo si no sirve
   * ahora mismo — ronda 7 de fixes de playtest: antes (`transferTargetsFor`)
   * devolvía solo los ya válidos y la UI tomaba el primero a ciegas, así que
   * un trasvase exitoso hacia un aparato de fabricación (mini-reservorio,
   * decisión del operador: SIGUE contando) se sentía como una pérdida —
   * ningún panel muestra su contenido. El modo de selección espacial de
   * `/game` necesita ver TODOS los candidatos (bloqueados incluidos) para
   * iluminarlos con su estado real, en vez de que "no hay destino" sea la
   * única señal posible.
   */
  transferCandidatesFor(
    fromInstanceId: PlacedComponentInstanceId,
  ): ReadonlyArray<{
    readonly instanceId: PlacedComponentInstanceId;
    readonly blocked?: "full" | "unreachable" | "different-substance";
  }> {
    const ship = this.shipState.get();
    const fromContent = this.reservoirContentOf(fromInstanceId);
    const candidates: Array<{
      readonly instanceId: PlacedComponentInstanceId;
      readonly blocked?: "full" | "unreachable" | "different-substance";
    }> = [];
    for (const instance of ship.placedComponents) {
      if (instance.instanceId === fromInstanceId) continue;
      const capacity = instanceReservoirCapacity(instance, this.componentRegistry);
      if (capacity === undefined) continue;
      const toContent = this.reservoirContentOf(instance.instanceId);
      const blocked = !isFluidTransferReachable(ship, this.shipFloorplan, fromInstanceId, instance.instanceId)
        ? ("unreachable" as const)
        : freeCapacity(ship.reservoirContents, instance.instanceId, capacity) <= 0
          ? ("full" as const)
          : toContent && fromContent && toContent.substanceId !== fromContent.substanceId
            ? ("different-substance" as const)
            : undefined;
      candidates.push({ instanceId: instance.instanceId, blocked });
    }
    return candidates;
  }

  /**
   * Motivo por el que NO se puede extraer de este reservorio, o `undefined` si
   * se puede. Devolver el motivo (y no un booleano) es lo que permite a la UI
   * decir "requiere análisis" en vez de un botón gris sin explicación.
   */
  extractionBlockedFor(
    instanceId: PlacedComponentInstanceId,
  ): "empty" | "unanalyzed" | "unknown-composition" | undefined {
    const content = this.reservoirContentOf(instanceId);
    if (!content) {
      return "empty";
    }
    return extractionBlockedReason(content.substanceId, this.substanceCompositionContext());
  }

  /** Composición ya revelada de una sustancia analizada — `undefined` si sigue oculta. */
  compositionOf(substanceId: ChemicalSubstanceId): ReadonlyArray<ChemicalSubstanceId> | undefined {
    try {
      return elementsPerUnit(substanceId, this.substanceCompositionContext());
    } catch {
      return undefined;
    }
  }

  private substanceCompositionContext(): SubstanceCompositionContext {
    return {
      registry: this.chemicalRegistry,
      provenance: this.substanceProvenance,
      analyzedSubstanceIds: [...this.analyzedSubstanceIds],
    };
  }

  /**
   * Declara el caudal que una tarea de fluido va a mover. Se activa recién al
   * EMPEZAR la tarea (`task-started`) y se retira al terminar, así que el
   * conducto se anima exactamente mientras dura la operación.
   *
   * El caudal se reparte sobre la duración base de la tarea para que trasvasar
   * mucho no se vea igual que trasvasar poco.
   */
  private declareFluidFlow(
    taskId: CrewTaskId,
    fromSectionId: SectionId | undefined,
    toSectionId: SectionId | undefined,
    amount: number,
  ): void {
    if (!fromSectionId || amount <= 0) {
      return;
    }
    this.pendingFluidFlows.set(taskId, {
      fromSectionId,
      toSectionId: toSectionId === fromSectionId ? undefined : toSectionId,
      rate: amount / FLUID_OPERATION_REFERENCE_SECONDS,
    });
  }

  /** "Trasvasar sustancia" (13e): de un reservorio a otro. */
  queueTransferSubstance(
    actorId: CrewActorId,
    fromInstanceId: PlacedComponentInstanceId,
    toInstanceId: PlacedComponentInstanceId,
    amount: number,
  ): void {
    const targetSectionId = this.sectionIdOfInstance(fromInstanceId);
    this.ensureAt(actorId, targetSectionId);
    const taskId = this.nextTaskId();
    this.declareFluidFlow(taskId, targetSectionId, this.sectionIdOfInstance(toInstanceId), amount);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "transfer-substance",
        targetSectionId,
        payload: { kind: "transfer-substance", fromInstanceId, toInstanceId, amount },
        estimatedDurationSeconds: this.modulatedDuration("transfer-substance", actorId),
      }),
    );
  }

  /** "Aplicar aquí" (13e): vierte el contenido sobre la atmósfera de la sección. */
  queueApplySubstance(
    actorId: CrewActorId,
    fromInstanceId: PlacedComponentInstanceId,
    sectionId: SectionId,
    amount: number,
  ): void {
    this.ensureAt(actorId, sectionId);
    const taskId = this.nextTaskId();
    this.declareFluidFlow(taskId, this.sectionIdOfInstance(fromInstanceId), sectionId, amount);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "apply-substance",
        targetSectionId: sectionId,
        payload: { kind: "apply-substance", fromInstanceId, sectionId, amount },
        estimatedDurationSeconds: this.modulatedDuration("apply-substance", actorId),
      }),
    );
  }

  /** "Extraer elementos" (13e, GDD 5.4.1): descompone el contenido en su materia prima. */
  queueExtractElements(
    actorId: CrewActorId,
    instanceId: PlacedComponentInstanceId,
    amount: number,
  ): void {
    const targetSectionId = this.sectionIdOfInstance(instanceId);
    this.ensureAt(actorId, targetSectionId);
    const taskId = this.nextTaskId();
    this.declareFluidFlow(taskId, targetSectionId, undefined, amount);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "extract-elements",
        targetSectionId,
        payload: { kind: "extract-elements", instanceId, amount },
        estimatedDurationSeconds: this.modulatedDuration("extract-elements", actorId),
      }),
    );
  }

  /** Sección que contiene una instancia colocada (para encolar el corte de energía desde la UI). */
  sectionIdOfInstance(instanceId: PlacedComponentInstanceId): SectionId | undefined {
    const instance = this.shipState
      .get()
      .placedComponents.find((entry) => entry.instanceId === instanceId);
    return instance && this.sectionIdAt(instance.placement.position);
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
  /** Buckets de desgaste no vacíos de una pieza (Fase 13c), del mejor al peor. */
  wearBucketsOf(componentId: ComponentId): ReadonlyArray<{ wear: ComponentWear; quantity: number }> {
    return wearBucketsOf(this.atomicStock.get(), componentId);
  }

  stockOf(componentId: ComponentId): number {
    return stockOf(this.atomicStock.get(), componentId);
  }

  /** Todo compuesto conocido por el registry de esta misión (catálogo + creaciones ya registradas) — pestaña "Catálogo" del picker. */
  get knownCompositeDefinitions(): ReadonlyArray<PhysicalComponentDefinition> {
    return this.componentRegistry.all().filter(isCompositeEntity);
  }

  /**
   * Compuestos de CATÁLOGO (no creaciones personalizadas) instalables desde
   * "Inventario" — ronda 7 de fixes de playtest, pedido del operador para
   * poder instalar un segundo reservorio y probar el trasvase de verdad.
   * `ALL_COMPOSITE_SPECS` es la lista estática del catálogo (antes de que
   * `queueFabrication` registre creaciones en caliente en el mismo
   * `componentRegistry`) — filtrar por esos ids es lo que evita listar una
   * creación personalizada dos veces (ya aparece, gratis, en
   * `installableCreations`).
   */
  get installableCatalogComposites(): ReadonlyArray<PhysicalComponentDefinition> {
    const catalogIds = new Set(ALL_COMPOSITE_SPECS.map((spec) => spec.id));
    return this.knownCompositeDefinitions.filter((def) => catalogIds.has(def.id));
  }

  /**
   * ¿Hay stock (bucket `nuevo`, sin fallback — mismo criterio estricto que
   * `consumeStock`) de TODOS los ingredientes de la receta de este compuesto?
   * Gatea qué compuestos de catálogo aparecen en "Inventario": mostrarlo sin
   * poder pagarlo sería mentirle al jugador sobre lo que puede instalar.
   */
  hasRecipeStockFor(definition: PhysicalComponentDefinition): boolean {
    if (!isCompositeEntity(definition)) return false;
    const stock = this.atomicStock.get();
    return definition.recipe.ingredients.every(
      (ingredient) => stockOfWear(stock, ingredient.ref, DEFAULT_WEAR) >= ingredient.quantity,
    );
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
  queueFabrication(
    actorId: CrewActorId,
    definition: PhysicalComponentDefinition,
    stationInstanceId?: PlacedComponentInstanceId,
  ): void {
    this.componentRegistry.register(definition.id, definition);
    const taskId = this.nextTaskId();
    this.pendingFabrications.set(taskId, definition);
    // 13e ronda 1 de fixes: fabricar ocurre EN el banco de trabajo, así que el
    // tripulante tiene que ir hasta él. Antes se ejecutaba donde ya estuviera
    // (`plannedSectionFor`), que era correcto cuando la mesa era un botón
    // global del header — pero anula el sentido de haberla puesto en el plano.
    const targetSectionId = this.workstationSectionFor(actorId, stationInstanceId);
    this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "combine",
        targetSectionId,
        estimatedDurationSeconds: this.modulatedDuration("combine", actorId),
      }),
    );
  }

  /**
   * Sección donde se ejecuta un trabajo de mesa. Si hay aparato, la suya; si no
   * (modo creativo, o un llamador viejo), se mantiene el comportamiento anterior
   * de hacerlo donde el tripulante ya esté, en vez de bloquear la acción.
   */
  private workstationSectionFor(
    actorId: CrewActorId,
    stationInstanceId: PlacedComponentInstanceId | undefined,
  ): SectionId | undefined {
    const stationSection = stationInstanceId && this.sectionIdOfInstance(stationInstanceId);
    return stationSection ?? this.plannedSectionFor(actorId);
  }

  /**
   * Lee y BORRA lo que materializó una tarea `combine` (ronda 5) — mismo
   * patrón "drenar y limpiar" que `TransientGasInjection.asInjectionSource()`.
   * `FloorplanScene` lo consulta al recibir `task-completed` para decidir
   * exactamente qué notificar, en vez de comparar longitudes de listas
   * deduplicadas (ver el comentario de `materializedByTaskId`).
   */
  consumeMaterializedByTask(
    taskId: CrewTaskId,
  ): { readonly kind: "substance" | "creation"; readonly name: string } | undefined {
    const entry = this.materializedByTaskId.get(taskId);
    this.materializedByTaskId.delete(taskId);
    return entry;
  }

  /**
   * Sustancias presentes en la nave (11c.3, ampliado en 13e). Ya no es solo la
   * bolsa abstracta de ids sintetizados: incluye TODO lo que hay en los
   * reservorios del plano, así que el panel de Sustancias por fin puede decir
   * DÓNDE está cada una (`substanceLocations`). `availableSubstanceIds` queda
   * como respaldo para una síntesis que no encontró estación donde depositarse.
   */
  get availableSubstances(): ReadonlyArray<ChemicalSubstanceDefinition> {
    const ids = new Set<ChemicalSubstanceId>(this.availableSubstanceIds);
    for (const entry of this.shipState.get().reservoirContents) {
      if (entry.amount > 0) {
        ids.add(entry.substanceId);
      }
    }
    return [...ids]
      .map((id) => this.chemicalRegistry.get(id))
      .filter((definition): definition is ChemicalSubstanceDefinition => definition !== undefined);
  }

  /**
   * Celda del banco de trabajo, si la nave conserva uno (13e). La usa la
   * animación de recolección de elementos (12c.5) como destino, ahora que la
   * mesa dejó de tener botón en el header. Generalizado a dominio (ronda 5):
   * la materia prima química (`elementStock`) se consume en la estación
   * QUÍMICA, no en el banco físico — antes hardcodeaba `"fisica"` porque era
   * el único caso que existía.
   */
  benchCell(domain: FabricatorDomain = "fisica"): { readonly x: number; readonly y: number } | undefined {
    const instanceId = findFabricators(this.shipState.get(), this.componentRegistry, domain)[0];
    if (!instanceId) {
      return undefined;
    }
    const instance = this.shipState
      .get()
      .placedComponents.find((entry) => entry.instanceId === instanceId);
    return instance?.placement.position;
  }

  /** Nombre legible de una sustancia del catálogo — la UI no toca el registry. */
  substanceNameOf(substanceId: ChemicalSubstanceId): string | undefined {
    return this.chemicalRegistry.get(substanceId)?.name;
  }

  /** Reservorios que contienen una sustancia dada, con su cantidad (13e). */
  substanceLocations(
    substanceId: ChemicalSubstanceId,
  ): ReadonlyArray<{ readonly instanceId: PlacedComponentInstanceId; readonly amount: number }> {
    return this.shipState
      .get()
      .reservoirContents.filter((entry) => entry.substanceId === substanceId && entry.amount > 0)
      .map((entry) => ({ instanceId: entry.componentInstanceId, amount: entry.amount }));
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
    // 13e ronda 1 de fixes: una sustancia ya tiene ubicación (vive en un
    // reservorio), así que analizarla exige ir hasta ella — mismo criterio que
    // fabricar y extraer. Si no está en ningún reservorio (respaldo de
    // `availableSubstanceIds`), se mantiene el comportamiento anterior.
    const location = this.substanceLocations(substanceId)[0];
    const targetSectionId = location
      ? this.sectionIdOfInstance(location.instanceId)
      : this.plannedSectionFor(actorId);
    this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        type: "analyze-substance",
        targetSectionId,
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
    stationInstanceId?: PlacedComponentInstanceId,
  ): string | undefined {
    // Subfase 13e: sintetizar dejó de ser gratis. El stock se descuenta AL
    // ENCOLAR (no al completar) por el mismo motivo que `install` consume su
    // pieza al encolarse: encolar dos síntesis con material para una sola
    // dejaría la segunda fallando en ejecución, que es el bug ya registrado
    // como observación 8 para las piezas físicas.
    const remaining = consumeElements(this.elementStock.get(), selectedElementIds);
    if (!remaining) {
      return undefined;
    }
    const outcome = synthesizeSubstance(
      this.reactionResolver,
      this.chemicalRegistry,
      this.chemicalFactory,
      selectedElementIds,
    );
    if (!outcome.result) {
      return undefined;
    }
    this.elementStock.set(remaining);
    // Procedencia (13e): de qué se hizo. Oculta al jugador hasta que un Médico
    // la analice, pero es lo único que permitirá descomponer una mezcla que no
    // tiene receta en el catálogo.
    if (!this.substanceProvenance[outcome.result.id]) {
      this.substanceProvenance = {
        ...this.substanceProvenance,
        [outcome.result.id]: [...selectedElementIds],
      };
    }
    const taskId = this.nextTaskId();
    this.pendingSynthesis.set(taskId, outcome.result.id);
    if (stationInstanceId) {
      this.pendingSynthesisStation.set(taskId, stationInstanceId);
    }
    // Ídem `queueFabrication`: la síntesis ocurre EN la estación química.
    const targetSectionId = this.workstationSectionFor(actorId, stationInstanceId);
    this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        type: "combine",
        targetSectionId,
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
    /** Bucket de desgaste elegido en el selector (Fase 13c); ausente = `nuevo`. */
    wear?: ComponentWear,
    /** Compuesto de catálogo instalado directo desde "Inventario" (ronda 7): consume su receta. */
    consumeRecipe?: boolean,
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
          ...(wear ? { wear } : {}),
          ...(consumeRecipe ? { consumeRecipe } : {}),
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
    return totalPowerBudget(
      this.blueprint.placedComponents,
      this.componentRegistry,
      // 13d: una fuente descargada para canibalizarla ya no aporta.
      this.blueprint.powerState.dischargedSourceIds,
    );
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

  /**
   * Unidades realmente otorgadas a una sección (Fase 13b ronda 4) — menor que
   * `sectionPowerAllocation` cuando hay déficit. El slider muestra ambas para
   * no fingir que el pedido se cumplió.
   */
  sectionPowerGranted(sectionId: SectionId): number {
    return this.powerRuntime.sectionPowerGranted(sectionId);
  }

  /** Unidades pedidas por encima del presupuesto disponible; 0 si no hay conflicto. */
  powerShortfallUnits(): number {
    return this.powerRuntime.powerShortfallUnits();
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
   * (slider de la capa "energia", Fase 13b, UI en modo pausa). Este método
   * escribe la entrada de datos y fuerza el recálculo síncrono: el core loop
   * NO tickea en `planning` (`CoreLoopModeMachine.tick` es NO-OP), así que
   * esperar "al siguiente tick" dejaría el cambio sin efecto hasta que el
   * jugador apriete Play — fix de la ronda 3 de playtest.
   */
  setSectionPowerUnits(sectionId: SectionId, units: number): void {
    const blueprint = this.shipState.get();
    const clamped = Math.max(0, Math.round(units));
    const withoutSection = blueprint.powerState.sectionAllocations.filter((entry) => entry.sectionId !== sectionId);
    const sectionAllocations: SectionPowerAllocation[] =
      clamped === 0 ? withoutSection : [...withoutSection, { sectionId, units: clamped }];
    this.shipState.set({ ...blueprint, powerState: { ...blueprint.powerState, sectionAllocations } });
    this.powerRuntime.recalculate();
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
    // Mismo motivo que `setSectionPowerUnits`: el triaje reordenado en pausa
    // debe verse en el acto (el inspector muestra qué instancia queda viva).
    this.powerRuntime.recalculate();
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
   * Sustancia DOMINANTE en el aire de una sección, sin filtrar por tag (13e,
   * ronda 2). Consulta hermana de `contaminantAt` y deliberadamente separada de
   * ella: aquella responde "qué me lastima" (y por eso solo mira TOX/CORR),
   * esta responde "qué se ve". Mezclarlas es lo que hacía que verter agua fuera
   * INVISIBLE — el motor la metía en `atmosphere.gases` y el plano no pintaba
   * nada, justo lo contrario del principio 6.
   *
   * Devuelve dato de dominio (concentración + tags); el color lo decide quien
   * pinta, con `chemicalSubstanceColor`.
   */
  airborneSubstanceAt(sectionId: SectionId):
    | {
        readonly concentration: number;
        readonly substanceId: ChemicalSubstanceId;
        readonly tags: ReadonlyArray<ChemicalTag>;
      }
    | undefined {
    const atmosphere = this.atmosphereRuntime.atmosphereOf(sectionId);
    if (!atmosphere) {
      return undefined;
    }
    let dominant:
      | { concentration: number; substanceId: ChemicalSubstanceId; tags: ReadonlyArray<ChemicalTag> }
      | undefined;
    for (const [gasKey, concentration] of atmosphere.gases) {
      // O2/N2/CO2 son la atmósfera NORMAL: pintarlas sería ruido constante.
      // Cualquier otra clave es un `ChemicalSubstanceId` (convención de 13a).
      if (concentration <= 0 || BASELINE_GAS_KEYS.has(gasKey)) {
        continue;
      }
      if (dominant && concentration <= dominant.concentration) {
        continue;
      }
      const substanceId = gasKey as ChemicalSubstanceId;
      dominant = {
        concentration,
        substanceId,
        tags: this.chemicalRegistry.get(substanceId)?.data.tags ?? [],
      };
    }
    return dominant;
  }

  /** Tags de una sustancia, para que quien pinta derive su color (13e ronda 2). */
  substanceTagsOf(substanceId: ChemicalSubstanceId): ReadonlyArray<ChemicalTag> {
    return this.chemicalRegistry.get(substanceId)?.data.tags ?? [];
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
      // Subfase 13e: el inventario de elementos, la procedencia de las mezclas
      // y las sustancias analizadas dejan de morir con la sesión.
      elementStock: this.elementStock.get(),
      substanceProvenance: this.substanceProvenance,
      analyzedSubstanceIds: [...this.analyzedSubstanceIds],
    };
  }
}
