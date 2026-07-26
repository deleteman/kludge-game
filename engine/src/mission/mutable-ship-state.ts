import type { Blueprint } from "../blueprint/blueprint.types.js";

/**
 * Caja mutable sobre el `Blueprint` vivo de una misión en curso. `Blueprint`
 * es inmutable por diseño (Fase 1) — cada mutación (desmontar/instalar/
 * conectar) produce un `Blueprint` nuevo; esta clase es el único punto que
 * retiene "cuál es el actual" para que `TaskEffect` (que solo recibe la
 * tarea, no el mundo) y `CrisisRuntime` (que lee el mundo cada tick) compartan
 * la misma fuente de verdad sin acoplarse entre sí.
 */
export class MutableShipState {
  private current: Blueprint;

  constructor(initial: Blueprint) {
    this.current = initial;
  }

  get(): Blueprint {
    return this.current;
  }

  set(next: Blueprint): void {
    this.current = next;
  }
}
