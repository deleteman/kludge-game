import type { ComponentId } from "../components/physical-component.types.js";
import { type ComponentWear, DEFAULT_WEAR, WEAR_ORDER } from "../wear/wear.types.js";
import type { AtomicPartsStock, WearBuckets } from "./inventory.types.js";

/**
 * Unidades TOTALES de una pieza atómica, sumando todos sus buckets de desgaste
 * — clave ausente equivale a 0.
 *
 * La firma se mantuvo igual al migrar a buckets en 13c a propósito: los
 * llamadores que solo preguntan "¿tengo alguna?" (el selector de instalación de
 * `/game`, `MissionRuntime.stockOf`) siguen siendo correctos sin cambios. Para
 * decidir QUÉ unidad se gasta, usar `stockOfWear`/`wearBucketsOf`.
 */
export function stockOf(stock: AtomicPartsStock, componentId: ComponentId): number {
  const buckets = stock[componentId];
  if (!buckets) {
    return 0;
  }
  return WEAR_ORDER.reduce((total, wear) => total + (buckets[wear] ?? 0), 0);
}

/** Unidades de una pieza con un desgaste concreto. */
export function stockOfWear(
  stock: AtomicPartsStock,
  componentId: ComponentId,
  wear: ComponentWear,
): number {
  return stock[componentId]?.[wear] ?? 0;
}

/**
 * Buckets no vacíos de una pieza, del mejor al peor desgaste. Para que la UI
 * ofrezca una fila por estado en vez de un único número que oculta que la
 * mitad del stock está degradado (principio: la UI no debe mentir sobre el
 * estado del motor).
 */
export function wearBucketsOf(
  stock: AtomicPartsStock,
  componentId: ComponentId,
): ReadonlyArray<{ readonly wear: ComponentWear; readonly quantity: number }> {
  const buckets = stock[componentId];
  if (!buckets) {
    return [];
  }
  return WEAR_ORDER.flatMap((wear) => {
    const quantity = buckets[wear] ?? 0;
    return quantity > 0 ? [{ wear, quantity }] : [];
  });
}

export function hasStock(stock: AtomicPartsStock, componentId: ComponentId, quantity = 1): boolean {
  return stockOf(stock, componentId) >= quantity;
}

/**
 * Descuenta `quantity` unidades DEL BUCKET indicado. Devuelve `null` (sin
 * mutar) si no hay stock suficiente de ese desgaste concreto — el llamador
 * decide cómo comunicar el fallo (`ship-task-effect.ts` usa esto para rechazar
 * la instalación en vez de dejar stock negativo).
 *
 * El bucket es explícito y no se cae al mejor disponible: instalar una pieza
 * `nuevo` cuando solo quedan `degradado` debe fallar, no darte la degradada en
 * silencio.
 */
export function consumeStock(
  stock: AtomicPartsStock,
  componentId: ComponentId,
  quantity = 1,
  wear: ComponentWear = DEFAULT_WEAR,
): AtomicPartsStock | null {
  const available = stockOfWear(stock, componentId, wear);
  if (available < quantity) {
    return null;
  }
  return withBucket(stock, componentId, wear, available - quantity);
}

/** Acredita `quantity` unidades con un desgaste dado (ej. desarmar un compuesto libera sus ingredientes). */
export function creditStock(
  stock: AtomicPartsStock,
  componentId: ComponentId,
  quantity = 1,
  wear: ComponentWear = DEFAULT_WEAR,
): AtomicPartsStock {
  return withBucket(stock, componentId, wear, stockOfWear(stock, componentId, wear) + quantity);
}

/** Escribe un bucket, borrando la clave cuando queda en cero para no dejar ruido en el guardado. */
function withBucket(
  stock: AtomicPartsStock,
  componentId: ComponentId,
  wear: ComponentWear,
  quantity: number,
): AtomicPartsStock {
  const buckets: WearBuckets = { ...stock[componentId] };
  if (quantity > 0) {
    buckets[wear] = quantity;
  } else {
    delete buckets[wear];
  }
  return { ...stock, [componentId]: buckets };
}
