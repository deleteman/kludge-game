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
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { DoorId } from "../doors/door.types.js";
import { weaponDamageSeverity } from "../enemies/weapon-damage.js";
import type { WeaponDamageSeverity } from "../enemies/weapon-damage.js";

export interface EnemyThreatRuntimeOptions {
  readonly enemies: MutableEnemyState;
  readonly routes: ReadonlyMap<EnemyActorId, ScriptedRoute>;
  readonly crew: MutableCrewState;
  readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly combatRules?: ReadonlyMap<CombatRangeRule["kind"], CombatRangeRule>;
  readonly enemyEmitter?: EventEmitter<EnemyDomainEvent>;
  readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
  /**
   * Puerta que bloquea el paso a una celda (Subfase 13h). Opcional: sin ella
   * los enemigos atraviesan la nave como antes de 13h.
   *
   * Devuelve el `DoorId` en vez de un booleano porque el enemigo no solo se
   * frena: la GOLPEA hasta romperla. Sin esto, una puerta trabada por
   * electroimán dejaría al intruso atascado para siempre y el nivel muerto.
   */
  readonly doorBlocking?: (cell: GridPosition) => DoorId | undefined;
  /** Aplica daño a una puerta (`MissionDoorRuntime.applyDamage`). */
  readonly damageDoor?: (doorId: DoorId, amount: number, elapsedSeconds: number) => void;
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
  private readonly doorBlocking?: (cell: GridPosition) => DoorId | undefined;
  private readonly damageDoor?: (doorId: DoorId, amount: number, elapsedSeconds: number) => void;
  /**
   * Segundos que cada enemigo pasó detenido ante una puerta (Subfase 13h).
   *
   * Existe porque `cellAtElapsedSeconds` es una función del tiempo ABSOLUTO:
   * sin descontar la espera, un enemigo frenado 20 s reaparecería 20 s más
   * adelante en su ruta en cuanto la puerta se abriera, como si nunca lo
   * hubieran detenido. Con el offset, la ruta se reanuda justo donde iba.
   */
  private readonly routeHoldSeconds = new Map<EnemyActorId, number>();
  /** Puerta que frena a cada enemigo AHORA — la que va a golpear si no tiene otro blanco. */
  private readonly blockedByDoor = new Map<EnemyActorId, DoorId>();

  constructor(options: EnemyThreatRuntimeOptions) {
    this.doorBlocking = options.doorBlocking;
    this.damageDoor = options.damageDoor;
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
      const advanced = this.advance(enemy, ctx);
      if (advanced.status === "defeated") {
        continue;
      }
      this.attemptAttack(advanced, ctx.elapsedSeconds);
    }
  }

  /** Avanza la ruta scripteada del enemigo, si tiene una. Devuelve el `EnemyActor` (actualizado o no). */
  private advance(enemy: EnemyActor, ctx: TickContext): EnemyActor {
    const elapsedSeconds = ctx.elapsedSeconds;
    const route = this.routes.get(enemy.id);
    if (!route) {
      return enemy;
    }
    // Subfase 13h: el reloj de ruta corre descontando lo que el enemigo pasó
    // esperando ante una puerta.
    const hold = this.routeHoldSeconds.get(enemy.id) ?? 0;
    const progress = cellAtElapsedSeconds(route, elapsedSeconds - hold);
    const moved = progress.cell.x !== enemy.cell.x || progress.cell.y !== enemy.cell.y || progress.sectionId !== enemy.sectionId;

    if (moved) {
      const blockingDoor = this.doorBlocking?.(progress.cell);
      if (blockingDoor) {
        // Se queda en la celda previa y su ruta se congela. La puerta pasa a
        // ser su blanco: un intruso frenado no se queda mirando la pared.
        this.blockedByDoor.set(enemy.id, blockingDoor);
        this.routeHoldSeconds.set(enemy.id, hold + ctx.dtSeconds);
        return enemy;
      }
    }
    this.blockedByDoor.delete(enemy.id);

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
      // Sin tripulante en rango pero con una puerta cerrándole el paso: la
      // golpea (Subfase 13h). Es lo que evita que una puerta trabada por
      // electroimán deje al intruso atascado para siempre y el nivel muerto —
      // trabar una puerta compra TIEMPO, no inmunidad.
      if (this.attackBlockingDoor(enemy, actuator, elapsedSeconds)) {
        return;
      }
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

  /**
   * Golpea la puerta que le bloquea el paso. Devuelve `true` si atacó.
   *
   * Reusa `weaponDamageSeverity` —la misma traducción de `power`/`cadence` a
   * severidad que ya se aplica contra tripulantes— para no tener dos escalas de
   * daño en paralelo: un arma que hace daño medio a una persona hace daño medio
   * a una hoja de metal, y la diferencia la pone la vida de la puerta.
   */
  private attackBlockingDoor(
    enemy: EnemyActor,
    actuator: ActuatorProperty,
    elapsedSeconds: number,
  ): boolean {
    const doorId = this.blockedByDoor.get(enemy.id);
    if (!doorId || !this.damageDoor) {
      return false;
    }
    this.lastAttackSeconds.set(enemy.id, elapsedSeconds);
    this.enemies.set({ ...enemy, status: "attacking" });
    this.damageDoor(doorId, DOOR_DAMAGE_BY_SEVERITY[weaponDamageSeverity(actuator)], elapsedSeconds);
    return true;
  }
}

/**
 * Daño a una puerta por golpe, según la severidad del arma. Escala pensada
 * contra `DOOR_PARAMETERS.maxHpByResistance`: una `compuerta-blindada` (300 HP)
 * aguanta ~6 golpes medios, tiempo suficiente para que el jugador reaccione y
 * poco para que ignorar al intruso salga gratis.
 */
const DOOR_DAMAGE_BY_SEVERITY: Record<WeaponDamageSeverity, number> = {
  low: 25,
  medium: 50,
  high: 100,
};
