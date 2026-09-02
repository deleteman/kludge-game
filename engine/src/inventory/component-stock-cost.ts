import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import { isCompositeEntity } from "../composition/composable-entity.types.js";
import { DEFAULT_WEAR, type ComponentWear } from "../wear/wear.types.js";

/**
 * Qué le cuesta al inventario materializar UNA pieza (ronda 4c de playtest de
 * 14a-4).
 *
 * **Por qué existe.** La fórmula estaba escrita dentro de `payComponentCost`
 * (`mission/ship-task-effect.ts`), que además de decidir el coste lo COBRA. La
 * reserva de stock de la cola necesita exactamente el mismo cálculo sin mutar
 * nada: sin extraerlo, la reserva sería una segunda copia de la fórmula, y dos
 * copias de una fórmula de coste son dos sitios donde arreglar el próximo bug
 * de stock — el patrón que este proyecto ya pagó en rondas de playtest
 * anteriores. Ahora hay una sola definición de "qué cuesta" y dos lectores:
 * cobrar (`payComponentCost`) y reservar (`tasks/queued-reservations.ts`).
 *
 * Es una función PURA sobre el catálogo: no mira el stock ni decide si alcanza.
 * "Qué cuesta" y "¿lo tengo?" son dos preguntas distintas y solo la primera
 * vive acá.
 */

type ComponentRegistry = EntityRegistry<ComponentId, PhysicalComponentDefinition>;

/** Una línea de coste: tantas unidades de esta pieza, en este bucket de desgaste. */
export interface StockCostLine {
  readonly ref: ComponentId;
  readonly wear: ComponentWear;
  readonly quantity: number;
}

/**
 * Las tres ramas, sin fallback silencioso en ninguna:
 *  - **atómico** → 1 unidad del bucket de desgaste pedido;
 *  - **compuesto con `consumeRecipe`** → sus ingredientes, bucket `nuevo`
 *    estricto (un ingrediente degradado no sirve para armar una receta);
 *  - **compuesto sin el flag** → gratis: es una creación del jugador, que ya
 *    pagó al ensamblarla en la mesa de creación.
 *
 * Un componente que el registry no conoce cuesta cero, mismo criterio que ya
 * tenía `payComponentCost`: sin definición no hay receta que cobrar, y romper
 * el tick por un id desconocido sería peor que dejar pasar la tarea.
 */
export function componentStockCost(
  componentRegistry: ComponentRegistry,
  componentId: ComponentId,
  wear: ComponentWear,
  consumeRecipe: boolean,
): ReadonlyArray<StockCostLine> {
  const definition = componentRegistry.get(componentId);
  if (!definition) {
    return [];
  }
  if (!isCompositeEntity(definition)) {
    return [{ ref: componentId, wear, quantity: 1 }];
  }
  if (!consumeRecipe) {
    return [];
  }
  return definition.recipe.ingredients.map((ingredient) => ({
    ref: ingredient.ref,
    wear: DEFAULT_WEAR,
    quantity: ingredient.quantity,
  }));
}

/** Clave de agregación de un bucket concreto (`pieza|desgaste`) — compartida por reserva y consulta. */
export function stockCostKey(ref: ComponentId, wear: ComponentWear): string {
  return `${ref}|${wear}`;
}
