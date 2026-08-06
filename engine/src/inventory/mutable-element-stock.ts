import type { ElementStock } from "./inventory.types.js";

/**
 * Caja mutable sobre el stock vivo de elementos de una misión (Subfase 13e),
 * mismo patrón que `MutableAtomicStock`/`MutableShipState` — el ledger en sí
 * es inmutable, cada consumo/crédito produce un `ElementStock` nuevo.
 */
export class MutableElementStock {
  private current: ElementStock;

  constructor(initial: ElementStock) {
    this.current = initial;
  }

  get(): ElementStock {
    return this.current;
  }

  set(next: ElementStock): void {
    this.current = next;
  }
}
