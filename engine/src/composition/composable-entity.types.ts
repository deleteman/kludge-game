import type { Recipe } from "./recipe.types.js";

/**
 * Abstracción compartida entre el modelo físico (átomo→compuesto→ensamblaje,
 * GDD 7.1) y el modelo químico (elemento→compuesto, GDD 5.4.1-5.4.2) —
 * "misma lógica en ambos dominios, no dos sistemas paralelos" (CLAUDE.md,
 * principio de diseño #3).
 *
 * Un "ensamblaje" (Nivel 2 del GDD 7.1) no es un tipo aparte: es una
 * `CompositeEntity` cuya receta referencia otras entidades compuestas en vez
 * de atómicas. El Nivel 2 emerge de esta unión recursiva sin código nuevo.
 */
export interface AtomicEntity<TId, TAtomicData> {
  readonly level: "atomic";
  readonly id: TId;
  readonly name: string;
  readonly data: TAtomicData;
}

export interface CompositeEntity<TId, TCompositeData, TRef> {
  readonly level: "composite";
  readonly id: TId;
  readonly name: string;
  readonly data: TCompositeData;
  readonly recipe: Recipe<TRef>;
}

export type ComposableEntity<TId, TAtomicData, TCompositeData, TRef> =
  AtomicEntity<TId, TAtomicData> | CompositeEntity<TId, TCompositeData, TRef>;

export function isAtomicEntity<TId, TAtomicData, TCompositeData, TRef>(
  entity: ComposableEntity<TId, TAtomicData, TCompositeData, TRef>,
): entity is AtomicEntity<TId, TAtomicData> {
  return entity.level === "atomic";
}

export function isCompositeEntity<TId, TAtomicData, TCompositeData, TRef>(
  entity: ComposableEntity<TId, TAtomicData, TCompositeData, TRef>,
): entity is CompositeEntity<TId, TCompositeData, TRef> {
  return entity.level === "composite";
}
