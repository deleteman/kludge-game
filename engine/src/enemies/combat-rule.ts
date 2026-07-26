import type { ActuatorProperty, EmitterProperty } from "../properties/functional.types.js";

/**
 * Proyección de solo lectura que una regla de combate puede consultar —
 * mismo criterio que `CrisisEvalContext` (`crisis/crisis-rule.ts`): la regla
 * no conoce `EnemyActor`/`CrewActor` ni el `componentRegistry`, solo los datos
 * ya resueltos que necesita para decidir. `enemy-attack-resolver.ts` arma este
 * contexto a partir del `EnemyActor`, su celda objetivo y el
 * `PhysicalComponentDefinition` de `weaponComponentId`.
 */
export interface CombatEvalContext {
  /** Distancia Manhattan entre la celda del enemigo y la del objetivo (mismo criterio de legibilidad que `geometry/grid-distance.ts`). */
  readonly distance: number;
  readonly actuator?: ActuatorProperty;
  readonly emitter?: EmitterProperty;
}

/**
 * Strategy de rango de combate (CLAUDE.md: patrón Strategy — "¿aplica a este
 * estado? → aplicar"), mismo molde que `CrisisTriggerRule`/`CrisisResolutionRule`
 * (`crisis/crisis-rule.ts`). Reglas nuevas (ej. un tercer tipo de arma) se
 * añaden implementando esta interfaz y registrándolas en
 * `rules/combat-rule-registry.ts`, nunca editando un switch central.
 */
export interface CombatRangeRule {
  readonly kind: "melee" | "ranged";
  appliesTo(ctx: CombatEvalContext): boolean;
}
