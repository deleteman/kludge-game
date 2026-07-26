import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { CrewActorId } from "./crew-actor.types.js";

/**
 * Causa de daño/muerte de un tripulante (GDD 6.8, tabla "muertes gráficas").
 * Cada causa mapea a una variante propia del efecto de partículas ya definido
 * para ese fenómeno (`game/src/particles/effects/crew-death-effect.ts`), no a
 * un fenómeno nuevo — principio 6 de CLAUDE.md.
 */
export type CrewDamageCause =
  | "fire"
  | "explosion"
  | "corrosion"
  | "electrocution"
  | "cold"
  | "kinetic-impact"
  | "enemy-attack";

/** Un tripulante sufrió daño sin llegar a `hp <= 0` (GDD 6.1: vulnerabilidad a las mismas reglas físicas). */
export interface CrewDamagedEvent extends DomainEventBase {
  readonly kind: "crew-damaged";
  readonly actorId: CrewActorId;
  readonly cause: CrewDamageCause;
  readonly hpLost: number;
  readonly remainingHp: number;
}

/** Un tripulante murió (GDD 6.1: permadeath individual, permanente en campaña). */
export interface CrewDeathEvent extends DomainEventBase {
  readonly kind: "crew-death";
  readonly actorId: CrewActorId;
  readonly cause: CrewDamageCause;
}

export type CrewDomainEvent = CrewDamagedEvent | CrewDeathEvent;
