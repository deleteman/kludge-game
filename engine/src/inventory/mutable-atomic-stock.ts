import type { AtomicPartsStock } from "./inventory.types.js";

/**
 * Caja mutable sobre el stock vivo de una misión, mismo patrón que
 * `mission/mutable-ship-state.ts::MutableShipState` (el ledger en sí es
 * inmutable — cada consumo/crédito produce un `AtomicPartsStock` nuevo).
 */
export class MutableAtomicStock {
  private current: AtomicPartsStock;

  constructor(initial: AtomicPartsStock) {
    this.current = initial;
  }

  get(): AtomicPartsStock {
    return this.current;
  }

  set(next: AtomicPartsStock): void {
    this.current = next;
  }
}
