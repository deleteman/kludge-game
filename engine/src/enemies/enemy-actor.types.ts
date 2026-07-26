import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";

export type EnemyActorId = Brand<string, "EnemyActorId">;

/**
 * Arquetipo de movimiento/animación (GDD 11.2: "enemigos reutilizan el mismo
 * sistema [hop] con firma de salto propia"). Mapea 1:1 a las firmas ya
 * provistas en `game/src/crew/hop-movement.ts`
 * (`ARMORED_ENEMY_SIGNATURE`/`AGILE_ENEMY_SIGNATURE`) — este tipo no inventa
 * variantes nuevas de animación, solo selecciona entre las dos ya reservadas.
 */
export type EnemyArchetype = "armored" | "agile";

/** State machine explícita (CLAUDE.md) — no banderas booleanas sueltas. */
export type EnemyActorStatus = "advancing" | "attacking" | "defeated";

/**
 * Enemigo instanciado en misión (Fase 11d). Posición por celda desde el
 * origen (a diferencia de `CrewActor.currentCell`, que es opcional y
 * retrocompatible) — un enemigo sin celda conocida no tiene sentido de
 * dominio.
 */
export interface EnemyActor {
  readonly id: EnemyActorId;
  readonly archetype: EnemyArchetype;
  readonly hp: number;
  readonly maxHp: number;
  readonly sectionId: SectionId;
  readonly cell: GridPosition;
  /**
   * Componente de catálogo que porta el arma (composición EM+ACT, ver
   * `torreta-automatizada`/`garra-de-abordaje` en
   * `components/catalog/composite/guerra.ts`) — nunca literales de daño
   * sueltos en `EnemyActor`. Así, desarmar un enemigo a futuro es degradar la
   * instancia/definición de este componente, sin tocar este tipo.
   */
  readonly weaponComponentId: ComponentId;
  readonly status: EnemyActorStatus;
}
