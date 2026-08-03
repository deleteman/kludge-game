export const ENGINE_VERSION = "0.0.0";

export type { Brand } from "./shared/brand.types.js";

export type {
  Footprint,
  GridPosition,
  PlacedFootprint,
  Rotation,
} from "./geometry/grid-position.types.js";

export type {
  ActuatorProperty,
  ConductorProperty,
  EmitterProperty,
  FunctionalProperties,
  FunctionalProperty,
  ReceptorProperty,
  ReservoirProperty,
  ResourceType,
  StructureProperty,
} from "./properties/functional.types.js";
export type {
  ConductivityLevel,
  MaterialProperties,
  MatterState,
  StructuralResistanceLevel,
  ThermalConductivityLevel,
} from "./properties/material.types.js";
export {
  assertValidTagCount,
  MAX_CHEMICAL_TAGS_PER_SUBSTANCE,
  MIN_CHEMICAL_TAGS_PER_SUBSTANCE,
} from "./properties/chemical-tag.types.js";
export type {
  ChemicalProperties,
  ChemicalTag,
  ChemicalTagLevel,
  CorrTag,
  LeveledChemicalTagName,
  SimpleChemicalTag,
  SimpleChemicalTagName,
  ToxicityLevel,
  ToxTag,
} from "./properties/chemical-tag.types.js";

export type { Recipe, RecipeIngredient } from "./composition/recipe.types.js";
export { isAtomicEntity, isCompositeEntity } from "./composition/composable-entity.types.js";
export type {
  AtomicEntity,
  ComposableEntity,
  CompositeEntity,
} from "./composition/composable-entity.types.js";
export { MapEntityRegistry } from "./composition/entity-registry.js";
export type { EntityRegistry } from "./composition/entity-registry.js";
export { CompositionError, CompositionFactory } from "./composition/composition-factory.js";
export type {
  CompositionFactoryHooks,
  ResolvedIngredient,
} from "./composition/composition-factory.js";

export { createPhysicalComponentFactory } from "./components/physical-component-factory.js";
export type {
  AtomicComponentData,
  ComponentId,
  CreationPart,
  CompositeComponentData,
  PhysicalComponentDefinition,
} from "./components/physical-component.types.js";

