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

export type { CrewTaskDependencyPlaceholder } from "./blueprint/crew-task-dependency.placeholder.types.js";
export type {
  Blueprint,
  BlueprintMetadata,
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
export type { SignalDomainEvent, SignalLatchedEvent } from "./signals/signal-events.types.js";

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
  NeutralizationEvent,
  ReactionDomainEvent,
  SpontaneousIgnitionEvent,
} from "./chemistry/reaction/reaction-events.types.js";
export {
  COMBUSTION_INTENSITY_BY_OXYGEN,
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
export { getGasFraction } from "./atmosphere/section.types.js";
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
export type {
  FailureDomainEvent,
  FailureMode,
  OverloadEvent,
  StructuralDegradedEvent,
  StructuralFailureEvent,
} from "./failure/failure-events.types.js";

import type { SignalDomainEvent } from "./signals/signal-events.types.js";
import type { ReactionDomainEvent } from "./chemistry/reaction/reaction-events.types.js";
import type { AtmosphereDomainEvent } from "./atmosphere/atmosphere-events.types.js";
import type { FailureDomainEvent } from "./failure/failure-events.types.js";

/**
 * Unión agregada de todos los eventos de dominio del motor (Observer). `/game`
 * (Fase 8) instancia un `EventEmitter<DomainEvent>` y se suscribe por `kind`
 * para disparar partículas — es el contrato completo motor→render.
 */
export type DomainEvent =
  SignalDomainEvent | ReactionDomainEvent | AtmosphereDomainEvent | FailureDomainEvent;
