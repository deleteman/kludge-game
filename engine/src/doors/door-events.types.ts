import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { DoorId, DoorOverrideSource, DoorState } from "./door.types.js";

/**
 * Eventos de dominio de puertas (Subfase 13h). El motor emite, `/game` se
 * suscribe para disparar partículas y sonido — `/engine` nunca sabe que existe
 * una capa visual (Observer, CLAUDE.md).
 *
 * Cada evento lleva `sectionId` de uno de los dos lados para que la capa visual
 * pueda ubicarlo sin volver a resolver la topología, mismo criterio que los
 * eventos de 13f.
 */
interface DoorEventBase extends DomainEventBase {
  readonly doorId: DoorId;
  readonly sectionId: SectionId;
}

/**
 * La hoja empezó a moverse. `opening`/`closing` y no `open`/`closed` porque la
 * transición dura `ACT.cadence`: el evento marca el ARRANQUE, y la capa visual
 * interpola el resto por su cuenta.
 */
export interface DoorTransitionEvent extends DoorEventBase {
  readonly kind: "door-transition";
  readonly to: Extract<DoorState, "opening" | "closing">;
  readonly durationSeconds: number;
}

/** La hoja llegó a destino. */
export interface DoorSettledEvent extends DoorEventBase {
  readonly kind: "door-settled";
  readonly to: Extract<DoorState, "open" | "closed">;
}

/**
 * Cambió QUIÉN manda sobre la puerta. `source` ausente = volvió a `auto`.
 * Es el evento que le permite a la UI decir por qué la puerta no responde en
 * vez de solo no responder.
 */
export interface DoorOverrideChangedEvent extends DoorEventBase {
  readonly kind: "door-override-changed";
  readonly source?: DoorOverrideSource;
}

export interface DoorDamagedEvent extends DoorEventBase {
  readonly kind: "door-damaged";
  readonly remainingHp: number;
  readonly maxHp: number;
}

/** Vida a 0: hueco permanente que ya no compartimenta (principio 5). */
export interface DoorDestroyedEvent extends DoorEventBase {
  readonly kind: "door-destroyed";
}

export interface DoorRepairedEvent extends DoorEventBase {
  readonly kind: "door-repaired";
}

/**
 * La puerta se cerró sobre un actor. Consecuencia directa de que `ACT.power`
 * signifique algo: hace peligroso cerrar una puerta por señal sin mirar quién
 * está cruzando.
 */
export interface DoorCrushedActorEvent extends DoorEventBase {
  readonly kind: "door-crushed-actor";
  readonly actorId: CrewActorId;
}

export type DoorDomainEvent =
  | DoorTransitionEvent
  | DoorSettledEvent
  | DoorOverrideChangedEvent
  | DoorDamagedEvent
  | DoorDestroyedEvent
  | DoorRepairedEvent
  | DoorCrushedActorEvent;
