import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { CrisisTriggerSpec, CrisisResolutionSpec } from "./crisis-definition.types.js";

/** Proyección de solo lectura del mundo que una regla de crisis puede consultar. */
export interface CrisisEvalContext {
  readonly ship: Blueprint;
  readonly tick: TickContext;
  /**
   * Catálogo de definiciones (Fase 4), para reglas que necesitan resolver QUÉ
   * es una instancia colocada más allá de su `componentDefinitionId` crudo
   * (ej. `functional-tag-installed`: "¿tiene tag ACT?"). Opcional — solo las
   * reglas que lo necesitan lo exigen; el resto del contexto no cambia.
   */
  readonly componentRegistry?: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
}

/**
 * Strategy de trigger de crisis (CLAUDE.md: patrón Strategy — "¿aplica a este
 * estado? → aplicar"), mismo criterio que `ReactionRule`/`SignalRule`. Reglas
 * nuevas se añaden implementando esta interfaz y registrándolas en
 * `rules/crisis-rule-registry.ts`, nunca editando un switch central.
 */
export interface CrisisTriggerRule {
  readonly kind: CrisisTriggerSpec["kind"];
  isTriggered(spec: CrisisTriggerSpec, ctx: CrisisEvalContext): boolean;
}

export interface CrisisResolutionRule {
  readonly kind: CrisisResolutionSpec["kind"];
  isResolved(spec: CrisisResolutionSpec, ctx: CrisisEvalContext): boolean;
}
