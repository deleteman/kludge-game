/**
 * Ledger inmutable de elementos químicos (Subfase 13e) — mismo molde que
 * `inventory-ledger.ts` para piezas físicas, sin la dimensión de desgaste
 * (una sustancia no acumula historia entre usos).
 *
 * Cada operación devuelve un `ElementStock` nuevo; el estado vivo lo sostiene
 * `MutableElementStock`, igual que `MutableAtomicStock` sostiene el de piezas.
 */

import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ElementStock } from "./inventory.types.js";

/** Unidades disponibles de un elemento — clave ausente equivale a 0. */
export function elementStockOf(stock: ElementStock, elementId: ChemicalSubstanceId): number {
  return stock[elementId] ?? 0;
}

/**
 * Cuenta de cuántas veces aparece cada elemento en una selección. La paleta de
 * la mesa trabaja con un ARRAY con repetidos ("2 hidrógeno + 1 oxígeno" es
 * `[h, h, o]`, la proporción es la multiplicidad), así que este es el puente
 * entre esa representación y el ledger.
 */
export function tallyElements(
  selection: ReadonlyArray<ChemicalSubstanceId>,
): ReadonlyMap<ChemicalSubstanceId, number> {
  const tally = new Map<ChemicalSubstanceId, number>();
  for (const elementId of selection) {
    tally.set(elementId, (tally.get(elementId) ?? 0) + 1);
  }
  return tally;
}

/**
 * Elementos de la selección que no alcanzan con el stock actual. Vacío = se
 * puede sintetizar. Devolver el detalle (y no un booleano) es lo que permite a
 * la UI decir QUÉ falta en vez de un "no se puede" opaco.
 */
export function missingElements(
  stock: ElementStock,
  selection: ReadonlyArray<ChemicalSubstanceId>,
): ReadonlyArray<{ readonly elementId: ChemicalSubstanceId; readonly missing: number }> {
  const missing: { elementId: ChemicalSubstanceId; missing: number }[] = [];
  for (const [elementId, needed] of tallyElements(selection)) {
    const shortfall = needed - elementStockOf(stock, elementId);
    if (shortfall > 0) {
      missing.push({ elementId, missing: shortfall });
    }
  }
  return missing;
}

export function hasElements(
  stock: ElementStock,
  selection: ReadonlyArray<ChemicalSubstanceId>,
): boolean {
  return missingElements(stock, selection).length === 0;
}

/**
 * Descuenta la selección completa. Devuelve `null` (SIN mutar ni descontar
 * parcialmente) si algún elemento no alcanza — mismo contrato que
 * `consumeStock`: el llamador decide cómo comunicar el fallo, y nunca queda un
 * stock a medio gastar.
 */
export function consumeElements(
  stock: ElementStock,
  selection: ReadonlyArray<ChemicalSubstanceId>,
): ElementStock | null {
  if (!hasElements(stock, selection)) {
    return null;
  }
  let next = stock;
  for (const [elementId, quantity] of tallyElements(selection)) {
    next = withQuantity(next, elementId, elementStockOf(next, elementId) - quantity);
  }
  return next;
}

/** Acredita unidades (extracción de un reservorio, GDD 5.4.1). */
export function creditElements(
  stock: ElementStock,
  elementId: ChemicalSubstanceId,
  quantity = 1,
): ElementStock {
  if (quantity <= 0) {
    return stock;
  }
  return withQuantity(stock, elementId, elementStockOf(stock, elementId) + quantity);
}

/** Acredita varias unidades de golpe, respetando la multiplicidad de la lista. */
export function creditElementList(
  stock: ElementStock,
  elements: ReadonlyArray<ChemicalSubstanceId>,
): ElementStock {
  let next = stock;
  for (const [elementId, quantity] of tallyElements(elements)) {
    next = creditElements(next, elementId, quantity);
  }
  return next;
}

/** Escribe una cantidad, borrando la clave al llegar a cero para no dejar ruido en el guardado. */
function withQuantity(
  stock: ElementStock,
  elementId: ChemicalSubstanceId,
  quantity: number,
): ElementStock {
  const next: ElementStock = { ...stock };
  if (quantity > 0) {
    next[elementId] = quantity;
  } else {
    delete next[elementId];
  }
  return next;
}
