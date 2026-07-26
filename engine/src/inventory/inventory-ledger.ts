import type { ComponentId } from "../components/physical-component.types.js";
import type { AtomicPartsStock } from "./inventory.types.js";

/** Unidades disponibles de una pieza atómica — clave ausente equivale a 0. */
export function stockOf(stock: AtomicPartsStock, componentId: ComponentId): number {
  return stock[componentId] ?? 0;
}

export function hasStock(stock: AtomicPartsStock, componentId: ComponentId, quantity = 1): boolean {
  return stockOf(stock, componentId) >= quantity;
}

/**
 * Descuenta `quantity` unidades. Devuelve `null` (sin mutar) si no hay stock
 * suficiente — el llamador decide cómo comunicar el fallo (`ship-task-effect.ts`
 * usa esto para rechazar la instalación en vez de dejar stock negativo).
 */
export function consumeStock(
  stock: AtomicPartsStock,
  componentId: ComponentId,
  quantity = 1,
): AtomicPartsStock | null {
  const available = stockOf(stock, componentId);
  if (available < quantity) {
    return null;
  }
  return { ...stock, [componentId]: available - quantity };
}

/** Acredita `quantity` unidades (ej. desarmar un compuesto libera sus ingredientes). */
export function creditStock(
  stock: AtomicPartsStock,
  componentId: ComponentId,
  quantity = 1,
): AtomicPartsStock {
  return { ...stock, [componentId]: stockOf(stock, componentId) + quantity };
}
