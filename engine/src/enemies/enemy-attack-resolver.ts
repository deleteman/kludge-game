import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ActuatorProperty, EmitterProperty } from "../properties/functional.types.js";
import type { CrewActor } from "../crew/crew-actor.types.js";
import { applyCrewDamage, HP_LOSS_FRACTION, type CrewHpResolution } from "../crew/hp-resolution.js";
import { manhattanDistance } from "../geometry/grid-distance.js";
import type { EnemyActor } from "./enemy-actor.types.js";
import type { CombatEvalContext, CombatRangeRule } from "./combat-rule.js";
import { createDefaultCombatRuleRegistry } from "./rules/combat-rule-registry.js";
import { weaponDamageSeverity } from "./weapon-damage.js";

export interface EnemyAttackResolverOptions {
  readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly combatRules?: ReadonlyMap<CombatRangeRule["kind"], CombatRangeRule>;
}

export interface EnemyAttackOutcome {
  readonly rangeKind: CombatRangeRule["kind"];
  readonly target: CrewActor;
  readonly hp: CrewHpResolution;
}

/**
 * Resuelve si un `EnemyActor` conecta un ataque contra algún tripulante vivo,
 * dado el estado actual de ambos. Orquesta (sin mutar nada, `hp-resolution.ts`
 * ya devuelve el actor actualizado): resuelve el `weaponComponentId` vía
 * `componentRegistry` (nunca literales de daño sueltos en `EnemyActor`),
 * calcula la distancia Manhattan (mismo criterio de legibilidad que
 * `geometry/grid-distance.ts`), prueba las reglas de rango del registro, y si
 * alguna aplica, calcula la severidad y llama `applyCrewDamage` — el mismo
 * punto único de convergencia de daño que usa `CrisisRuntime`, no una cuarta
 * función de daño paralela.
 *
 * Devuelve el primer tripulante (en el orden recibido) al que el ataque
 * conecta, o `null` si ninguno está en rango. La cadencia/cooldown entre
 * ataques (para no atacar todos los ticks) es responsabilidad del runtime que
 * llama a esta función (Fase 11d.2, `EnemyThreatRuntime`), no de este
 * resolver puro.
 */
export function resolveEnemyAttack(
  enemy: EnemyActor,
  crew: ReadonlyArray<CrewActor>,
  elapsedSeconds: number,
  options: EnemyAttackResolverOptions,
): EnemyAttackOutcome | null {
  const weaponDefinition = options.componentRegistry.get(enemy.weaponComponentId);
  if (!weaponDefinition) {
    return null;
  }
  const actuator = weaponDefinition.data.functional?.find(
    (property): property is ActuatorProperty => property.tag === "ACT",
  );
  if (!actuator) {
    return null;
  }
  const emitter = weaponDefinition.data.functional?.find(
    (property): property is EmitterProperty => property.tag === "EM",
  );

  const rules = options.combatRules ?? createDefaultCombatRuleRegistry();

  for (const target of crew) {
    if (target.hp <= 0 || target.currentSectionId !== enemy.sectionId || !target.currentCell) {
      continue;
    }
    const ctx: CombatEvalContext = {
      distance: manhattanDistance(enemy.cell, target.currentCell),
      actuator,
      emitter,
    };
    const matchedRule = [...rules.values()].find((rule) => rule.appliesTo(ctx));
    if (!matchedRule) {
      continue;
    }
    const severity = weaponDamageSeverity(actuator);
    const hp = applyCrewDamage(target, HP_LOSS_FRACTION[severity], "enemy-attack", elapsedSeconds);
    return { rangeKind: matchedRule.kind, target, hp };
  }
  return null;
}
