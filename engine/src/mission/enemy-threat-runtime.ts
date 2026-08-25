import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ActuatorProperty } from "../properties/functional.types.js";
import type { EnemyActor, EnemyActorId } from "../enemies/enemy-actor.types.js";
import type { ScriptedRoute } from "../enemies/enemy-route.types.js";
import { cellAtElapsedSeconds } from "../enemies/route-progression.js";
import { resolveEnemyAttack } from "../enemies/enemy-attack-resolver.js";
import type { CombatRangeRule } from "../enemies/combat-rule.js";
import type { EnemyDomainEvent } from "../enemies/enemy-events.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import type { MutableEnemyState } from "./mutable-enemy-state.js";
import type { MutableCrewState } from "./mutable-crew-state.js";

export interface EnemyThreatRuntimeOptions {
  readonly enemies: MutableEnemyState;
  readonly routes: ReadonlyMap<EnemyActorId, ScriptedRoute>;
  readonly crew: MutableCrewState;
  readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly combatRules?: ReadonlyMap<CombatRangeRule["kind"], CombatRangeRule>;
  readonly enemyEmitter?: EventEmitter<EnemyDomainEvent>;
  readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
}

/**
 * Adaptador `Tickable` (Fase 11d.2) sobre las funciones puras del dominio
 * `enemies/` (`cellAtElapsedSeconds`/`resolveEnemyAttack`), mismo molde que
 * `CrisisRuntime` sobre `evaluateCrisis`: en cada tick de ejecución avanza a
 * cada enemigo vivo por su `ScriptedRoute`, emite `enemy-advanced` si cambió
 * de celda, y prueba si conecta un ataque contra la tripulación — aplicando
 * el resultado sobre `crew`/`enemies` (los resolvers puros no mutan nada).
 *
 * La cadencia entre ataques (para no atacar todos los ticks) vive aquí, no en
 * `resolveEnemyAttack` (puro, sin memoria de tiempo): se interpreta
 * `ActuatorProperty.cadence` como el cooldown en segundos entre disparos de
 * esa arma, mismo criterio de "cadencia baja = ataca más seguido" que ya usa
 * `weaponDamageSeverity`.
 */
export class EnemyThreatRuntime implements Tickable {
  private readonly enemies: MutableEnemyState;
  private readonly routes: ReadonlyMap<EnemyActorId, ScriptedRoute>;
  private readonly crew: MutableCrewState;
  private readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  private readonly combatRules?: ReadonlyMap<CombatRangeRule["kind"], CombatRangeRule>;
  private readonly enemyEmitter?: EventEmitter<EnemyDomainEvent>;
  private readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
  private readonly lastAttackSeconds = new Map<EnemyActorId, number>();

  constructor(options: EnemyThreatRuntimeOptions) {
    this.enemies = options.enemies;
    this.routes = options.routes;
    this.crew = options.crew;
    this.componentRegistry = options.componentRegistry;
    this.combatRules = options.combatRules;
    this.enemyEmitter = options.enemyEmitter;
    this.crewEmitter = options.crewEmitter;
  }

  tick(ctx: TickContext): void {
    for (const enemy of this.enemies.all()) {
      if (enemy.status === "defeated") {
        continue;
      }
      const advanced = this.advance(enemy, ctx.elapsedSeconds);
      if (advanced.status === "defeated") {
        continue;
      }
      this.attemptAttack(advanced, ctx.elapsedSeconds);
    }
  }

  /** Avanza la ruta scripteada del enemigo, si tiene una. Devuelve el `EnemyActor` (actualizado o no). */
  private advance(enemy: EnemyActor, elapsedSeconds: number): EnemyActor {
    const route = this.routes.get(enemy.id);
    if (!route) {
      return enemy;
    }
    const progress = cellAtElapsedSeconds(route, elapsedSeconds);
    const moved = progress.cell.x !== enemy.cell.x || progress.cell.y !== enemy.cell.y || progress.sectionId !== enemy.sectionId;
    let updated = enemy;
    if (moved) {
      updated = { ...enemy, cell: progress.cell, sectionId: progress.sectionId };
      this.enemies.set(updated);
      this.enemyEmitter?.emit({ kind: "enemy-advanced", enemyId: enemy.id, elapsedSeconds });
    }
    // `"vanish"` reutiliza el estado `"defeated"` (state machine sin un cuarto
    // valor para "removido sin combate"): a `/game` (Fase 11d.3) le basta con
    // saber que el enemigo ya no está en juego para limpiar su token, sin
    // importar si fue por derrota o por fin de patrulla.
    if (route.onComplete === "vanish" && progress.completed && updated.status !== "defeated") {
      updated = { ...updated, status: "defeated" };
      this.enemies.set(updated);
      this.enemyEmitter?.emit({ kind: "enemy-defeated", enemyId: enemy.id, elapsedSeconds });
    }
    return updated;
  }

  private attemptAttack(enemy: EnemyActor, elapsedSeconds: number): void {
    const weaponDefinition = this.componentRegistry.get(enemy.weaponComponentId);
    const actuator = weaponDefinition?.data.functional?.find(
      (property): property is ActuatorProperty => property.tag === "ACT",
    );
    if (!actuator) {
      return;
    }
    const lastAttack = this.lastAttackSeconds.get(enemy.id);
    if (lastAttack !== undefined && elapsedSeconds - lastAttack < actuator.cadence) {
      if (enemy.status !== "advancing") {
        this.enemies.set({ ...enemy, status: "advancing" });
      }
      return;
    }
    const outcome = resolveEnemyAttack(enemy, this.crew.all(), elapsedSeconds, {
      componentRegistry: this.componentRegistry,
      combatRules: this.combatRules,
    });
    if (!outcome) {
      if (enemy.status !== "advancing") {
        this.enemies.set({ ...enemy, status: "advancing" });
      }
      return;
    }
    this.lastAttackSeconds.set(enemy.id, elapsedSeconds);
    this.enemies.set({ ...enemy, status: "attacking" });
    this.crew.set(outcome.hp.actor);
    if (outcome.hp.event) {
      this.crewEmitter?.emit(outcome.hp.event);
    }
    this.enemyEmitter?.emit({
      kind: "enemy-attacked",
      enemyId: enemy.id,
      targetId: outcome.target.id,
      rangeKind: outcome.rangeKind,
      elapsedSeconds,
    });
  }
}
