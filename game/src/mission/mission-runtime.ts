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
  HAZARD_PARAMETERS,
  MissionAtmosphereRuntime,
  MissionThermalRuntime,
  PRESSURE_RECOVERY_CEILING_KPA,
  MissionProjectileWorld,
  MissionOverloadRuntime,
  MissionPowerRuntime,
  MissionReactionRuntime,
  MissionSignalRuntime,
  MissionFanoutRuntime,
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
  temperatureAwareEmitterInputs,
  chemicalAwareEmitterInputs,
  chemicalSensorReading,
  MissionValveRuntime,
  CHEMICAL_SENSOR_TRIGGER_CONCENTRATION,
  motionAwareEmitterInputs,
  CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS,
  CHAPTER_01_SEAL_DRAIN_RATE_KPA_PER_SECOND,
  CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE,
  CHAPTER_01_SEAL_RECOVERY_RATE_KPA_PER_SECOND,
  CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE,
  sealBreachPressureSink,
  composePressureSinks,
  // Subfase 13f — vida propia por sección, brechas de casco y peligro
  // atmosférico sobre la tripulación.
  MissionSectionIntegrityRuntime,
  MissionHazardRuntime,
  registerKineticDamage,
  sectionBreachPressureSink,
  isBreachSealed,
  writeBackCrew,
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
  coilFieldIntensityAt,
  composeApertureSources,
  componentPowerDraw,
  deriveInstanceStates,
  doorSignalOutput,
  MissionDoorRuntime,
  ValveRuntime,
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
  activeThermalRegulatorsBySection,
  sectionsWithThermalRegulator,
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
  ConduitId,
  DoorDomainEvent,
  DoorId,
  DoorRuntime,
  InstanceState,
  PlacedComponentInstance,
} from "engine";
import {
  AUTOIGNITION_CELSIUS,
  conductorHeatBySection,
  getGasFraction,
  NOMINAL_TEMPERATURE_CELSIUS,
  edgeHeatCelsiusPerSecond,
  effectiveMatterState,
  frozenContentOf,
  MissionPhaseRuntime,
  PhaseExpansionPressureSource,
} from "engine";
import type {
  CombustionAtmosphere,
  FrozenContentInfo,
  MatterState,
  PhaseDomainEvent,
  ValvePourEvent,
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
// Motivo de bloqueo de la mesa: vive con sus hermanos (`extractionBlocked`,
// `transferBlocked`) en el contrato del panel de acciones, que es quien lo
// convierte en texto. `import type` — se borra al compilar, sin dependencia real.
import type { FabricatorBlockedReason } from "../ui/widgets/mission-action-panel.js";
import type { SignalTooltipInfo } from "../ui/widgets/mission-tooltip.js";
import {
  activeSignalEdges,
  actuatorEmitterInputs,
  burnedWiresTouching,
  edgeConductorWear,
  emitterCoverageCells,
  isActuatorOutputNode,
  emitterRangeOf,
  isEdgeBurned,
  PRESENCE_TRIGGER_TYPES,
  seedActuatorOutputNodes,
  wornCapacity,
  componentStockCost,
  reservedCells,
  reservedStock,
  stockCostKey,
  TERMINAL_TASK_STATES,
} from "engine";
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
  CrewTask,
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
  IntegrityDomainEvent,
  AtmosphereDomainEvent,
  DismantleHazardKind,
  ScriptedRoute,
  SectionPowerAllocation,
  SignalDomainEvent,
  PlacedComponentInstanceId,
  SectionId,
  ShipFloorplan,
  FloorplanSection,
  SignalEdge,
  SignalEdgeId,
  FabricatorDomain,
  FluidFlow,
  SignalNodeId,
  StockCostLine,
  SubstanceCompositionContext,
  PlacedFootprint,
  TaskState,
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

/**
 * Ganancia del termostato de dev (ronda 2 de playtest de 14a-3): °C/s de aporte
 * por cada °C de error contra la consigna.
 *
 * **Medido, no elegido.** Un lazo proporcional se estabiliza donde la tasa que
 * pide iguala a la que el mundo se lleva, así que el error residual es
 * `pérdidas / ganancia`: con 2 la consigna de 80 se quedaba en 76, y con 10 en
 * 79.2 — 1.5 °C de error como peor caso en cualquier sala de la nave y en los dos
 * sentidos, alcanzados en menos de 5 segundos. No se sube más porque la
 * convergencia ya es visualmente instantánea y una ganancia alta con dt de frame
 * variable es lo que hace oscilar a un lazo.
 */
const DEV_THERMOSTAT_GAIN = 10;

/**
 * Techo del aporte del termostato de dev, en °C/s. A cadencia de frame son
 * ~1 °C por frame: el salto inicial hacia una consigna lejana se ve como una
 * rampa rápida y no como un teletransporte, que es lo que permite verificar que
 * los efectos de cruce de umbral (evaporación, congelación) se disparan de
 * verdad en vez de saltárselos entre dos ticks.
 */
const DEV_THERMOSTAT_MAX_RATE = 60;

/** Acciones del core loop con afinidad de especialidad (GDD 6.6); `combine` = fabricar en la mesa (11c.2). */
type ModulatedTaskType =
  | "dismantle"
  | "install"
  | "connect"
  // Subfase 14a-4 — retirar un cable tendido.
  | "disconnect"
  | "combine"
  | "analyze-substance"
  // Subfase 13d — tareas de asegurado, con afinidad de Ingeniero.
  | "cut-power"
  | "purge-reservoir"
  | "discharge-source"
  // Subfase 13e — ciclo de vida de una sustancia.
  | "transfer-substance"
  | "apply-substance"
  | "extract-elements"
  // Subfase 13h — operar la nave como compartimentos.
  | "set-valve"
  | "force-door"
  | "repair-door";

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
  /** Triaje de fan-out de señal (14a-4 ronda 2): quién se queda sin señal y por cuánto. */
  private readonly fanoutRuntime: MissionFanoutRuntime;
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
   * Adaptador del mundo para la cinética. Guardado como campo desde 13h: la
   * regla de trabado magnético de puertas necesita las MISMAS bobinas activas
   * que aceleran proyectiles, no una segunda lectura que podría discrepar.
   */
  private readonly projectileWorld: MissionProjectileWorld;
  /**
   * Promueve piezas ferromagnéticas SUELTAS (instaladas con el flujo normal
   * de siempre) a proyectil en cuanto no son ellas mismas un electroimán
   * activo (Fase 11a.3, ASA 3 — efecto emergente, no un verbo nuevo de
   * jugador, decisión del operador).
   */
  readonly loosePromoter: LooseFerromagneticPromoter;
  /** Atmósfera viva por sección (Fase 11b) — primer llamador de producción de `diffuse()`. */
  readonly atmosphereRuntime: MissionAtmosphereRuntime;
  /** Escritores de temperatura por evento (Subfase 14a-1) — alimenta el `SectionHeatSource`. */
  readonly thermalRuntime: MissionThermalRuntime;
  /** Cambio de estado del contenido de los reservorios (Subfase 14a-3). */
  readonly phaseRuntime: MissionPhaseRuntime;
  /**
   * Válvulas automáticas gobernadas por señal (Subfase 14b-2) — el sentido
   * Señales → Química. Nombre largo a propósito: `valveRuntime` ya es el de las
   * válvulas MANUALES de conducto de ventilación (13h), que son otra cosa —
   * aquéllas regulan el paso entre secciones, éstas vierten una sustancia.
   */
  readonly automaticValveRuntime: MissionValveRuntime;
  /** Cicatriz de RE por componente instalado (Fase 11b) — primer llamador de `StructuralIntegrity`. */
  readonly structuralRuntime: MissionStructuralRuntime;
  /** Cicatriz de sobrecarga scripteada por contenido (Fase 12a) — primer llamador de `OverloadRule`. */
  readonly overloadRuntime: MissionOverloadRuntime;
  /** Presupuesto de energía en vivo (Fase 13b) — reemplaza el flag estático de `unpoweredSectionIds` de 11b. */
  readonly powerRuntime: MissionPowerRuntime;
  /** Química viva scripteada por contenido (Fase 13a, deuda #16) — primer llamador de `ReactionResolver` en misión. */
  readonly reactionRuntime: MissionReactionRuntime;
  /** Vida propia por sección (Subfase 13f) — reemplaza la integridad derivada del RE de las piezas (11g). */
  readonly sectionIntegrityRuntime: MissionSectionIntegrityRuntime;
  /** Peligro atmosférico sobre la tripulación (Subfase 13f, deuda #16) — primer llamador de `HazardAccumulator`. */
  readonly hazardRuntime: MissionHazardRuntime;
  /** Puertas vivas (Subfase 13h) — la nave está compartimentada por defecto. */
  readonly doorRuntime: MissionDoorRuntime;
  /** Última lista de instalaciones con la que se sincronizaron las puertas (13h) — ver el tickable del core loop. */
  private lastSyncedPlacedComponents?: ReadonlyArray<PlacedComponentInstance>;
  /** Cadencia de la hoja, para que la barra de la capa visual interpole con el mismo número que la simulación. */
  doorTransitionSeconds(door: DoorRuntime): number {
    return this.doorRuntime.transitionSecondsOf(door.id);
  }
  /** Apertura viva de las válvulas de ventilación (Subfase 13h). */
  readonly valveRuntime: ValveRuntime;
  /** Eventos de puerta (Subfase 13h) — `/game` los pinta y los suena. */
  readonly doorEvents = new EventEmitter<DoorDomainEvent>();
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
  /**
   * Cambio de estado de sustancia (Subfase 14a-3): un charco que se evapora, el
   * contenido de un tanque que se solidifica. Bus propio y no reusar el de
   * reacciones porque no son reacciones — no consumen reactivos ni producen una
   * sustancia nueva, cambian de fase la misma.
   */
  readonly phaseEvents = new EventEmitter<PhaseDomainEvent>();
  /**
   * Vertidos de válvula automática (Subfase 14b-2). Bus propio y no reusar el
   * de fase: son dos fenómenos distintos y el principio 6 pide que se vean
   * distinto — una purga deliberada no es un charco evaporándose.
   */
  readonly valveEvents = new EventEmitter<ValvePourEvent>();
  /** Daño y colapso de secciones (Subfase 13f) — `/game` los pinta. */
  readonly integrityEvents = new EventEmitter<IntegrityDomainEvent>();
  /**
   * Peligro atmosférico sobre tripulantes (Subfase 13f). Este bus NO EXISTÍA:
   * por eso `toxic-threshold`/`corrosive-exposure` solo se veían en la galería
   * de partículas y el sonido de corrosión de 12b nunca sonó en partida real.
   */
  readonly atmosphereEvents = new EventEmitter<AtmosphereDomainEvent>();
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
    // Subfase 14a-2: séptimo escritor de temperatura. Verter un criogénico
    // enfría la sala aunque el líquido no llegue a la atmósfera — antes de esto,
    // volcar nitrógeno líquido no producía ningún efecto en ningún sistema.
    onSpill: (sectionId, substanceId, amount) =>
      this.thermalRuntime.applySubstanceSpill(sectionId, substanceId, amount),
    // Subfase 14a-3: el destino del derrame lo decide la temperatura de la sala,
    // no el campo estático del catálogo. Verter nitrógeno líquido en una sala
    // templada lo evapora, así que además de enfriar DESPLAZA oxígeno.
    sectionTemperatureOf: (sectionId) =>
      this.atmosphereRuntime.atmosphereOf(sectionId)?.temperatureCelsius,
    // Y si se evaporó, expande: primera fuente de presión del motor (GDD 5.6).
    // El evento va aparte del sumidero porque son dos consumidores del mismo
    // hecho — la física y la partícula.
    onEvaporate: (sectionId, substanceId, amount) => {
      this.phaseExpansion.register(sectionId, amount, this.lastElapsedSeconds);
      this.phaseEvents.emit({
        kind: "substance-phase-change",
        sectionId,
        substanceId,
        transition: "boil",
        amount,
        elapsedSeconds: this.lastElapsedSeconds,
      });
    },
  });
  /**
   * Expansión por evaporación (Subfase 14a-3). Se declara acá arriba, junto a
   * `gasInjection`, porque es su consumidor directo y porque el sumidero
   * compuesto del runtime de atmósfera lo necesita ya construido.
   */
  private readonly phaseExpansion = new PhaseExpansionPressureSource();
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
    // Ronda 1 de playtest de 14a-4: los nodos de señal viven en el save y se
    // derivan al INSTALAR, no al cargar. Sin esta siembra, toda puerta de una
    // partida ya empezada se quedaría sin su nodo de salida y la mecánica de
    // "el ACT emite" sería invisible justo para quien ya está jugando. Es
    // idempotente y devuelve el mismo blueprint si no hay nada que sembrar.
    this.shipState.set(seedActuatorOutputNodes(this.shipState.get(), this.componentRegistry));
    this.powerRuntime = new MissionPowerRuntime(
      this.shipState,
      this.shipFloorplan,
      this.componentRegistry,
      this.powerEvents,
    );
    // Subfase 14a-1: una capa más de la cebolla. `sensor-termico-precision`
    // existía en el catálogo desde el arranque pero ningún resolvedor conocía
    // su `triggerType`, así que caía en el fail-open de `allEmittersActive` y
    // estaba permanentemente disparado.
    // La cebolla se arma en pasos nombrados y no anidada: con tres capas ya
    // era ilegible cuál envolvía a cuál, y cada capa solo pisa los nodos de su
    // `triggerType`, así que el orden entre ellas no cambia el resultado.
    // El catálogo químico se arma ACÁ y no más abajo (donde estaba hasta 14b-1)
    // porque la cebolla de emisores pasa a necesitar `chemicalRegistry` como
    // valor, no como callback perezoso, y `buildChemicalCatalog()` no depende de
    // nada de lo que se construye antes: es catálogo puro.
    const chemicalCatalog = buildChemicalCatalog();
    this.chemicalRegistry = chemicalCatalog.registry;
    this.chemicalFactory = chemicalCatalog.factory;
    this.reactionResolver = new ReactionResolver({ namedRecipeIndex: chemicalCatalog.namedRecipeIndex });
    const atmosphereOf = (sectionId: SectionId) => this.atmosphereRuntime.atmosphereOf(sectionId);
    const withMotion = motionAwareEmitterInputs(
      this.shipState,
      () => [
        ...this.crewState
          .all()
          .filter((actor) => actor.hp > 0 && actor.currentCell !== undefined)
          .map((actor) => actor.currentCell!),
        ...this.enemyState.all().filter((enemy) => enemy.hp > 0).map((enemy) => enemy.cell),
      ],
      { isBlocked: (cell) => this.motionBlockedQuery.isBlocked(cell) },
      this.componentRegistry,
      allEmittersActive(this.shipState),
    );
    const withPressure = pressureAwareEmitterInputs(
      this.shipState,
      this.shipFloorplan,
      atmosphereOf,
      this.componentRegistry,
      withMotion,
    );
    const withTemperature = temperatureAwareEmitterInputs(
      this.shipState,
      this.shipFloorplan,
      atmosphereOf,
      this.componentRegistry,
      withPressure,
    );
    // Subfase 14b-1: la cuarta capa. `escaner-espectro` arrastraba el MISMO
    // fail-open que el sensor térmico antes de 14a-1 — estaba permanentemente
    // disparado desde el arranque del proyecto. Necesita además el registro
    // químico porque los contaminantes viven en `atmosphere.gases` como ids de
    // sustancia, y sin resolverlos no hay forma de distinguir un tóxico de
    // vapor de agua.
    const withChemical = chemicalAwareEmitterInputs(
      this.shipState,
      this.shipFloorplan,
      atmosphereOf,
      this.componentRegistry,
      this.chemicalRegistry,
      withTemperature,
    );
    // Ronda 1 de playtest de 14a-4: la salida de señal de un actuador. Va al
    // FINAL de la cebolla y lee el estado REAL del mundo (una puerta trabada o
    // sin motor no emite, aunque la señal le ordene abrirse). `doorRuntime`
    // todavía no existe en este punto del constructor, así que se consulta por
    // callback perezoso en vez de capturarlo — el mismo motivo por el que el
    // resto de la cebolla toma funciones y no valores.
    this.emitterInputs = actuatorEmitterInputs(
      this.shipState,
      // Subfase 14b-2: la válvula es el SEGUNDO lector real de este canal. Su
      // docblock decía desde 14a-4 que "una válvula no tiene todavía un runtime
      // del que leer 'estoy actuando'", así que su emisor de salida se resolvía
      // a `false` para siempre; ahora emite cuando vierte de verdad, y se puede
      // encadenar "la purga arrancó" con cualquier otra cosa.
      // El `??` respeta los tres valores: `undefined` de un lector significa "yo
      // no sé de esta pieza", no "está apagada", así que la consulta pasa al
      // siguiente en vez de cortarse.
      (instanceId) =>
        this.automaticValveRuntime?.isActuatorActive(instanceId) ??
        this.doorRuntime?.isActuatorActive(instanceId),
      withChemical,
    );
    // Fase 13b: `powerRuntime` reemplaza el objeto inline de `PowerScarSource`
    // (antes leía `unpoweredSectionIds` directo) y además gatea por instancia
    // (`InstancePowerSource`) — el propio `MissionPowerRuntime` relee el
    // `Blueprint` vivo en cada tick, mismo criterio de "no congelar al
    // construir la misión" que regía antes.
    // Ronda 2 de playtest de 14a-4. El triaje de fan-out va ANTES del runtime
    // de señal porque este lo consulta en cada tick para cerrar los cables
    // hacia lo que su alimentador no sostiene. No es un `Tickable`: el reparto
    // depende del montaje, no del reloj (ver `MissionFanoutRuntime`).
    this.fanoutRuntime = new MissionFanoutRuntime(this.shipState, this.componentRegistry);
    this.signalRuntime = new MissionSignalRuntime(
      this.shipState,
      this.emitterInputs,
      this.signalEvents,
      this.powerRuntime,
      this.powerRuntime,
      this.fanoutRuntime,
    );
    this.projectileWorld = new MissionProjectileWorld(
      this.shipState,
      this.signalRuntime,
      this.componentRegistry,
      {
        crew: this.crewState,
        enemies: this.enemyState,
        // Subfase 13f: el proyectil frena contra las paredes del tilemap y
        // contra el borde del plano. Se REUSA el mismo `motionBlockedQuery`
        // que la línea de visión de 13a — por indirección, para que el
        // `setMotionBlockedQuery` posterior de la escena también lo alcance.
        blocked: { isBlocked: (cell) => this.motionBlockedQuery.isBlocked(cell) },
        gridSize: this.shipFloorplan.gridSize,
      },
    );
    this.projectiles = new ProjectileSimulation(this.projectileWorld, this.kineticEvents);
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
      // Subfase 13h: una puerta cerrada frena al intruso y él la golpea hasta
      // romperla. La consulta es la MISMA que usan paso y proyectiles.
      doorBlocking: (cell) => this.doorRuntime.doorAt(cell)?.id,
      damageDoor: (doorId, amount, elapsedSeconds) =>
        this.doorRuntime.applyDamage(doorId, amount, elapsedSeconds),
    });
    this.loosePromoter = new LooseFerromagneticPromoter(
      this.shipState,
      this.projectiles,
      this.componentRegistry,
    );
    // Subfase 13h: puertas y válvulas. Van ANTES de la atmósfera porque son sus
    // dos productores de apertura, y sus `queries` son closures — así que pueden
    // preguntar por runtimes que se construyen más abajo sin depender del orden.
    this.valveRuntime = new ValveRuntime(this.shipFloorplan, save.shipState.valveApertures);
    this.doorRuntime = new MissionDoorRuntime({
      floorplan: this.shipFloorplan,
      snapshots: save.shipState.doorStates,
      emitter: (event) => this.doorEvents.emit(event),
      resolveDefinition: (id) => this.componentRegistry.get(id),
      queries: {
        // Tripulación Y enemigos: la puerta no distingue quién se acerca, y por
        // eso trabarla es una decisión táctica en vez de un detalle.
        occupiedCells: () => [
          ...this.crewState.all().flatMap((actor) => (actor.currentCell ? [actor.currentCell] : [])),
          ...this.enemyState.all().flatMap((enemy) => (enemy.status === "defeated" ? [] : [enemy.cell])),
        ],
        crewAt: (cell) =>
          this.crewState
            .all()
            .find((actor) => actor.currentCell?.x === cell.x && actor.currentCell?.y === cell.y)?.id,
        // Una puerta es cableable porque su `ACT` deriva un nodo receptor (13h).
        // `undefined` = sin cable, que NO es lo mismo que `false` (cable
        // ordenando cerrar): sin esa distinción, una puerta sin cablear se
        // quedaría cerrada para siempre.
        // La regla vive en `/engine` (`doorSignalOutput`): decidir cuándo una
        // puerta está gobernada por una señal es dominio, no pegamento — y
        // mientras fue un closure acá no hubo forma de testearla.
        signalOutput: (door) =>
          doorSignalOutput(
            door,
            this.blueprint.signalGraph,
            (instanceId) => this.powerRuntime.isInstancePowered(instanceId),
            (nodeId) => this.signalRuntime.outputOf(nodeId),
          ),
        // Ronda 2 de playtest, corte A: la MISMA fuente que decide si el motor
        // cobra sus 2 unidades en el reparto de 13b, más la cicatriz permanente.
        // Antes miraba `sectionHasNoPowerGranted`, cuyo propio docblock declara
        // que es "puramente cosmético… sigue sin usarse para gating de
        // señales/HUD" — o el comentario o el uso estaba mal, y convivían.
        //
        // La cicatriz permanente se consulta aparte porque NO entra en el
        // reparto (`allocateSectionBudget` solo mira `sectionAllocations`), y se
        // exigen las DOS secciones: una puerta está sobre la frontera, así que
        // si cualquiera de los dos lados perdió la red para siempre, esa hoja
        // deja de tener de dónde alimentarse. Antes solo miraba `door.a`.
        powered: (door) =>
          this.powerRuntime.isInstancePowered(door.instanceId) &&
          !this.powerRuntime.unpoweredSections().has(door.a) &&
          !this.powerRuntime.unpoweredSections().has(door.b),
        magneticFieldAt: (cell) => coilFieldIntensityAt(this.projectileWorld.activeCoils(), cell),
      },
    });
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
        // Subfase 13f: brechas de casco. Se resuelven por closure porque el
        // runtime de integridad se construye después (necesita la atmósfera).
        sectionBreachPressureSink(
          this.shipState,
          () => this.sectionIntegrityRuntime.openBreaches(),
          this.componentRegistry,
        ),
        // Subfase 14a-3: expansión de un derrame que se evapora. Es la primera
        // fuente de presión del motor (aporta en negativo); el techo del propio
        // runtime la corta en la presión estándar, así que represuriza una sala
        // baja y no crea sobrepresión.
        this.phaseExpansion.asSinkSource(),
      ),
      // Subfase 13e: sustancias VERTIDAS sobre la sección ("Aplicar aquí").
      // Es el primer escritor real de un `ChemicalSubstanceId` en
      // `atmosphere.gases`; hasta ahora solo existían lectores.
      this.gasInjection.asInjectionSource(),
      // Subfase 13f: una sección brechada llega al VACÍO; el resto conserva el
      // piso de 40 kPa de 11h.
      (sectionId) => this.sectionIntegrityRuntime.pressureFloorFor(sectionId),
      // Subfase 13h: válvulas + puertas. Se COMPONEN (no se pisan) porque son
      // caminos distintos para el aire entre el mismo par de secciones —
      // cerrar la puerta no cierra el ducto.
      composeApertureSources(
        () => this.valveRuntime.effectiveConnections(),
        this.doorRuntime.apertureSource(),
      ),
      // Subfase 14a-1: el calor aportado por eventos. Se resuelve por closure
      // igual que el piso de presión — `thermalRuntime` se construye abajo,
      // porque necesita los emisores de reacción y de fallo ya creados.
      () => this.thermalRuntime.rates(),
    );
    // Subfase 14a-1: traductor de eventos discretos (combustión, sobrecarga en
    // modo fuego, neutralización exotérmica) a °C/s por sección.
    // Subfase 14a-2: además de los pulsos por evento, el aporte CONTINUO de los
    // reguladores térmicos que estén realmente operando (alimentados y, si están
    // cableados, con señal activa). La decisión de "activo" vive en `/engine`
    // (`thermal-regulators.ts`) y no en este closure: es una regla de dominio, y
    // una regla dentro de un closure de `/game` es código sin test.
    this.thermalRuntime = new MissionThermalRuntime(
      this.reactionEvents,
      this.failureEvents,
      () =>
        activeThermalRegulatorsBySection(this.shipState.get(), {
          registry: this.componentRegistry,
          floorplan: this.shipFloorplan,
          isInstancePowered: (instanceId) => this.powerRuntime.isInstancePowered(instanceId),
          outputOf: (nodeId) => this.signalRuntime.outputOf(nodeId),
        }),
      // Ronda 1 de playtest de 14a-3, octavo escritor: el cableado disipa calor
      // según su carga. Es la contraparte real del enfriador y la respuesta a
      // "¿qué puedo poner en una sala para que encienda sola?". Las consignas de
      // dev entran por el MISMO canal, para que la herramienta ejercite el
      // camino de producción y no un atajo.
      () => this.sustainedHeatBySection(),
    );
    // Subfase 14b-2: la válvula automática, sentido Señales → Química. Encola
    // sobre el MISMO `gasInjection` que la tarea `apply-substance`, así que
    // verter por señal y verter a mano no pueden divergir — incluido el bloqueo
    // por contenido congelado, que comparte deps con el panel de acciones.
    this.automaticValveRuntime = new MissionValveRuntime(this.shipState, {
      registry: this.componentRegistry,
      floorplan: this.shipFloorplan,
      isInstancePowered: (instanceId) => this.powerRuntime.isInstancePowered(instanceId),
      outputOf: (nodeId) => this.signalRuntime.outputOf(nodeId),
      gasInjection: this.gasInjection,
      frozen: {
        substanceOf: (substanceId) => this.chemicalRegistry.get(substanceId),
        sectionTemperatureOf: (sectionId) =>
          this.atmosphereRuntime.atmosphereOf(sectionId)?.temperatureCelsius,
      },
      onPour: (event) => this.valveEvents.emit(event),
    });
    // Subfase 14a-3: vigila el contenido de los reservorios contra la
    // temperatura de su sección. Va después de `thermalRuntime` porque lee la
    // atmósfera que aquel escribe, y antes de los runtimes de tarea porque el
    // congelado gatea lo que el jugador puede hacer con la sustancia.
    this.phaseRuntime = new MissionPhaseRuntime({
      shipState: this.shipState,
      shipFloorplan: this.shipFloorplan,
      sectionTemperatureOf: (sectionId) =>
        this.atmosphereRuntime.atmosphereOf(sectionId)?.temperatureCelsius,
      substanceOf: (substanceId) => this.chemicalRegistry.get(substanceId),
      emitter: this.phaseEvents,
    });
    this.salvageEvents.on("dismantle-leak", (event) => this.leakSink.register(event));
    this.structuralRuntime = new MissionStructuralRuntime(
      this.shipState,
      this.shipFloorplan,
      this.atmosphereRuntime,
      this.componentRegistry,
      this.chemicalRegistry,
      this.failureEvents,
    );
    // Subfase 13f: vida propia por sección. Va DESPUÉS de `atmosphereRuntime`
    // (lo necesita para leer corrosión y presión) y antes de `ShipStatusQuery`,
    // que ahora deriva de acá la integridad de casco.
    this.sectionIntegrityRuntime = new MissionSectionIntegrityRuntime({
      shipState: this.shipState,
      shipFloorplan: this.shipFloorplan,
      atmosphereRuntime: this.atmosphereRuntime,
      chemicalRegistry: this.chemicalRegistry,
      componentRegistry: this.componentRegistry,
      initialSnapshots: save.shipState.sectionIntegrity,
      emitter: this.integrityEvents,
      kineticEvents: this.kineticEvents,
      reactionEvents: this.reactionEvents,
      random: systemRandom,
    });
    // Subfase 13f (deuda #16): peligro atmosférico sobre la tripulación. Es lo
    // que hace sonar por primera vez en partida real el efecto de corrosión
    // que quedó registrado en 12b sin llamador.
    this.hazardRuntime = new MissionHazardRuntime({
      shipFloorplan: this.shipFloorplan,
      atmosphereRuntime: this.atmosphereRuntime,
      chemicalRegistry: this.chemicalRegistry,
      crewState: this.crewState,
      emitter: this.atmosphereEvents,
      crewEmitter: this.crewEvents,
    });
    // Subfase 13f: un proyectil que golpea a un actor por fin le hace daño.
    registerKineticDamage({
      kineticEvents: this.kineticEvents,
      crewState: this.crewState,
      enemyState: this.enemyState,
      crewEmitter: this.crewEvents,
      enemyEmitter: this.enemyEvents,
    });
    this.shipStatusQuery = new ShipStatusQuery(
      this.shipState,
      this.shipFloorplan,
      this.atmosphereRuntime,
      this.chemicalRegistry,
      // Subfase 13f: la integridad de casco sale de la vida por sección, no del
      // RE de las piezas instaladas. `ShipStatusQuery` dejó de necesitar el
      // registro de componentes: ya no mira ninguna pieza para el casco.
      this.sectionIntegrityRuntime,
      // Fase 13b ronda 5: sin esta fuente el indicador de energía del HUD queda
      // clavado en nominal (solo miraría la cicatriz permanente, hoy vacía).
      this.powerRuntime,
    );

    this.scheduler = new TaskScheduler({
      emitter: this.coreLoopEvents,
      // Ronda 10 de fixes de playtest 13e: ninguna tarea gateable puede
      // ejecutarse sin energía en su sección. El gating es por dato de la
      // tarea (`powerSectionIds`), no por una lista de tipos exentos.
      isSectionUnpowered: (sectionId) => this.powerRuntime.sectionHasNoPowerGranted(sectionId),
      // Subfase 13g: y además por la MÁQUINA concreta (`powerInstanceIds`). Es
      // `isInstancePowered` a propósito —"su demanda está satisfecha"— porque
      // quien decide si la mesa arranca es el triaje de prioridad, no el hecho
      // de que su sección tenga alguna unidad suelta.
      isInstanceUnpowered: (instanceId) => !this.powerRuntime.isInstancePowered(instanceId),
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
          // Subfase 14a-3: con estas dos, las tareas que mueven sustancia
          // rechazan un contenido CONGELADO. Es la misma función que consulta el
          // panel de acciones para deshabilitar la fila, no una segunda
          // evaluación que pueda discrepar de ella.
          substanceOf: (substanceId) => this.chemicalRegistry.get(substanceId),
          sectionTemperatureOf: (sectionId) =>
            this.atmosphereRuntime.atmosphereOf(sectionId)?.temperatureCelsius,
        },
        // Subfase 13h: `set-valve`/`force-door`/`repair-door` escriben en los
        // runtimes vivos, no en el blueprint — al blueprint bajan al guardar.
        {
          valves: this.valveRuntime,
          doors: this.doorRuntime,
          elapsedSecondsOf: () => this.lastElapsedSeconds,
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

    // Subfase 13g: una `combine` que NO llega a completarse deja su creación
    // pendiente colgada para siempre en estos maps. El material ya se descontó
    // al encolar y se PIERDE (decisión del operador — principio 5: quedarse sin
    // energía a mitad de una síntesis cuesta), pero los maps hay que vaciarlos
    // igual: si no, la próxima tarea que reciclara ese id materializaría algo
    // que el jugador nunca fabricó.
    for (const kind of ["task-failed", "task-cancelled"] as const) {
      this.coreLoopEvents.on(kind, (event) => {
        this.pendingFabrications.delete(event.taskId);
        this.pendingSynthesis.delete(event.taskId);
        this.pendingSynthesisStation.delete(event.taskId);
      });
    }

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
    // Subfase 14a-2: la carga de cada conductor se deriva del cableado real del
    // jugador (`power/conductor-load.ts`); `scriptedOverloads` queda como
    // override de guion para el attrezzo del capítulo 1.
    //
    // El `shipFloorplan` NO es opcional en producción aunque la firma lo
    // permita: sin él los `OverloadEvent` salen sin `sectionId`, y tanto
    // `MissionThermalRuntime.open()` como `MissionReactionRuntime` los
    // descartan en silencio — o sea que el pulso de calor por sobrecarga y el
    // puente sobrecarga→ignición estaban muertos desde que se escribieron.
    this.overloadRuntime = new MissionOverloadRuntime(
      this.shipState,
      this.componentRegistry,
      definition.scriptedOverloads ?? [],
      this.failureEvents,
      this.shipFloorplan,
      (sectionId) => this.atmosphereRuntime.atmosphereOf(sectionId),
    );
    // Fase 13a: química viva de misión. Subfase 14a-2: los reactivos ya NO
    // vienen solo del guion — `scriptedReactions` está vacío en todos los
    // capítulos, así que este runtime no tenía ningún camino jugable. Ahora
    // evalúa además las sustancias realmente presentes en el aire de cada
    // sección, y `thermalRegulatorOverloaded` tiene una fuente real (había un
    // `false` literal que dejaba muerta a `SpontaneousIgnitionRule`).
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
      (substanceId) => this.chemicalRegistry.get(substanceId),
      () =>
        sectionsWithThermalRegulator(this.shipState.get(), {
          registry: this.componentRegistry,
          floorplan: this.shipFloorplan,
        }),
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
    // Permadeath con consecuencia real (GDD 6.1; ronda 2 de playtest de 13f).
    // Un único punto de baja para TODAS las fuentes de muerte —vacío, tóxico,
    // combustión, impacto, enemigo, consecuencia de crisis— porque todas
    // terminan emitiendo `crew-death` por este mismo bus. Antes el evento solo
    // disparaba partículas y un bark: el tripulante seguía trabajando.
    this.crewEvents.on("crew-death", (event) => this.standDownActor(event.actorId));

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

    // Subfase 13h: alta inicial de las puertas CONSTRUIDAS (una `ACT`+`EST`
    // sembrada sobre un umbral ya es una puerta antes del primer tick), mismo
    // criterio de pasada síncrona que las dos de arriba.
    this.lastSyncedPlacedComponents = this.blueprint.placedComponents;
    this.doorRuntime.syncInstalledDoors(this.lastSyncedPlacedComponents);

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
        // Mismo motivo que `leakSink` (14a-3): el tiempo entra desde el core
        // loop para que la pausa táctica congele el vencimiento de la expansión.
        this.phaseExpansion.advanceTo(ctx.elapsedSeconds);
        // Subfase 13h: una compuerta instalada a mitad de misión tiene que
        // pasar a ser puerta, y una desmontada dejar de serlo. Se compara la
        // REFERENCIA del array: `Blueprint` es inmutable, así que cambia solo
        // cuando alguien lo mutó de verdad. Redescubrir umbrales cada tick
        // sería recorrer instalaciones × secciones × celdas sobre datos que
        // casi nunca cambian.
        const placed = this.shipState.get().placedComponents;
        if (placed !== this.lastSyncedPlacedComponents) {
          this.lastSyncedPlacedComponents = placed;
          this.doorRuntime.syncInstalledDoors(placed);
        }
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
    // Subfase 13h: las puertas se gobiernan DESPUÉS de la energía (leen si su
    // motor tiene suministro este tick) y ANTES de la atmósfera, para que la
    // apertura que la difusión consume sea la de este tick y no la del
    // anterior.
    //
    // Ronda 2 de playtest: también DESPUÉS de las señales, por el mismo motivo
    // que la bobina de 11a. Iban antes, así que una puerta cableada leía
    // siempre la salida del tick anterior y eso se sumaba al hop-por-tick del
    // evaluador: dos ticks entre pisar el sensor y que la hoja arrancara.
    this.coreLoop.registerTickable(this.doorRuntime);
    this.coreLoop.registerTickable(this.loosePromoter);
    this.coreLoop.registerTickable(this.projectiles);
    // Subfase 14a-1: los pulsos de calor se envejecen ANTES de que la
    // atmósfera los consuma, por la misma razón que las inyecciones de gas van
    // antes de difundir. Los eventos que abren un pulso llegan por suscripción
    // (no en el tick), así que un evento emitido más tarde en este mismo tick
    // aporta su calor en el siguiente — un frame de retraso, el mismo que ya
    // tienen `sectionIntegrityRuntime` y `hazardRuntime`.
    this.coreLoop.registerTickable(this.thermalRuntime);
    // Subfase 14b-2: las válvulas automáticas vierten ANTES de que la atmósfera
    // difunda, exactamente por el mismo motivo que el runtime térmico va acá —
    // lo que se suelta este tick tiene que repartirse este tick, no el que
    // viene. Encolan sobre el mismo `gasInjection` que usa la tarea manual.
    this.coreLoop.registerTickable(this.automaticValveRuntime);
    // Fase 11b: atmósfera viva ANTES que la cicatriz estructural, para que
    // `MissionStructuralRuntime` lea el nivel corrosivo YA difundido este tick.
    this.coreLoop.registerTickable(this.atmosphereRuntime);
    this.coreLoop.registerTickable(this.structuralRuntime);
    // Subfase 13f: vida por sección y peligro a la tripulación, los dos justo
    // detrás de la atmósfera y por la misma razón que `structuralRuntime` —
    // leen corrosión y presión YA difundidas en este tick.
    this.coreLoop.registerTickable(this.sectionIntegrityRuntime);
    this.coreLoop.registerTickable(this.hazardRuntime);
    // Fase 12a: sin dependencia de dato vivo de otro runtime (el guion ya trae
    // load/capacity fijos), el orden respecto a atmósfera/estructura no
    // importa — se registra al final de este bloque por prolijidad.
    this.coreLoop.registerTickable(this.overloadRuntime);
    // Fase 13a: sin dependencia de dato vivo de otro runtime más allá del
    // puente a `failureEvents` (ya suscrito en el constructor, no en el
    // tick), se registra al final junto a `overloadRuntime`.
    this.coreLoop.registerTickable(this.reactionRuntime);
    // 14a-3: después de la atmósfera y del térmico, que son quienes mueven la
    // temperatura que este runtime lee.
    this.coreLoop.registerTickable(this.phaseRuntime);

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

    // Bajas heredadas de un save anterior (13f ronda 2). Va DESPUÉS de
    // `registerActor` a propósito: registrar siembra el `status` del save, así
    // que darlos de baja antes quedaría pisado. El `hp <= 0` cubre los saves
    // escritos antes de que existiera el estado `dead`.
    for (const actor of this.crewState.all()) {
      if (actor.status === "dead" || actor.hp <= 0) {
        this.standDownActor(actor.id);
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

  /**
   * Solo el MULTIPLICADOR de afinidad, sin la duración base (Subfase 13h).
   *
   * Existe porque `force-door` no saca su duración de la tabla base: la saca del
   * motor, que la deriva de `ACT.power` de la hoja concreta. La afinidad del
   * tripulante sigue aplicando igual, pero sobre ese número y no sobre el de la
   * tabla — si no, un experto forzaría una compuerta blindada en el mismo
   * tiempo que un panel liviano.
   */
  private durationScaleFor(action: ModulatedTaskType, actorId: CrewActorId): number {
    const actor = this.activeCrew.find((entry) => entry.id === actorId);
    if (!actor) {
      return 1;
    }
    return durationMultiplierFor(action, actor.specialty, actor.tier);
  }

  /**
   * Baja definitiva de un tripulante (GDD 6.1). Toca los dos ejes de estado a
   * la vez y en un solo sitio: el scheduler (cancela su cola, avisa a los
   * dependientes y deja de darle trabajo) y `crewState` (marca `dead`, que es
   * lo que viaja al save).
   */
  private standDownActor(actorId: CrewActorId): void {
    this.crewState.markDead(actorId);
    this.scheduler.standDown(actorId, {
      dtSeconds: 0,
      elapsedSeconds: this.lastElapsedSeconds,
    });
  }

  /** `false` si este tripulante está dado de baja: la UI no debe poder darle órdenes. */
  isActorAlive(actorId: CrewActorId): boolean {
    return this.crewState.isAlive(actorId);
  }

  private queueGoTo(
    actorId: CrewActorId,
    targetSectionId: SectionId,
    targetCell?: GridPosition,
  ): CrewTaskId {
    const id = this.nextTaskId();
    this.scheduler.enqueue(
      createCrewTask({
        id,
        actorId,
        type: "go-to",
        targetSectionId,
        targetCell,
      }),
    );
    return id;
  }

  /**
   * Mover a un tripulante a una CELDA concreta (13f ronda 3, click derecho).
   * Hasta ahora `go-to` solo apuntaba a una sección y el token únicamente
   * caminaba a una celda exacta cuando había una acción encolada detrás.
   */
  queueMoveTo(actorId: CrewActorId, targetCell: GridPosition): boolean {
    const section = sectionContainingCell(this.shipFloorplan, targetCell);
    if (!section || !this.isActorAlive(actorId)) {
      return false;
    }
    this.queueGoTo(actorId, section.id, targetCell);
    return true;
  }

  /**
   * Asegura que el tripulante esté (o vaya a estar) en la sección donde va a
   * trabajar, y **devuelve el id del `go-to` que encoló** — `undefined` si ya
   * iba a estar ahí y no hizo falta ninguno.
   *
   * Ronda 4a de playtest de 14a-4: ese id existe para que la acción que viene
   * detrás lo declare como `dependsOn`. Hasta acá no lo devolvía y nadie
   * enlazaba nada: la relación entre "andá allá" y "hacé esto" era puro orden
   * FIFO, así que **cancelar el movimiento no impedía la acción** — el
   * tripulante se quedaba donde estaba y la pieza se instalaba igual, en una
   * sección a la que nunca llegó.
   *
   * El mecanismo para evitarlo estaba entero y sin usar desde la Fase 10:
   * `resolveBlockingReason` distingue "esperando" de "dependencia cancelada" y
   * `cascadeDependents` propaga el bloqueo. Solo faltaba el llamador.
   */
  private ensureAt(
    actorId: CrewActorId,
    targetSectionId: SectionId | undefined,
  ): CrewTaskId | undefined {
    if (targetSectionId === undefined) {
      return undefined;
    }
    if (this.plannedSectionFor(actorId) !== targetSectionId) {
      return this.queueGoTo(actorId, targetSectionId);
    }
    return undefined;
  }

  queueDismantle(actorId: CrewActorId, instanceId: PlacedComponentInstanceId): void {
    const instance = this.shipState.get().placedComponents.find((entry) => entry.instanceId === instanceId);
    const targetSectionId = instance && this.sectionIdAt(instance.placement.position);
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
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
   * Brecha de casco que cubre alguna de estas celdas, con si YA está sellada
   * (13f, ronda 1 de playtest).
   *
   * Reusa `isBreachSealed` del motor, la MISMA función que decide si la fuga se
   * detiene: así el panel no puede decir "sellada" mientras la sección se sigue
   * vaciando, ni al revés. Mismo criterio que `dismantleHazardsFor` con
   * `assessDismantleHazards` en 13d.
   *
   * Recibe varias celdas porque una pieza instalada ocupa más de una: el parche
   * cuenta si CUALQUIERA de sus celdas cae sobre el agujero.
   */
  breachCovering(
    cells: ReadonlyArray<GridPosition>,
  ): { readonly cell: GridPosition; readonly sealed: boolean } | undefined {
    const breach = this.sectionIntegrityRuntime
      .openBreaches()
      .find((entry) => cells.some((cell) => cell.x === entry.cell.x && cell.y === entry.cell.y));
    if (!breach) {
      return undefined;
    }
    return {
      cell: breach.cell,
      sealed: isBreachSealed(this.shipState.get(), breach, this.componentRegistry),
    };
  }

  /**
   * Lectura de la atmósfera de una sección para el tooltip (13f ronda 4):
   * presión actual y hacia dónde va.
   *
   * `trend` traduce el signo del sumidero a la única distinción que el jugador
   * necesita: la sala se está vaciando, se está volviendo a llenar, o está
   * quieta. Existe porque tapar una brecha NO devuelve el aire de golpe —la
   * sección recupera a 2 kPa/s y tarda ~10 s en cruzar el umbral de vacío—, y
   * sin esta lectura el mordisco que cae en el medio se lee como que el parche
   * no funcionó.
   */
  sectionAtmosphereInfo(sectionId: SectionId):
    | {
        readonly pressureKpa: number;
        readonly trend: "draining" | "recovering" | "stable";
        /** `true` mientras la sala mata por vacío — el MISMO umbral que usa `MissionHazardRuntime`, no un número aparte. */
        readonly vacuum: boolean;
        /** Temperatura actual de la sección (Subfase 14a-1). */
        readonly temperatureCelsius: number;
        /**
         * `true` mientras algún evento esté APORTANDO calor ahora mismo. Es un
         * eje distinto de "está caliente", por la misma razón que `trend` es
         * distinto de `vacuum`: una sala puede seguir a 200 °C con el incendio
         * ya apagado (enfriándose sola), y una a 40 °C puede estar en camino a
         * matar a todos. Lo que el jugador necesita saber es si el problema
         * sigue activo.
         */
        readonly heating: boolean;
        /**
         * La sala enciende sola lo inflamable que haya en ella (14a-3). Va
         * aparte de `heating` y del propio número por la misma razón que
         * `vacuum` va aparte de `trend`: es la CONSECUENCIA del umbral, y un
         * umbral sin su consecuencia en palabras deja al jugador con un color y
         * sin saber qué significa cruzarlo.
         */
        readonly selfIgniting: boolean;
        /**
         * La contaminación de la sala cruza el umbral del sensor químico
         * (14b-1). Mismo argumento que `selfIgniting`: es la CONSECUENCIA del
         * umbral. Las concentraciones por sustancia ya se publican más abajo,
         * pero un porcentaje suelto no dice dónde está la línea que hace
         * disparar al escáner que el jugador acaba de cablear.
         */
        readonly chemicalAlarm: boolean;
        /**
         * Fracción de O2 y su bucket de combustión (ronda 1 de playtest de
         * 14a-3): el operador reportó "no veo los niveles de O2", y es el dato
         * que decide si algo puede arder (GDD 5.5). El bucket sale del MISMO
         * `oxygenToCombustionBucket` que consume la regla de combustión, no de un
         * corte propio de la UI.
         */
        readonly oxygenFraction: number;
        readonly oxygenBucket: CombustionAtmosphere;
        /** °C/s que el CABLEADO está metiendo en esta sala (14a-3 ronda 1). */
        readonly wiringHeatCelsiusPerSecond: number;
        /** Sustancias en el aire, su estado a esta temperatura y su concentración. */
        readonly substanceStates: ReadonlyArray<{
          readonly substanceId: ChemicalSubstanceId;
          readonly state: MatterState;
          readonly concentration: number;
        }>;
      }
    | undefined {
    const atmosphere = this.atmosphereRuntime.atmosphereOf(sectionId);
    if (!atmosphere) {
      return undefined;
    }
    const rate = this.atmosphereRuntime.netPressureRateOf(sectionId);
    // Una brecha sellada mantiene la tasa negativa PARA SIEMPRE (el sumidero no
    // se apaga, solo se topa contra el techo del clamp), así que sin este corte
    // una sala ya llena seguiría diciendo "represurizando" el resto de la
    // partida — un aviso que nunca se apaga deja de leerse.
    const recovering = rate < 0 && atmosphere.pressureKpa < PRESSURE_RECOVERY_CEILING_KPA;
    return {
      pressureKpa: atmosphere.pressureKpa,
      trend: rate > 0 ? "draining" : recovering ? "recovering" : "stable",
      vacuum: atmosphere.pressureKpa <= HAZARD_PARAMETERS.vacuum.onsetKpa,
      temperatureCelsius: atmosphere.temperatureCelsius,
      heating: this.thermalRuntime.heatRateOf(sectionId) > 0,
      // El MISMO umbral que consulta `MissionReactionRuntime` para decidir si
      // hay fuente de ignición: si el tooltip lo dice, el motor prende.
      selfIgniting: atmosphere.temperatureCelsius >= AUTOIGNITION_CELSIUS,
      // La MISMA función que usa el input-source para decidir el disparo, no
      // una segunda fórmula: un tooltip que dijera "sobre el umbral" con el
      // sensor apagado sería la UI mintiendo sobre el motor (patrón 1).
      chemicalAlarm:
        chemicalSensorReading(atmosphere, this.chemicalRegistry) >
        CHEMICAL_SENSOR_TRIGGER_CONCENTRATION,
      oxygenFraction: getGasFraction(atmosphere, GAS.OXYGEN),
      oxygenBucket: sectionCombustionAtmosphere(atmosphere),
      // La CAUSA donde el jugador la va a buscar: quien ve la sala subir de
      // temperatura pregunta por la sala, no por el cable (patrón 66).
      wiringHeatCelsiusPerSecond: this.conductorHeatBySection().get(sectionId) ?? 0,
      substanceStates: [...atmosphere.gases.entries()]
        .map(([gasKey, concentration]) => {
          const substance = this.chemicalRegistry.get(gasKey as ChemicalSubstanceId);
          return substance
            ? {
                substanceId: substance.id,
                state: effectiveMatterState(substance, atmosphere.temperatureCelsius),
                concentration,
              }
            : undefined;
        })
        .filter(
          (
            entry,
          ): entry is {
            substanceId: ChemicalSubstanceId;
            state: MatterState;
            concentration: number;
          } => Boolean(entry),
        ),
    };
  }

  /**
   * Por qué secciones pasa cada cable (ronda 1 de playtest de 14a-3), publicado
   * por la escena en `rebuildWireCellIndex`.
   *
   * **Se recibe, no se deriva.** El recorrido de un cable lo calcula la capa de
   * render (`conduit-path.ts` rutea por los conductos del plano), y volver a
   * inferirlo acá sería tener dos versiones de la misma geometría que pueden
   * discrepar — el patrón 54 en su forma más directa. Mismo criterio DI con que
   * el motor recibe el volumen de una sección o su atmósfera.
   *
   * Mientras nadie lo registre, el cableado no calienta: fail-open igual que el
   * resto de las dependencias opcionales del motor. Un test de motor que monte
   * la regla lo hace inyectando su propio `sectionsOfEdge`.
   */
  private wireSectionIndex: ReadonlyMap<SignalEdgeId, ReadonlyArray<SectionId>> = new Map();

  /** Lo llama la escena cada vez que reconstruye los recorridos de cable. */
  setWireSectionIndex(index: ReadonlyMap<SignalEdgeId, ReadonlyArray<SectionId>>): void {
    this.wireSectionIndex = index;
  }

  /**
   * Consignas de temperatura de DESARROLLO (ronda 1 de playtest de 14a-3).
   *
   * Existe porque la única forma de calentar una sala era la tecla H, que emite
   * un pulso de combustión: la deriva pasiva disipa la mitad del exceso en ~14 s,
   * así que ninguna secuencia manual de varios pasos entra en esa ventana. El
   * operador lo reportó exacto: *"la temp aumenta y disminuye muy rápido con la
   * tecla H, así que para cuando el tripulante hace el vertido, la temp ya
   * bajó"*. Es el patrón 24 — la herramienta no ejercitaba el camino que la
   * subfase construyó.
   *
   * **Entra por el mismo canal que cualquier otra fuente de calor**, no
   * escribiendo `temperatureCelsius` a mano: si escribiera el campo, la deriva
   * pasiva pelearía contra ella cada tick y el playtest estaría verificando algo
   * que el motor no hace. Es un TERMOSTATO: aporta la tasa que haga falta para
   * llegar a la consigna, exactamente lo que haría una máquina real.
   *
   * Estado solo de `/game` y no se persiste: es una herramienta, no una mecánica.
   */
  private readonly devTemperatureTargets = new Map<SectionId, number>();

  /** Fija (o libera, con `undefined`) la consigna de dev de una sección. */
  setDevTemperatureTarget(sectionId: SectionId, targetCelsius: number | undefined): void {
    if (targetCelsius === undefined) {
      this.devTemperatureTargets.delete(sectionId);
    } else {
      this.devTemperatureTargets.set(sectionId, targetCelsius);
    }
  }

  /** Consigna vigente de una sección, para el ciclo de la tecla y el aviso en pantalla. */
  devTemperatureTargetOf(sectionId: SectionId): number | undefined {
    return this.devTemperatureTargets.get(sectionId);
  }

  /** ¿Hay alguna consigna puesta? El aviso permanente lo usa para no dejarse olvidada. */
  get devTemperatureTargetCount(): number {
    return this.devTemperatureTargets.size;
  }

  /**
   * Tasa que sostiene cada consigna, en LAZO CERRADO: mide el error contra la
   * temperatura real de la sección este tick y aporta lo que falte.
   *
   * **Por qué no la cuenta directa** (ronda 2 de playtest de 14a-3). La ronda 1
   * resolvía el equilibrio de una vez, `R = (consigna - nominal) × drift`, y el
   * operador reportó que *"la nueva tecla T no logra llevar las zonas a la
   * temperatura que promete"*: esa fórmula ignora la conducción a las secciones
   * vecinas, que se lleva más calor que la propia climatización, así que una
   * consigna de 80 se quedaba en ~66 y el error dependía de cuántas vecinas
   * tuviera la sala. Un lazo cerrado no necesita conocer ninguna de esas
   * pérdidas: las compensa todas por construcción, incluidas las que no existían
   * cuando se escribió (un enfriador puesto, un incendio en la sala de al lado).
   *
   * Es un termostato COMPLETO y no solo un calefactor: con una consigna de 80 y
   * un incendio en la sala, enfría para mantener los 80. Es lo que se quiere de
   * una herramienta de verificación — la sala está donde el operador la puso, y
   * no donde la dejó el último evento.
   *
   * La ganancia proporcional deja un error residual permanente (~0.8 °C con
   * `GAIN = 10`, medido): es una herramienta de dev y ese error no cambia ninguna
   * verificación, así que no se agrega término integral.
   */
  private devTemperatureRates(): ReadonlyMap<SectionId, number> {
    const rates = new Map<SectionId, number>();
    for (const [sectionId, target] of this.devTemperatureTargets) {
      const current =
        this.atmosphereRuntime.atmosphereOf(sectionId)?.temperatureCelsius ??
        NOMINAL_TEMPERATURE_CELSIUS;
      const rate = (target - current) * DEV_THERMOSTAT_GAIN;
      rates.set(
        sectionId,
        Math.max(-DEV_THERMOSTAT_MAX_RATE, Math.min(DEV_THERMOSTAT_MAX_RATE, rate)),
      );
    }
    return rates;
  }

  /**
   * °C/s que aporta el cableado a cada sección (14a-3 ronda 1). La regla vive en
   * `/engine` (`power/conductor-heat.ts`) y acá solo se le pasa la geometría:
   * una regla de dominio dentro de un closure de `/game` es código sin test por
   * construcción (patrón 43).
   */
  private conductorHeatBySection(): ReadonlyMap<SectionId, number> {
    return conductorHeatBySection(this.shipState.get(), this.componentRegistry, (edgeId) =>
      this.wireSectionIndex.get(edgeId) ?? [],
    );
  }

  /**
   * Todo el calor CONTINUO de la nave, agregado por sección: el del cableado más
   * las consignas de dev. Un solo mapa porque `MissionThermalRuntime` tiene un
   * único canal de aporte continuo — dos fuentes escribiendo el mismo canal es
   * el patrón que ya costó una ronda con el tinte de sprites (patrón 16).
   */
  private sustainedHeatBySection(): ReadonlyMap<SectionId, number> {
    const rates = new Map(this.conductorHeatBySection());
    for (const [sectionId, rate] of this.devTemperatureRates()) {
      rates.set(sectionId, (rates.get(sectionId) ?? 0) + rate);
    }
    return rates;
  }

  /**
   * °C/s que este cable concreto está disipando EN TOTAL (14a-3 ronda 1). Es la
   * propiedad del cable como objeto: sale de su carga y su material, sin importar
   * por dónde pase. La consumen las partículas de calor sobre el recorrido, cuyo
   * sujeto es el cable entero calentándose.
   */
  wireHeatOf(edgeId: SignalEdgeId): number {
    return edgeHeatCelsiusPerSecond(this.shipState.get(), edgeId, this.componentRegistry);
  }

  /**
   * °C/s que este cable le aporta a UNA sala (ronda 2 de playtest de 14a-3).
   *
   * El operador reportó que el tooltip del cable decía `2.7 °C/s en esta sala` y
   * el de la sección `1.7`. Los dos números eran correctos y el texto era el que
   * mentía: `wireHeatOf` da el total del cable, pero un tronco que cruza dos
   * secciones **reparte** su calor entre ellas (si no repartiera, tender un cable
   * largo sería la forma más eficiente de calentar la nave entera).
   *
   * El reparto se calcula acá igual que en `conductorHeatBySection` y sobre el
   * mismo `wireSectionIndex`, así que el número del cable y el de la sección no
   * pueden discrepar — es lo que 13f ronda 4 aprendió con las tasas de presión:
   * una lectura y la física que la produce salen de la misma fuente o divergen.
   */
  wireHeatInSectionOf(edgeId: SignalEdgeId, sectionId: SectionId): number {
    const sections = this.wireSectionIndex.get(edgeId) ?? [];
    if (!sections.includes(sectionId)) {
      return 0;
    }
    return this.wireHeatOf(edgeId) / sections.length;
  }

  /** Celdas de TODAS las brechas abiertas, para el marcador persistente del plano. */
  openBreachCells(): ReadonlyArray<{ readonly cell: GridPosition; readonly sealed: boolean }> {
    const blueprint = this.shipState.get();
    return this.sectionIntegrityRuntime.openBreaches().map((breach) => ({
      cell: breach.cell,
      sealed: isBreachSealed(blueprint, breach, this.componentRegistry),
    }));
  }

  /**
   * "Cortar energía a la sección" (13d): tarea de asegurado previa a un
   * desmontaje peligroso. Se enlaza con `linkDependency` desde el llamador si
   * hace falta; encolada por el mismo actor, el orden FIFO de su cola ya
   * garantiza que corra antes.
   */
  queueCutPower(actorId: CrewActorId, sectionId: SectionId): void {
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, sectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "cut-power",
        targetSectionId: sectionId,
        payload: { kind: "cut-power", sectionId },
        estimatedDurationSeconds: this.modulatedDuration("cut-power", actorId),
      }),
    );
  }

  /**
   * "Operar válvula" (13h, GDD §5.5): abrir o cerrar la válvula de un conducto
   * de ventilación para contener una fuga o drenar el O2 de una sección.
   *
   * El tripulante VA hasta el conducto: nada en este juego cambia el estado
   * físico de la nave sin que alguien lo haga, y el tiempo que cuesta llegar es
   * justo lo que convierte "contener la fuga" en una decisión.
   */
  queueSetValve(actorId: CrewActorId, conduitId: ConduitId, targetAperture: number): void {
    const conduit = this.shipFloorplan.conduits.find((entry) => entry.id === conduitId);
    if (!conduit) {
      return;
    }
    // Se opera desde el lado del conducto donde ya esté (o pueda llegar) el
    // tripulante; `a` es la sección de referencia, igual que en el resto de las
    // tareas con dos lados.
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, conduit.a);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "set-valve",
        targetSectionId: conduit.a,
        payload: { kind: "set-valve", conduitId, targetAperture, sectionId: conduit.a },
        estimatedDurationSeconds: this.modulatedDuration("set-valve", actorId),
      }),
    );
  }

  /**
   * "Forzar puerta" (13h): abrir a mano una puerta sin motor. La duración sale
   * de `MissionDoorRuntime.forceDurationSeconds` —escala con `ACT.power`— y no
   * de la tabla base: forzar una compuerta blindada no cuesta lo mismo que
   * forzar un panel liviano, y ese número lo sabe el motor.
   */
  queueForceDoor(actorId: CrewActorId, doorId: DoorId): void {
    const door = this.doorRuntime.doorById(doorId);
    if (!door) {
      return;
    }
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, door.a);
    const base = this.doorRuntime.forceDurationSeconds(doorId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "force-door",
        targetSectionId: door.a,
        payload: { kind: "force-door", doorId, sectionId: door.a },
        estimatedDurationSeconds: base * this.durationScaleFor("force-door", actorId),
      }),
    );
  }

  /** "Reparar puerta" (13h): devuelve al servicio una hoja rota o trabada por daño. */
  queueRepairDoor(actorId: CrewActorId, doorId: DoorId): void {
    const door = this.doorRuntime.doorById(doorId);
    if (!door) {
      return;
    }
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, door.a);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "repair-door",
        targetSectionId: door.a,
        payload: { kind: "repair-door", doorId, sectionId: door.a },
        estimatedDurationSeconds: this.modulatedDuration("repair-door", actorId),
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
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
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
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
   * Celdas que un sensor de presencia cubre DE VERDAD, para que `/game` las
   * pinte (13g ronda 1 de playtest), o vacío si la pieza no es un sensor.
   *
   * Se resuelve acá y no en la escena porque el registro de componentes y el
   * `motionBlockedQuery` son estado privado de este runtime, y sobre todo
   * porque reusa `emitterCoverageCells` — LA MISMA función que usa
   * `motionAwareEmitterInputs` para decidir el disparo. Una segunda fórmula en
   * la capa visual sería un área pintada que no coincide con lo que el sensor
   * detecta: la UI mintiendo sobre el motor.
   */
  emitterCoverageOf(instanceId: PlacedComponentInstanceId): ReadonlyArray<GridPosition> {
    const instance = this.shipState
      .get()
      .placedComponents.find((entry) => entry.instanceId === instanceId);
    if (!instance) {
      return [];
    }
    const range = emitterRangeOf(
      instance.componentDefinitionId,
      this.componentRegistry,
      PRESENCE_TRIGGER_TYPES,
    );
    if (range === undefined) {
      return [];
    }
    return emitterCoverageCells(instance.placement.position, range, this.shipFloorplan.gridSize, {
      isBlocked: (cell) => this.motionBlockedQuery.isBlocked(cell),
    });
  }

  /**
   * Por qué la mesa de creación no se puede abrir ahora, o `undefined` si se
   * puede (Subfase 13g).
   *
   * Punto ÚNICO de resolución a propósito: lo consumen el guard real de
   * `FloorplanScene.openWorkbench` y el label del botón del panel de acciones.
   * Dos evaluaciones paralelas serían exactamente el bug de "la UI dice que se
   * puede y el clic rebota" — mismo criterio con el que 13d hizo compartir
   * `assessDismantleHazards` entre el badge y el hazard del motor.
   *
   * El predicado de energía es `isInstancePowered` (por INSTANCIA), no
   * `sectionHasNoPowerGranted` (por sección): quien decide si la máquina
   * arranca es el triaje de prioridad del nivel 2 del reparto, así que una mesa
   * puede quedarse sin energía aunque su sección tenga algo.
   */
  fabricatorBlockedReason(
    instanceId: PlacedComponentInstanceId,
  ): FabricatorBlockedReason | undefined {
    if (this.coreLoop.mode !== "planning") {
      return "execution";
    }
    return this.powerRuntime.isInstancePowered(instanceId) ? undefined : "unpowered";
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
    /**
     * Espacio libre real del destino (13e ronda 9) — expone lo que
     * `transferCandidatesFor` ya calcula internamente para decidir `"full"`,
     * así la UI puede CAPAR la cantidad encolada al espacio disponible en vez
     * de encolar el contenido completo del origen y perder el remanente por
     * desborde (`ship-task-effect.ts`, caso `"transfer-substance"`).
     */
    readonly freeCapacity: number;
  }> {
    const ship = this.shipState.get();
    const fromContent = this.reservoirContentOf(fromInstanceId);
    const candidates: Array<{
      readonly instanceId: PlacedComponentInstanceId;
      readonly blocked?: "full" | "unreachable" | "different-substance";
      readonly freeCapacity: number;
    }> = [];
    for (const instance of ship.placedComponents) {
      if (instance.instanceId === fromInstanceId) continue;
      const capacity = instanceReservoirCapacity(instance, this.componentRegistry);
      if (capacity === undefined) continue;
      const toContent = this.reservoirContentOf(instance.instanceId);
      const roomLeft = freeCapacity(ship.reservoirContents, instance.instanceId, capacity);
      const blocked = !isFluidTransferReachable(ship, this.shipFloorplan, fromInstanceId, instance.instanceId)
        ? ("unreachable" as const)
        : roomLeft <= 0
          ? ("full" as const)
          : toContent && fromContent && toContent.substanceId !== fromContent.substanceId
            ? ("different-substance" as const)
            : undefined;
      candidates.push({ instanceId: instance.instanceId, blocked, freeCapacity: roomLeft });
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

  /**
   * ¿El contenido de este reservorio está congelado? (Subfase 14a-3).
   *
   * Delega en `frozenContentOf` de `/engine`, que es la MISMA función que el
   * efecto de tarea usa para rechazar: el panel no puede ofrecer una acción que
   * la tarea vaya a rechazar, ni al revés (patrón 1).
   */
  frozenContentFor(instanceId: PlacedComponentInstanceId): FrozenContentInfo | undefined {
    return frozenContentOf(this.shipState.get(), this.shipFloorplan, instanceId, {
      substanceOf: (substanceId) => this.chemicalRegistry.get(substanceId),
      sectionTemperatureOf: (sectionId) =>
        this.atmosphereRuntime.atmosphereOf(sectionId)?.temperatureCelsius,
    });
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
    const toSectionId = this.sectionIdOfInstance(toInstanceId);
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    const taskId = this.nextTaskId();
    this.declareFluidFlow(taskId, targetSectionId, toSectionId, amount);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "transfer-substance",
        targetSectionId,
        // Ronda 11: gatea AMBOS extremos, no solo el origen — trasvasar
        // desde una sección con energía a una sin energía debe bloquearse
        // igual que al revés (el bug reportado era exactamente este caso).
        powerSectionIds: [targetSectionId, toSectionId].filter(
          (id): id is SectionId => id !== undefined,
        ),
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, sectionId);
    const taskId = this.nextTaskId();
    const fromSectionId = this.sectionIdOfInstance(fromInstanceId);
    this.declareFluidFlow(taskId, fromSectionId, sectionId, amount);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "apply-substance",
        targetSectionId: sectionId,
        // Ronda 11: mismo criterio que transferir — gatea la sección de
        // origen (de donde se saca la sustancia) Y la de destino.
        powerSectionIds: [fromSectionId, sectionId].filter(
          (id): id is SectionId => id !== undefined,
        ),
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    const taskId = this.nextTaskId();
    this.declareFluidFlow(taskId, targetSectionId, undefined, amount);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "extract-elements",
        targetSectionId,
        powerSectionIds: targetSectionId ? [targetSectionId] : undefined,
        // 13g: además del sector, el aparato del que se extrae.
        powerInstanceIds: [instanceId],
        payload: { kind: "extract-elements", instanceId, amount },
        estimatedDurationSeconds: this.modulatedDuration("extract-elements", actorId),
      }),
    );
  }

  /**
   * Celda ancla de una instancia colocada (14a-3): dónde se pinta un efecto
   * cuyo sujeto es la PIEZA y no la sala.
   */
  instanceCellOf(instanceId: PlacedComponentInstanceId): GridPosition | undefined {
    return this.shipState
      .get()
      .placedComponents.find((entry) => entry.instanceId === instanceId)?.placement.position;
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

  // --- Reservas de la cola (ronda 4c de 14a-4) ------------------------------
  //
  // Encolar una tarea COMPROMETE stock y celdas sin descontarlos: la reserva se
  // deriva de la cola viva y nunca se persiste (`toUpdatedSave` no guarda
  // tareas, así que descontar al encolar haría PERDER material al guardar). Se
  // recalcula en cada consulta, sin caché: la cola cambia por eventos y una
  // caché desincronizada es exactamente la clase de bug que 14a-4 evitó al no
  // persistir la capacidad de las aristas.

  /** Todas las tareas vivas y muertas de todos los tripulantes activos — el filtro por estado lo hace el motor. */
  private allQueuedTasks(): ReadonlyArray<CrewTask> {
    return this.activeCrew.flatMap((actor) => [...this.scheduler.queueFor(actor.id)]);
  }

  /** El MISMO cálculo de coste que cobra el efecto al completar (`payComponentCost`), ligado al registry de esta misión. */
  private readonly costOf = (
    componentId: ComponentId,
    wear: ComponentWear,
    consumeRecipe: boolean,
  ): ReadonlyArray<StockCostLine> =>
    componentStockCost(this.componentRegistry, componentId, wear, consumeRecipe);

  /** Celdas del plano ya pedidas por una instalación encolada, y por qué tarea. */
  reservedCells(): ReadonlyMap<string, CrewTaskId> {
    return reservedCells(this.allQueuedTasks());
  }

  /** Unidades de un bucket concreto comprometidas por la cola (0 si ninguna). */
  reservedStockOfWear(componentId: ComponentId, wear: ComponentWear): number {
    return reservedStock(this.allQueuedTasks(), this.costOf).get(stockCostKey(componentId, wear)) ?? 0;
  }

  /**
   * Unidades que el jugador puede comprometer AHORA: lo que hay en el bucket
   * menos lo que la cola ya pidió, con piso en 0. Es el número contra el que el
   * selector decide si una fila se puede clickear; el que MUESTRA sigue siendo
   * el stock real, para no esconder piezas que sí existen.
   */
  availableStockOfWear(componentId: ComponentId, wear: ComponentWear): number {
    const reserved = this.reservedStockOfWear(componentId, wear);
    return Math.max(0, stockOfWear(this.atomicStock.get(), componentId, wear) - reserved);
  }

  /**
   * Instalaciones encoladas que el mapa debe dibujar como fantasma (ronda 4c):
   * dónde va a quedar cada pieza sin tener que recordarlo. Se resuelve acá y no
   * en la escena para que el render no vuelva a recorrer el scheduler ni tenga
   * que saber qué estado de tarea sigue vivo.
   */
  queuedInstallGhosts(): ReadonlyArray<{
    readonly taskId: CrewTaskId;
    readonly componentDefinitionId: ComponentId;
    readonly placement: PlacedFootprint;
    readonly state: TaskState;
  }> {
    return this.allQueuedTasks().flatMap((task) =>
      !TERMINAL_TASK_STATES.has(task.state) && task.payload?.kind === "install"
        ? [
            {
              taskId: task.id,
              componentDefinitionId: task.payload.componentDefinitionId,
              placement: task.payload.placement,
              state: task.state,
            },
          ]
        : [],
    );
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
   * ¿Hay stock DISPONIBLE (bucket `nuevo`, sin fallback — mismo criterio
   * estricto que `consumeStock`) de TODOS los ingredientes de la receta de este
   * compuesto? Gatea qué compuestos de catálogo aparecen en "Inventario":
   * mostrarlo sin poder pagarlo sería mentirle al jugador sobre lo que puede
   * instalar.
   *
   * Disponible = stock − reservado por la cola (ronda 4c): dos compuestos
   * encolados que comparten un ingrediente se cobran los dos al ejecutarse, y
   * antes de esta ronda los dos se ofrecían como si el ingrediente alcanzara.
   */
  hasRecipeStockFor(definition: PhysicalComponentDefinition): boolean {
    if (!isCompositeEntity(definition)) return false;
    return definition.recipe.ingredients.every(
      (ingredient) =>
        this.availableStockOfWear(ingredient.ref, DEFAULT_WEAR) >= ingredient.quantity,
    );
  }

  /**
   * Ingredientes de la receta que faltan (bucket `nuevo`, mismo criterio
   * estricto que `hasRecipeStockFor`) — ronda 8 de fixes de playtest: un
   * compuesto sin stock completo debe seguir apareciendo en el selector de
   * instalación, deshabilitado, explicando QUÉ falta (nunca un botón gris
   * mudo, CLAUDE.md). `[]` si la receta ya está completa o la definición no
   * es un compuesto.
   *
   * `missing` se mide contra el DISPONIBLE (ronda 4c) y `reserved` dice cuánto
   * de ese faltante lo tiene comprometido la cola: "no tengo la pieza" y "la
   * tengo prometida a otra tarea" son dos problemas distintos con dos salidas
   * distintas (conseguirla vs. cancelar una tarea), y colapsarlos en un solo
   * número dejaría al jugador buscando una pieza que ya tiene.
   */
  missingRecipeIngredients(
    definition: PhysicalComponentDefinition,
  ): ReadonlyArray<{
    readonly ref: ComponentId;
    readonly missing: number;
    readonly reserved: number;
  }> {
    if (!isCompositeEntity(definition)) return [];
    return definition.recipe.ingredients
      .map((ingredient) => ({
        ref: ingredient.ref,
        missing: ingredient.quantity - this.availableStockOfWear(ingredient.ref, DEFAULT_WEAR),
        reserved: this.reservedStockOfWear(ingredient.ref, DEFAULT_WEAR),
      }))
      .filter((entry) => entry.missing > 0);
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "combine",
        targetSectionId,
        // Ronda 11: fabricar SÍ gatea por energía — la estación química opera
        // como una máquina real (confirmado con el operador), a diferencia de
        // instalar/conectar/ir a sección, que son trabajo manual.
        powerSectionIds: targetSectionId ? [targetSectionId] : undefined,
        // 13g: y por la MESA concreta. Es además el único sitio donde una
        // tarea `combine` conserva de qué aparato habla — su `payload` sigue
        // sin definirse y la instancia solo vivía en un map lateral de `/game`.
        powerInstanceIds: stationInstanceId ? [stationInstanceId] : undefined,
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "analyze-substance",
        targetSectionId,
        powerSectionIds: targetSectionId ? [targetSectionId] : undefined,
        // 13g: el análisis se hace en el reservorio donde vive la sustancia.
        powerInstanceIds: location ? [location.instanceId] : undefined,
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: taskId,
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "combine",
        targetSectionId,
        // Ronda 11: mismo criterio que `queueFabrication` — la estación gatea.
        powerSectionIds: targetSectionId ? [targetSectionId] : undefined,
        // 13g: y la estación química concreta, no solo su sección.
        powerInstanceIds: stationInstanceId ? [stationInstanceId] : undefined,
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    const instanceId = `install-${Date.now()}-${this.taskCounter}` as PlacedComponentInstanceId;
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
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

  queueConnect(
    actorId: CrewActorId,
    fromNodeId: SignalNodeId,
    toNodeId: SignalNodeId,
    /**
     * Con qué pieza se tiende el cable (Subfase 14a-4). Opcional solo por los
     * tests y llamadores viejos: sin conductor la tarea no consume stock y la
     * arista cae al default de migración (cobre). El flujo real siempre lo pasa,
     * porque el jugador lo elige en el selector de cableado.
     */
    conductor?: {
      readonly conductorId: ComponentId;
      readonly conductorWear?: ComponentWear;
      readonly consumeRecipe?: boolean;
    },
  ): void {
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
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    const edgeId = `edge-${Date.now()}-${this.taskCounter}` as SignalEdgeId;
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "connect",
        targetSectionId,
        payload: {
          kind: "connect",
          edgeId,
          fromNodeId: source,
          toNodeId: target,
          ...(conductor?.conductorId ? { conductorId: conductor.conductorId } : {}),
          ...(conductor?.conductorWear ? { conductorWear: conductor.conductorWear } : {}),
          ...(conductor?.consumeRecipe ? { consumeRecipe: true } : {}),
        },
        estimatedDurationSeconds: this.modulatedDuration("connect", actorId),
      }),
    );
  }

  /**
   * Cuán cargado está un cable respecto de su capacidad EFECTIVA, 0..1+
   * (Subfase 14a-4). Es lo que la UI usa para pintarlo: verde holgado, ámbar al
   * borde. Delega en `MissionOverloadRuntime.edgeStatus` — el mismo cálculo que
   * decide si se corta, no una segunda copia de la cadena.
   *
   * `undefined` si el cable está quemado (ya no lleva carga: su estado es otro)
   * o si su conductor no está en el registry.
   */
  /**
   * Carga, capacidad efectiva y capacidad NOMINAL de un cable (14a-4 ronda 1).
   * La nominal es la que tendría sin el factor térmico: es lo que permite al
   * tooltip decir "la sala te está bajando la capacidad" en vez de mostrar un
   * número más chico que el del catálogo sin explicar por qué.
   */
  edgeStatusOf(
    edge: SignalEdge,
  ): { readonly load: number; readonly capacity: number; readonly nominalCapacity: number } | undefined {
    const status = this.overloadRuntime.edgeStatus(edge);
    if (!status) return undefined;
    return {
      load: status.load,
      capacity: status.capacity,
      nominalCapacity: wornCapacity(status.conductor.maxCapacity, edgeConductorWear(edge)),
    };
  }

  /**
   * Papel de una pieza en el montaje de señal (14a-4 ronda 1): qué gobierna,
   * quién la gobierna, y si emite su estado hacia la cadena.
   *
   * Todo derivado del grafo vivo en el momento de la consulta. `undefined` si la
   * pieza no participa del grafo — así el tooltip de una plancha metálica no
   * gana tres líneas vacías.
   */
  signalRoleOf(instanceId: PlacedComponentInstanceId): SignalTooltipInfo | undefined {
    const blueprint = this.blueprint;
    const own = blueprint.signalGraph.nodes.filter((node) => node.ownerRef === instanceId);
    if (own.length === 0) return undefined;
    const ownIds = new Set(own.map((node) => node.id));
    const edges = activeSignalEdges(blueprint);

    // Lo que cuelga de sus salidas. Ronda 2 de playtest de 14a-4: se lee del
    // MISMO reparto que decide quién se queda sin señal, en vez de recorrer el
    // grafo por segunda vez acá. La primera versión sumaba todo lo alcanzable
    // aguas abajo, que ya no es lo que el motor cobra —la demanda de una salida
    // no es transitiva, ver `emitter-fanout.ts`— y el tooltip habría quedado
    // mostrando un número que ningún límite compara.
    //
    // Con varias salidas (una torreta tiene `EM` + la salida de su `ACT`) se
    // suman los conteos y las demandas y se toma la capacidad MENOR: es la que
    // se rompe primero, y la que el jugador tiene que mirar.
    let drivenCount = 0;
    let drivenLoad = 0;
    let drivenCapacity = Number.POSITIVE_INFINITY;
    for (const node of own) {
      const status = this.fanoutRuntime.statusOfSourceNode(node.id);
      if (!status) continue;
      drivenCount += status.driven;
      drivenLoad += status.demand;
      drivenCapacity = Math.min(drivenCapacity, status.capacity);
    }
    const hasOutgoing = drivenCount > 0;

    // Quién la gobierna: el origen del primer cable que entra. Con varios, se
    // nombra uno y basta — la lista completa es el grafo, no un tooltip.
    const incoming = edges.find((edge) => ownIds.has(edge.to));
    const sourceNode =
      incoming && blueprint.signalGraph.nodes.find((node) => node.id === incoming.from);
    const sourceInstance =
      sourceNode && blueprint.placedComponents.find((entry) => entry.instanceId === sourceNode.ownerRef);

    // Cables quemados que TOCAN esta pieza (14a-4 ronda 3). La cuenta vive en el
    // motor (`burnedWiresTouching`) porque es lógica de grafo con un caso borde
    // real —`overloadedRefs` es heterogéneo— y acá adentro no habría podido
    // testearse: esta clase está acoplada a la escena.
    const burnedWires = burnedWiresTouching(blueprint, instanceId);

    const actuatorOutput = own.find((node) => node.role === "emitter" && isActuatorOutputNode(node.id));
    return {
      ...(hasOutgoing
        ? { drives: { count: drivenCount, load: drivenLoad, capacity: drivenCapacity } }
        : {}),
      ...(sourceNode
        ? {
            governedBy: {
              name:
                (sourceInstance && this.definitionOf(sourceInstance.componentDefinitionId)?.name) ??
                sourceNode.ownerRef,
              active: this.signalRuntime.outputOf(sourceNode.id),
            },
          }
        : {}),
      // Solo si la pieza tiene salida de actuador Y alguien la está escuchando:
      // decir "emite: no" en cada puerta sin cablear sería ruido en toda la nave.
      ...(actuatorOutput && edges.some((edge) => edge.from === actuatorOutput.id)
        ? { emitting: this.signalRuntime.outputOf(actuatorOutput.id) }
        : {}),
      ...(burnedWires > 0 ? { burnedWires } : {}),
    };
  }

  /** `powerDraw` declarado de una instancia colocada, 0 si no consume. */
  private instancePowerDraw(instanceId: PlacedComponentInstanceId): number {
    const instance = this.blueprint.placedComponents.find((entry) => entry.instanceId === instanceId);
    return instance ? (this.definitionOf(instance.componentDefinitionId)?.data.powerDraw ?? 0) : 0;
  }

  edgeLoadRatio(edge: SignalEdge): number | undefined {
    if (isEdgeBurned(this.blueprint, edge)) return undefined;
    const status = this.overloadRuntime.edgeStatus(edge);
    if (!status || status.capacity <= 0) return undefined;
    return status.load / status.capacity;
  }

  /**
   * Cuán cargada está la SALIDA de un nodo (14a-4 ronda 2), para el aro de
   * color del punto. `undefined` si ese nodo no alimenta a nadie — un nodo sin
   * cables no lleva aro, o toda la nave tendría anillos verdes sin significado.
   *
   * Sale del mismo reparto que sacrifica consumidores, no de una cuenta propia:
   * el aro y el glifo `⊘` tienen que hablar del mismo número.
   */
  nodeLoadRatio(nodeId: SignalNodeId): number | undefined {
    const status = this.fanoutRuntime.statusOfSourceNode(nodeId);
    if (!status || status.capacity <= 0) return undefined;
    return status.demand / status.capacity;
  }

  /**
   * Retirar un cable tendido (Subfase 14a-4). El tripulante va al extremo de
   * destino, igual que para tenderlo. **No devuelve nada al stock**: la pieza se
   * perdió — ver `DisconnectTaskPayload`.
   */
  queueDisconnect(actorId: CrewActorId, edgeId: SignalEdgeId): void {
    const edge = this.shipState.get().signalGraph.edges.find((entry) => entry.id === edgeId);
    const targetNode = this.shipState.get().signalGraph.nodes.find((node) => node.id === edge?.to);
    const targetSectionId = targetNode && this.sectionIdAt(targetNode.position);
    // Ronda 4a de 14a-4: la acción DEPENDE del movimiento que la precede, así
    // que cancelarlo la bloquea en vez de dejar que se ejecute donde el
    // tripulante nunca llegó. Ver `ensureAt`.
    const moveTaskId = this.ensureAt(actorId, targetSectionId);
    this.scheduler.enqueue(
      createCrewTask({
        id: this.nextTaskId(),
        actorId,
        ...(moveTaskId ? { dependsOn: [moveTaskId] } : {}),
        type: "disconnect",
        targetSectionId,
        payload: { kind: "disconnect", edgeId },
        estimatedDurationSeconds: this.modulatedDuration("disconnect", actorId),
      }),
    );
  }

  private sectionIdAt(position: GridPosition): SectionId | undefined {
    return sectionContainingCell(this.shipFloorplan, position)?.id;
  }

  /** Sección que contiene una celda (Subfase 13f) — versión pública de `sectionIdAt`. */
  sectionAt(position: GridPosition): FloorplanSection | undefined {
    return sectionContainingCell(this.shipFloorplan, position);
  }

  /** Último `elapsedSeconds` visto por el core loop, para datar eventos emitidos desde `/game`. */
  get elapsedSeconds(): number {
    return this.lastElapsedSeconds;
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
   * La sección tiene 0 unidades otorgadas EN VIVO, sin excepciones — a
   * diferencia de `blueprint.unpoweredSectionIds`, que refleja solo la
   * cicatriz permanente y alimenta gating de señales/HUD. Nacida cosmética
   * (Fase 13b, ronda 2: efecto visual ambiental de sección en
   * `floorplan-scene.ts`); desde la ronda 10 de fixes de playtest 13e
   * también alimenta el gating de tareas del `TaskScheduler` (línea ~490).
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
      demand += componentPowerDraw(this.componentRegistry.get(instance.componentDefinitionId));
    }
    return demand;
  }

  /**
   * Estados NOTABLES de una pieza instalada (Subfase 13h, ronda 3 de playtest):
   * lo que hay que poder ver sobre el plano sin abrir ningún panel.
   *
   * Se deriva en vivo, sin cachear: el estado cambia en cuanto el jugador mueve
   * el dial de energía, y un valor guardado sería exactamente la UI mintiendo
   * sobre el motor. El costo es una búsqueda por instancia consultada.
   */
  instanceStates(instance: PlacedComponentInstance): InstanceState[] {
    return deriveInstanceStates(instance, {
      resolveDefinition: (id) => this.componentRegistry.get(id),
      // Subfase 14b-2: vertiendo AHORA + cuánto le queda. El estado sale del
      // mismo `isActuatorActive` que gobierna la partícula y el emisor de
      // salida, así que el glifo no puede discrepar del chorro (patrón 1).
      pouringValveOf: (instanceId) => {
        if (this.automaticValveRuntime?.isActuatorActive(instanceId) !== true) {
          return undefined;
        }
        const content = this.shipState
          .get()
          .reservoirContents.find((entry) => entry.componentInstanceId === instanceId);
        const capacity = this.componentRegistry
          .get(instance.componentDefinitionId)
          ?.data.functional?.find((property) => property.tag === "RES");
        return {
          remaining: content?.amount ?? 0,
          capacity: capacity?.tag === "RES" ? capacity.capacity : 0,
        };
      },
      isInstancePowered: (instanceId) => this.powerRuntime.isInstancePowered(instanceId),
      // Se lee del blueprint VIVO, no de una copia: `overloadedRefs` es la
      // cicatriz que `MissionOverloadRuntime` escribe en cuanto un conductor
      // supera su capacidad, sea por carga del cableado o por el factor térmico
      // de 14a-2 (un cable bajo cero conduce menos y se corta con la misma carga
      // que antes aguantaba).
      isInstanceOverloaded: (instanceId) => this.blueprint.overloadedRefs.includes(instanceId),
      sectionGrantedUnitsAt: (entry) => {
        const sectionId = this.sectionIdAt(entry.placement.position);
        return sectionId ? this.powerRuntime.sectionPowerGranted(sectionId) : 0;
      },
      // Ronda 2 de 14a-4: la misma fuente que cierra los cables en
      // `MissionSignalRuntime`, para que el glifo del plano y el motor no
      // puedan discrepar sobre quién está recibiendo señal.
      signalStarvationOf: (instanceId) => this.fanoutRuntime.starvationOf(instanceId),
      // 14a-3: la MISMA función que el panel de acciones y que el efecto de
      // tarea. Tres consumidores, una sola evaluación — el glifo del plano no
      // puede decir "congelado" mientras el botón deja verter.
      frozenContentOf: (instanceId) => this.frozenContentFor(instanceId),
    });
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
   * El volcado de la tripulación (HP vivo + status/sección del scheduler + la
   * baja definitiva de los muertos) vive en `writeBackCrew`, en `/engine`: es
   * lógica de forma del save, no de Phaser, y ahí sí se puede testear sin
   * levantar una misión entera.
   */
  toUpdatedSave(base: CampaignSaveState): CampaignSaveState {
    const { crew: updatedCrew, activeCrewIds } = writeBackCrew(base, (actorId) => ({
      damaged: this.crewState.get(actorId),
      scheduled: this.scheduler.getActor(actorId),
    }));
    return {
      ...base,
      activeCrewIds,
      shipState: {
        ...this.blueprint,
        sectionAtmospheres: this.atmosphereRuntime.toSnapshots(),
        // Subfase 13f: la cicatriz estructural viaja con el guardado, igual
        // que la atmósfera. Sin esto, cargar la partida "reparaba" la nave.
        sectionIntegrity: this.sectionIntegrityRuntime.toSnapshots(),
        // Subfase 13h: una puerta que el jugador dejó cerrada (o que un intruso
        // rompió) sigue así al recargar; sin esto el aislamiento deliberado se
        // deshacía solo.
        doorStates: this.doorRuntime.toSnapshots(),
        valveApertures: this.valveRuntime.toSnapshots(),
      },
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