export { createChemicalSubstanceFactory } from "./chemistry/chemical-substance-factory.js";
export type {
  ChemicalSubstanceData,
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "./chemistry/chemical-substance.types.js";

export type { SignalNode, SignalNodeId, SignalNodeRole } from "./signals/signal-node.types.js";
export type { SignalEdge, SignalEdgeId } from "./signals/signal-edge.types.js";
export type { SignalGraph } from "./signals/signal-graph.types.js";
export {
  assertSignalGraphIntegrity,
  validateSignalGraphIntegrity,
} from "./signals/signal-graph-integrity.js";
export type { SignalGraphIntegrityIssue } from "./signals/signal-graph-integrity.js";

export type {
  Blueprint,
  BlueprintMetadata,
  ComponentCondition,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
  ReservoirContent,
} from "./blueprint/blueprint.types.js";
export {
  assertBlueprintIntegrity,
  validateBlueprintIntegrity,
} from "./blueprint/blueprint-integrity.js";
export type { BlueprintIntegrityIssue } from "./blueprint/blueprint-integrity.js";
export {
  BlueprintParseError,
  deserializeBlueprint,
  serializeBlueprint,
} from "./blueprint/blueprint-serializer.js";

// ---------------------------------------------------------------------------
// Fase 4 — Catálogo de contenido
// ---------------------------------------------------------------------------

// (`ComponentId` y `ChemicalSubstanceId` ya se exportan en la sección Fase 1.)
export { buildComponentCatalog } from "./components/catalog/build-component-catalog.js";
export { buildChemicalCatalog } from "./chemistry/catalog/build-chemical-catalog.js";
export { ATOMIC_COMPONENT_CATALOG } from "./components/catalog/atomic-component-catalog.js";
export { ELEMENT_CATALOG } from "./chemistry/catalog/element-catalog.js";
export { COMPOUND_CATALOG } from "./chemistry/catalog/compound-catalog.js";
export { INVESTIGACION_CATALOG } from "./components/catalog/composite/investigacion.js";
export { GUERRA_CATALOG } from "./components/catalog/composite/guerra.js";
export { EXPLORACION_CATALOG } from "./components/catalog/composite/exploracion.js";
export { MEDICA_CATALOG } from "./components/catalog/composite/medica.js";

// ---------------------------------------------------------------------------
// Fase 2 — Motor de reglas
// ---------------------------------------------------------------------------

// Infraestructura de simulación (Bloque 0)
export type { TickContext } from "./simulation/simulation-clock.types.js";
export type { DomainEventBase, DomainEventLike } from "./simulation/domain-event.types.js";
export { EventEmitter } from "./simulation/event-emitter.js";
export type { EventHandler, Unsubscribe } from "./simulation/event-emitter.js";

// Señales (Bloque 1)
export { DEFAULT_SIGNAL_BEHAVIOR } from "./signals/signal-behavior.types.js";
export type {
  CounterBehavior,
  DelayBehavior,
  GateBehavior,
  GateMode,
  LatchBehavior,
  OscillatorBehavior,
  PassthroughBehavior,
  SignalBehavior,
} from "./signals/signal-behavior.types.js";
export { createSignalGraphState, createSignalNodeState } from "./signals/signal-state.types.js";
export type { SignalGraphState, SignalNodeState } from "./signals/signal-state.types.js";
export { anyInputActive } from "./signals/signal-rule.js";
export type { SignalInput, SignalRule, SignalRuleContext } from "./signals/signal-rule.js";
export { createDefaultSignalRuleRegistry } from "./signals/rules/signal-rule-registry.js";
export { SignalEvaluator } from "./signals/signal-evaluator.js";
export type { SignalEmitterInputs } from "./signals/signal-evaluator.js";
export type {
  CounterThresholdReachedEvent,
  SignalDomainEvent,
  SignalLatchedEvent,
} from "./signals/signal-events.types.js";

// Química: reacciones (Bloque 2)
export type {
  CombustionAtmosphere,
  ReactantSubstance,
  ReactionContext,
} from "./chemistry/reaction/reaction-context.types.js";
export type {
  ReactionResult,
  ReactionRule,
  ReactionRuleId,
} from "./chemistry/reaction/reaction-rule.js";
export type {
  CombustionEvent,
  CombustionIntensity,
  CombustionRadius,
  CrewDamageSeverity,
  NeutralizationEvent,
  ReactionDomainEvent,
  SpontaneousIgnitionEvent,
} from "./chemistry/reaction/reaction-events.types.js";
export {
  COMBUSTION_CREW_DAMAGE_BY_OXYGEN,
  COMBUSTION_INTENSITY_BY_OXYGEN,
  COMBUSTION_RADIUS_BY_OXYGEN,
  REACTION_PARAMETERS,
} from "./chemistry/reaction/reaction-parameters.js";
export { REACTION_PRIORITY, sortByPriority } from "./chemistry/reaction/reaction-priority.js";
export {
  anyReactantWithTag,
  hasTag,
  mergeTags,
  toReactant,
} from "./chemistry/reaction/tag-predicates.js";
export { NamedRecipeIndex } from "./chemistry/reaction/named-recipe-index.js";
export { createUnidentifiedMixture } from "./chemistry/reaction/unidentified-mixture-factory.js";
export { deriveMixtureHazardPreview } from "./chemistry/reaction/mixture-hazard-preview.js";
export type { MixtureHazardPreview } from "./chemistry/reaction/mixture-hazard-preview.js";
export { synthesizeSubstance, SynthesisError } from "./chemistry/production/synthesize-substance.js";
export {
  createDefaultReactionRules,
  ReactionResolver,
} from "./chemistry/reaction/reaction-resolver.js";
export type {
  ReactionOutcome,
  ReactionResolverOptions,
} from "./chemistry/reaction/reaction-resolver.js";
export { NeutralizationRule } from "./chemistry/reaction/rules/neutralization.js";
export { CombustionRule } from "./chemistry/reaction/rules/combustion.js";
export { CorrosiveSubstanceRule } from "./chemistry/reaction/rules/corrosive-substance.js";
export { SpontaneousIgnitionRule } from "./chemistry/reaction/rules/spontaneous-ignition.js";

// Atmósfera (Bloque 3)
export { GAS, STANDARD_OXYGEN_FRACTION } from "./atmosphere/atmosphere-composition.types.js";
export type { AtmosphereComposition, GasKey } from "./atmosphere/atmosphere-composition.types.js";
export { getGasFraction, standardSectionAtmosphere } from "./atmosphere/section.types.js";
export type {
  Section,
  SectionAtmosphere,
  SectionId,
  SectionRuntime,
} from "./atmosphere/section.types.js";
export type { VentilationConnection } from "./atmosphere/ventilation.types.js";
export { DIFFUSION_RATE_PER_SECOND, diffuse } from "./atmosphere/diffusion.js";
export {
  OXYGEN_COMBUSTION_THRESHOLDS,
  oxygenToCombustionBucket,
  sectionCombustionAtmosphere,
} from "./atmosphere/combustion-atmosphere.js";
export { CORROSIVE_ONSET_CONCENTRATION, sectionCorrosiveLevel } from "./atmosphere/corrosive-atmosphere.js";
export {
  fromSectionAtmosphereSnapshot,
  toSectionAtmosphereSnapshot,
} from "./atmosphere/atmosphere-snapshot.types.js";
export type { SectionAtmosphereSnapshot } from "./atmosphere/atmosphere-snapshot.types.js";
export {
  createCorrosiveCrewHazardAccumulator,
  createToxicHazardAccumulator,
  HazardAccumulator,
} from "./atmosphere/hazard-accumulation.js";
export type { HazardConfig } from "./atmosphere/hazard-accumulation.js";
export type {
  AtmosphereDomainEvent,
  HazardEvent,
  HazardSeverity,
} from "./atmosphere/atmosphere-events.types.js";

// Sobrecarga y fallo (Bloque 4)
export {
  conductorOverloadSubject,
  FAILURE_MODE_BY_RESOURCE,
  OverloadRule,
  reservoirOverloadSubject,
} from "./failure/overload-rule.js";
export type { OverloadSubject } from "./failure/overload-rule.js";
export { StructuralIntegrity } from "./failure/structural-failure.js";
export {
  THERMAL_CONDUCTIVITY_PARAMETERS,
  thermallyAdjustedConductorOverloadSubject,
} from "./failure/thermal-conductivity-rule.js";
export type {
  FailureDomainEvent,
  FailureMode,
  OverloadEvent,
  StructuralDegradedEvent,
  StructuralFailureEvent,
} from "./failure/failure-events.types.js";

// Cinética (dominio nuevo: aceleración magnética + impacto, extensión GDD 5.2/5.6 —
// docs/Extension_aceleracion_magnetica.md, no fusionado al GDD todavía)
export type { CurrentLevel } from "./kinetics/current-level.types.js";
export {
  activeCoilFieldIntensity,
  intensityAtDistance,
  MAGNETIC_FIELD_PARAMETERS,
} from "./kinetics/magnetic-field.js";
export type { MagneticFieldIntensity } from "./kinetics/magnetic-field.js";
export {
  MagneticAccelerationAccumulator,
  VELOCITY_ACCUMULATION_PARAMETERS,
} from "./kinetics/magnetic-acceleration.js";
export type { AccumulatorSnapshot } from "./kinetics/magnetic-acceleration.js";
export { resolveKineticImpact } from "./kinetics/kinetic-impact.js";
export { virtualMass, VIRTUAL_MASS_PARAMETERS } from "./kinetics/virtual-mass.js";
export type { VirtualMassLevel } from "./kinetics/virtual-mass.js";
export type {
  KineticDamageSeverity,
  KineticDomainEvent,
  KineticImpactEvent,
  MagneticAccelerationEvent,
  VelocityLevel,
} from "./kinetics/kinetic-events.types.js";
export {
  ProjectileSimulation,
  PROJECTILE_PARAMETERS,
} from "./kinetics/projectile-simulation.js";
export { DIRECTION_AT_REST } from "./kinetics/projectile.types.js";
export type {
  ActiveCoil,
  CellOccupant,
  GridDirection,
  ProjectileBody,
  ProjectileState,
  ProjectileWorld,
} from "./kinetics/projectile.types.js";
export { previewTrajectory, TRAJECTORY_PREVIEW_PARAMETERS } from "./kinetics/trajectory-preview.js";
export type { TrajectoryPreviewStep } from "./kinetics/trajectory-preview.js";

// ---------------------------------------------------------------------------
// Fase 5 — Plano físico (Tiled → engine; render mínimo en /game)
// ---------------------------------------------------------------------------

export { GRID_CELL_SIZE_PX } from "./geometry/grid-position.types.js";
export { manhattanDistance } from "./geometry/grid-distance.js";
export {
  CONDUIT_KINDS,
  sectionArea,
  sectionContainingCell,
  SHIP_ARCHETYPES,
} from "./floorplan/floorplan.types.js";
export type {
  AnchorId,
  AnchorPoint,
  ComponentSeedId,
  ComponentSeedPoint,
  ConduitConnection,
  ConduitKind,
  FloorplanSection,
  ShipArchetype,
  ShipFloorplan,
} from "./floorplan/floorplan.types.js";
export type { TiledLayer, TiledMap, TiledObject, TiledProperty } from "./floorplan/tiled.types.js";
export { FloorplanParseError, parseShipFloorplan } from "./floorplan/floorplan-parser.js";
export {
  assertFloorplanIntegrity,
  validateFloorplanIntegrity,
} from "./floorplan/floorplan-integrity.js";
export type { FloorplanIntegrityIssue } from "./floorplan/floorplan-integrity.js";
export { deriveAtmosphereModel } from "./floorplan/atmosphere-projection.js";
export type { FloorplanAtmosphereModel } from "./floorplan/atmosphere-projection.js";
export { CANONICAL_SHIP_FLOORPLANS } from "./floorplan/canonical-ships.js";
export { findConduitRoute, sectionsConnectedByConduit } from "./floorplan/conduit-connectivity.js";
export {
  ComponentSeedError,
  baseComponentSeeds,
  componentSeedsForChapter,
  instantiateComponentSeeds,
} from "./floorplan/instantiate-component-seeds.js";

// ---------------------------------------------------------------------------
// Fase 6 — Core loop (modo planificación/ejecución + colas de tareas de
// tripulación con dependencias entre tripulantes, GDD §4)
// ---------------------------------------------------------------------------

// Tripulante como actor (identidad + campos de Fase 9: specialty/tier/hp/trait, ver más abajo)
export type { CrewActor, CrewActorId, CrewActorStatus } from "./crew/crew-actor.types.js";

// Modelo de tarea y su máquina de estados
export type {
  AnalyzeSubstanceTaskPayload,
  ConnectTaskPayload,
  CrewTask,
  CrewTaskId,
  DismantleTaskPayload,
  InstallTaskPayload,
  TaskEffect,
  TaskEffectResult,
  TaskPayload,
  TaskState,
  TaskType,
} from "./tasks/task.types.js";
export { TERMINAL_TASK_STATES } from "./tasks/task.types.js";
export { createCrewTask } from "./tasks/task-factory.js";
export type { CreateCrewTaskInput } from "./tasks/task-factory.js";
export { TASK_BASE_DURATION_SECONDS, baseDurationFor } from "./tasks/task-parameters.js";

// Validación del grafo de dependencias (rechazo de ciclos al encolar)
export { validateTaskDependencies } from "./tasks/task-dependency-graph.js";
export type { TaskDependencyIssue } from "./tasks/task-dependency-graph.js";

// Máquina de modo (driver genérico de simulación) y scheduler
export { CoreLoopModeMachine } from "./tasks/core-loop-mode.js";
export type { Tickable } from "./tasks/core-loop-mode.js";
export { TaskScheduler, TaskDependencyError } from "./tasks/task-scheduler.js";
export type {
  BlockingReason,
  PlayerNotification,
  SchedulerActorSnapshot,
  TaskSchedulerOptions,
} from "./tasks/task-scheduler.js";

// Eventos de dominio del core loop (Observer → Fase 8)
export type {
  CoreLoopDomainEvent,
  CoreLoopMode,
  CoreLoopModeChangedEvent,
  TaskBlockedEvent,
  TaskCancelledEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskStartedEvent,
} from "./tasks/task-events.types.js";

// ---------------------------------------------------------------------------
// Fase 9 — Tripulación (GDD 6.1-6.7): especialidad, tier, afinidad,
// recuperación atómica al desmontar, HP/permadeath y personalidad.
// ---------------------------------------------------------------------------

export type { CrewSpecialty } from "./crew/crew-specialty.types.js";
export type { CrewTier } from "./crew/crew-tier.types.js";
export type { PersonalityTrait } from "./crew/personality-trait.types.js";
export {
  AFFINITY_ACTION_SPECIALTY,
  AFFINITY_DURATION_MULTIPLIER,
  OFF_AFFINITY_DURATION_PENALTY,
  durationMultiplierFor,
} from "./crew/crew-affinity.js";
export type { AffinityAction } from "./crew/crew-affinity.js";
export {
  ATOMIC_RECOVERY_BASE_FRACTION,
  ENGINEER_RECOVERY_BONUS,
  LOW_STRUCTURAL_RESISTANCE_RECOVERY_PENALTY,
  atomicRecoveryFraction,
} from "./crew/atomic-recovery.js";
export {
  HP_LOSS_FRACTION,
  applyCombustionDamage,
  applyCrewDamage,
  applyKineticDamage,
} from "./crew/hp-resolution.js";
export type { CrewHpResolution } from "./crew/hp-resolution.js";
export type { CrewDamageCause, CrewDamagedEvent, CrewDeathEvent, CrewDomainEvent } from "./crew/crew-events.types.js";
export { CREW_CAPACITY_BY_ARCHETYPE, selectActiveCrew } from "./crew/crew-roster.js";
export type { CrewRoster } from "./crew/crew-roster.js";
export { BARK_LINES_PER_EVENT, barkKey, pickBarkIndex } from "./crew/bark-bank.js";
export type { BarkEventType } from "./crew/bark-bank.js";

// ---------------------------------------------------------------------------
// Fase 9.5 — Guardado/carga (GDD 15.4): estado dinámico de partida y
// creaciones custom de la mesa persistidas a disco. Adelantado desde Fase 11
// por decisión del operador.
// ---------------------------------------------------------------------------

export { INITIAL_SHIP_STATE_BY_ARCHETYPE } from "./floorplan/initial-ship-state.js";
export type {
  CampaignSaveId,
  CampaignSaveMetadata,
  CampaignSaveState,
  ChapterProgressState,
} from "./save/campaign-save.types.js";
export {
  assertCampaignSaveIntegrity,
  validateCampaignSaveIntegrity,
} from "./save/campaign-save-integrity.js";
export type { CampaignSaveIntegrityIssue } from "./save/campaign-save-integrity.js";
export {
  CampaignSaveParseError,
  deserializeCampaignSave,
  serializeCampaignSave,
} from "./save/campaign-save-serializer.js";
export { createNewCampaignSave } from "./save/campaign-save-factory.js";
export type { CreateNewCampaignSaveInput } from "./save/campaign-save-factory.js";
export { CHAPTER_SEED_BY_ID, advanceChapterProgress } from "./save/chapter-progression.js";
export type { ChapterSeed } from "./save/chapter-progression.js";

export type { CustomCreation, CustomCreationId, CustomCreationMetadata } from "./save/custom-creation.types.js";
export {
  CustomCreationParseError,
  deserializeCustomCreation,
  serializeCustomCreation,
} from "./save/custom-creation-serializer.js";

// ---------------------------------------------------------------------------
// Fase 7 — Mesa de creación (GDD 10.1): grid de composición espacial
// compartido con el plano, footprint dinámico, nombrado, validación de
// instalación y conexión externa de puertos.
// ---------------------------------------------------------------------------

export {
  addPiece,
  removePiece,
  createEmptyWorkbenchState,
  effectiveFootprintExtent,
  findOverlappingPieces,
  occupiedCells,
  WorkbenchError,
} from "./workbench/workbench-state.types.js";
export type { WorkbenchPiece, WorkbenchPieceId, WorkbenchState } from "./workbench/workbench-state.types.js";

export { calculateFootprint, calculateFootprintOrigin, calculateOccupiedCells } from "./workbench/footprint-calculator.js";
export { addSignalNode, connectNodes } from "./workbench/workbench-signal-adapter.js";
export { buildRecipeFromPieces } from "./workbench/creation-recipe-builder.js";
export { nameAndRegisterCreation } from "./workbench/creation-naming.js";
export type { NameCreationParams } from "./workbench/creation-naming.js";

export {
  candidateCellsInSection,
  findFittingInstallPlacement,
  rotateExteriorFootprint,
} from "./workbench/installation-placement.js";
export { validateInstallation } from "./workbench/installation-validation.js";
export type { InstallationIssue } from "./workbench/installation-validation.js";
export { installCreationInFloorplan } from "./workbench/installation.js";
export type { InstallationResult } from "./workbench/installation.js";

export {
  assertSignalWiringReachable,
  exposeExternalPorts,
  mergeInstalledSignalGraph,
  SignalWiringUnreachableError,
  translateWorkbenchNodesToBlueprint,
  wireExternalPort,
} from "./workbench/port-wiring.js";

// ---------------------------------------------------------------------------
// Fase 10a — Dominio de Crisis (GDD §15.3): contenido declarativo de crisis
// de campaña (trigger/temporización/resolución), máquina de estados y el
// capítulo 1 ("Primer Aviso", docs/Primeras_8_crisis.md).
// ---------------------------------------------------------------------------

export type { CrisisState } from "./crisis/crisis-state.types.js";
export { TERMINAL_CRISIS_STATES } from "./crisis/crisis-state.types.js";
export type {
  CrewDamageConsequenceSpec,
  CrewDamageSeveritySpec,
  CrisisConsequenceSpec,
  CrisisDefinition,
  CrisisDefinitionId,
  CrisisHazardSchedule,
  CrisisResolutionSpec,
  CrisisTimerConfig,
  CrisisTriggerSpec,
  FunctionalTagInstalledResolutionSpec,
  JammedActuatorBlocksSectionTriggerSpec,
  MotionSensorsActiveTriggerSpec,
  ReplacementInstalledConnectedResolutionSpec,
  ScriptedOverloadSubject,
  ScriptedReactionSubject,
  SignalNodesWiredResolutionSpec,
  SignalOutputCase,
  SignalOutputMatchesResolutionSpec,
  TimeLossConsequenceSpec,
} from "./crisis/crisis-definition.types.js";
export type {
  CrisisDomainEvent,
  CrisisResolvedEvent,
  CrisisTriggeredEvent,
} from "./crisis/crisis-events.types.js";
export type { CrisisEvalContext, CrisisResolutionRule, CrisisTriggerRule } from "./crisis/crisis-rule.js";
export { evaluateCrisis } from "./crisis/crisis-machine.js";
export type { CrisisEvaluationResult, CrisisRuleRegistries } from "./crisis/crisis-machine.js";
export {
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
} from "./crisis/rules/crisis-rule-registry.js";
export {
  CHAPTER_01_ACTUATOR_INSTANCE_ID,
  CHAPTER_01_ANCHOR_POSITION,
  CHAPTER_01_BLOCKED_SECTION_ID,
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_01_INITIAL_ATOMIC_STOCK,
  CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE,
  CHAPTER_01_PRIMER_AVISO,
  CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS,
  CHAPTER_01_SEAL_DRAIN_RATE_KPA_PER_SECOND,
  CHAPTER_01_SEAL_INSTANCE_ID,
  CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE,
  CHAPTER_01_SEAL_RECOVERY_RATE_KPA_PER_SECOND,
  CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE,
} from "./crisis/campaign/chapter-01-primer-aviso.js";
export {
  CHAPTER_02_BY_ARCHETYPE,
  CHAPTER_02_GATE_NODE_ID,
  CHAPTER_02_GATE_PANEL_INSTANCE_ID,
  CHAPTER_02_SENSOR_A_INSTANCE_ID,
  CHAPTER_02_SENSOR_A_NODE_ID,
  CHAPTER_02_SENSOR_B_INSTANCE_ID,
  CHAPTER_02_SENSOR_B_NODE_ID,
  CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
  CHAPTER_02_SOFT_DEADLINE_SECONDS,
} from "./crisis/campaign/chapter-02-ecos-en-el-pasillo.js";
export { CHAPTER_REGISTRY } from "./crisis/campaign/chapter-registry.js";
export {
  CHAPTER_SEQUENCE_BY_ARCHETYPE,
  nextChapterAfter,
} from "./crisis/campaign/chapter-sequence.js";

// ---------------------------------------------------------------------------
// Fase 10b — Runtime de misión: TaskEffect real (dismantle/install/connect)
// y el adaptador Tickable que re-evalúa la crisis activa cada tick. Alcance
// deliberadamente acotado a lo que el capítulo 1 ejercita — señales/química/
// atmósfera/fallo/cinética NO se adaptan a Tickable todavía (decisión
// explícita del operador), se agregan recién en la sub-fase que implemente el
// capítulo que los necesite.
// ---------------------------------------------------------------------------

export { MutableShipState } from "./mission/mutable-ship-state.js";
export { MutableCrewState } from "./mission/mutable-crew-state.js";
export { MutableEnemyState } from "./mission/mutable-enemy-state.js";
export { createShipTaskEffect, InsufficientStockError } from "./mission/ship-task-effect.js";
export type { AtomicPartsStock } from "./inventory/inventory.types.js";
export { hasStock, stockOf, consumeStock, creditStock } from "./inventory/inventory-ledger.js";
export { MutableAtomicStock } from "./inventory/mutable-atomic-stock.js";
export { CrisisRuntime } from "./mission/crisis-runtime.js";
export type { CrisisRuntimeOptions } from "./mission/crisis-runtime.js";
// Fase 11a — estado de señales vivo de la misión + adaptador del puerto de proyectiles.
export {
  MissionSignalRuntime,
  allEmittersActive,
} from "./mission/mission-signal-runtime.js";
export type {
  EmitterInputSource,
  PowerScarSource,
  SignalOutputReader,
} from "./mission/mission-signal-runtime.js";
// Subfase 11h — sensor de presión real (Indicador LED / Pantalla LCD) + resolución de valor del LCD.
export {
  PRESSURE_SENSOR_TRIGGER_KPA,
  pressureAwareEmitterInputs,
} from "./mission/pressure-emitter-input-source.js";
// Fase 13a — sensor óptico/de presencia real (deuda #3), por línea de visión + rango.
export { motionAwareEmitterInputs } from "./mission/motion-emitter-input-source.js";
export { hasLineOfSight } from "./geometry/line-of-sight.js";
export type { CellBlockedQuery } from "./geometry/line-of-sight.js";
export { resolveLcdDisplayValue } from "./mission/lcd-display-value.js";
export type { LcdDisplayValue } from "./mission/lcd-display-value.js";
// Fase 11b — atmósfera viva de la misión (wireado por primera vez).
export {
  MissionAtmosphereRuntime,
  PRESSURE_RECOVERY_CEILING_KPA,
  PRESSURE_SINK_FLOOR_KPA,
} from "./mission/mission-atmosphere-runtime.js";
export type { SectionPressureSinkSource } from "./mission/mission-atmosphere-runtime.js";
// Subfase 11h — escenario de fuga por pieza sellada rota (Capítulo 1).
export { sealBreachPressureSink } from "./mission/seal-breach-pressure-sink.js";
export type { SealBreachConfig } from "./mission/seal-breach-pressure-sink.js";
// Fase 11b — cicatriz de RE por componente instalado (primer llamador de StructuralIntegrity).
export { MissionStructuralRuntime } from "./mission/mission-structural-runtime.js";
// Fase 12a — cicatriz de sobrecarga scripteada por contenido (primer llamador de OverloadRule).
export { MissionOverloadRuntime } from "./mission/mission-overload-runtime.js";
// Fase 13a — química viva de misión, scripteada por contenido (primer llamador de ReactionResolver en misión, deuda #16).
export { MissionReactionRuntime } from "./mission/mission-reaction-runtime.js";
// Subfase 11g — estado agregado a nivel de nave (atmósfera/soporte vital/casco/energía).
export type { ShipStatusLevel, ShipStatusIndicator, ShipStatusSnapshot } from "./ship-status/ship-status.types.js";
export {
  fractionToLevel,
  aggregateAtmosphere,
  aggregateLifeSupport,
  aggregateHullIntegrity,
  aggregateSectionHullIntegrity,
  aggregateEnergy,
} from "./ship-status/ship-status-aggregation.js";
export { ShipStatusQuery } from "./ship-status/ship-status-runtime.js";
export {
  MissionProjectileWorld,
  ELECTRIC_CURRENT_PARAMETERS,
  isElectromagnetDefinition,
  isLooseFerromagneticCandidate,
} from "./mission/mission-projectile-world.js";
export { LooseFerromagneticPromoter } from "./mission/loose-ferromagnetic-promoter.js";
export { previewMissionTrajectory } from "./mission/mission-trajectory-preview.js";
// Fase 11d.2 — runtime de amenaza enemiga (ruta + ataque) cableado al reloj de misión.
export { EnemyThreatRuntime } from "./mission/enemy-threat-runtime.js";
export type { EnemyThreatRuntimeOptions } from "./mission/enemy-threat-runtime.js";

// Fase 11d — enemigos: ruta scripteada + combate cuerpo a cuerpo/a distancia.
export type { EnemyActor, EnemyActorId, EnemyArchetype, EnemyActorStatus } from "./enemies/enemy-actor.types.js";
export type { RouteWaypoint, RouteCompletion, ScriptedRoute } from "./enemies/enemy-route.types.js";
export { cellAtElapsedSeconds } from "./enemies/route-progression.js";
export type { RouteProgress } from "./enemies/route-progression.js";
export { weaponDamageSeverity, WEAPON_DAMAGE_PARAMETERS } from "./enemies/weapon-damage.js";
export type { WeaponDamageSeverity } from "./enemies/weapon-damage.js";
export type { CombatEvalContext, CombatRangeRule } from "./enemies/combat-rule.js";
export { MeleeAdjacencyRule } from "./enemies/rules/melee-adjacency-rule.js";
export { RangedProximityRule, RANGED_PROXIMITY_PARAMETERS } from "./enemies/rules/ranged-proximity-rule.js";
export { createDefaultCombatRuleRegistry } from "./enemies/rules/combat-rule-registry.js";
export { resolveEnemyAttack } from "./enemies/enemy-attack-resolver.js";
export type { EnemyAttackResolverOptions, EnemyAttackOutcome } from "./enemies/enemy-attack-resolver.js";
export type {
  EnemyAdvancedEvent,
  EnemyAttackedEvent,
  EnemyDefeatedEvent,
  EnemyDomainEvent,
} from "./enemies/enemy-events.types.js";
// Fase 11d.4 — contenido de enemigo del capítulo 2 ("Ecos en el Pasillo", solo arquetipo exploración).
export { ENEMY_SEED_BY_CHAPTER_ID } from "./enemies/campaign/chapter-02-enemy-seed.js";
export type { EnemySeed } from "./enemies/campaign/chapter-02-enemy-seed.js";

import type { SignalDomainEvent } from "./signals/signal-events.types.js";
import type { ReactionDomainEvent } from "./chemistry/reaction/reaction-events.types.js";
import type { AtmosphereDomainEvent } from "./atmosphere/atmosphere-events.types.js";
import type { FailureDomainEvent } from "./failure/failure-events.types.js";
import type { KineticDomainEvent } from "./kinetics/kinetic-events.types.js";
import type { CoreLoopDomainEvent } from "./tasks/task-events.types.js";
import type { CrewDomainEvent } from "./crew/crew-events.types.js";
import type { CrisisDomainEvent } from "./crisis/crisis-events.types.js";
import type { EnemyDomainEvent } from "./enemies/enemy-events.types.js";

/**
 * Unión agregada de todos los eventos de dominio del motor (Observer). `/game`
 * (Fase 8) instancia un `EventEmitter<DomainEvent>` y se suscribe por `kind`
 * para disparar partículas — es el contrato completo motor→render.
 */
export type DomainEvent =
  | SignalDomainEvent
  | ReactionDomainEvent
  | AtmosphereDomainEvent
  | FailureDomainEvent
  | KineticDomainEvent
  | CoreLoopDomainEvent
  | CrewDomainEvent
  | CrisisDomainEvent
  | EnemyDomainEvent;
