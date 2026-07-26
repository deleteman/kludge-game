import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { EnemyActorId } from "./enemy-actor.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";

/**
 * Eventos de dominio del subsistema de enemigos (Observer, CLAUDE.md) — mismo
 * contrato que `CrewDomainEvent`/`KineticDomainEvent`: `/engine` los emite,
 * `/game` (Fase 11d.3) se suscribe para animar `hopMove` y disparar
 * partículas. `/engine` nunca importa Phaser.
 */

/** Un enemigo avanzó a una nueva celda de su `ScriptedRoute`. */
export interface EnemyAdvancedEvent extends DomainEventBase {
  readonly kind: "enemy-advanced";
  readonly enemyId: EnemyActorId;
}

/** Un enemigo conectó un ataque (cuerpo a cuerpo o a distancia) contra un tripulante. */
export interface EnemyAttackedEvent extends DomainEventBase {
  readonly kind: "enemy-attacked";
  readonly enemyId: EnemyActorId;
  readonly targetId: CrewActorId;
  readonly rangeKind: "melee" | "ranged";
}

/** Un enemigo llegó a `hp <= 0`. */
export interface EnemyDefeatedEvent extends DomainEventBase {
  readonly kind: "enemy-defeated";
  readonly enemyId: EnemyActorId;
}

export type EnemyDomainEvent = EnemyAdvancedEvent | EnemyAttackedEvent | EnemyDefeatedEvent;
