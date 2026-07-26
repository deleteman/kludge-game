import type { EnemyActor, EnemyActorId } from "../enemies/enemy-actor.types.js";

/**
 * Caja mutable sobre el estado VIVO de los enemigos activos de una misión
 * (Fase 11d.2). Análoga a `MutableCrewState`: `EnemyActor` es inmutable, así
 * que avanzar una ruta o resolver un ataque produce un actor nuevo; esta clase
 * retiene "cuál es el actual" para que `EnemyThreatRuntime` (que muta al
 * tickear) y `MissionProjectileWorld` (que resuelve colisiones contra el
 * mismo estado) lean la misma fuente de verdad.
 */
export class MutableEnemyState {
  private readonly byId = new Map<EnemyActorId, EnemyActor>();
  private readonly order: ReadonlyArray<EnemyActorId>;

  constructor(enemies: ReadonlyArray<EnemyActor>) {
    for (const enemy of enemies) {
      this.byId.set(enemy.id, enemy);
    }
    this.order = enemies.map((enemy) => enemy.id);
  }

  get(id: EnemyActorId): EnemyActor | undefined {
    return this.byId.get(id);
  }

  /** Todos los enemigos activos, en el orden de registro. */
  all(): ReadonlyArray<EnemyActor> {
    return this.order.map((id) => this.byId.get(id)!).filter((enemy): enemy is EnemyActor => enemy !== undefined);
  }

  set(enemy: EnemyActor): void {
    this.byId.set(enemy.id, enemy);
  }
}
