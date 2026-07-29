import type Phaser from "phaser";
import type { DomainEvent } from "engine";

import type { DomainEventOfKind } from "../particles/particle-effect.types.js";

/**
 * Análogo sonoro de `EventDrivenEffect` (`particles/particle-effect.types.ts`):
 * reacciona a un `DomainEvent` puntual de un `kind` concreto. Sin `position`
 * — el audio de esta subfase (12b) no es posicional/espacial, a diferencia de
 * las partículas.
 */
export interface EventDrivenSound<K extends DomainEvent["kind"] = DomainEvent["kind"]> {
  readonly kind: K;
  play(scene: Phaser.Scene, event: DomainEventOfKind<K>): void;
}

/**
 * Análogo sonoro de `StateDrivenEffect`: loop ambiental que se prende/apaga y
 * ajusta volumen según estado vivo del motor (fuga de gas, sin `DomainEvent`
 * propio). Mismo criterio que `atmosphere-state-effects.ts`.
 */
export interface StateDrivenSound<TState> {
  start(scene: Phaser.Scene): void;
  update(state: TState): void;
  stop(): void;
}
