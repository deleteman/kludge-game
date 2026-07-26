import type { ComponentId } from "../components/physical-component.types.js";
import type { Recipe, RecipeIngredient } from "../composition/recipe.types.js";
import type { WorkbenchPiece } from "./workbench-state.types.js";

/**
 * Traduce las piezas colocadas en la mesa a una `Recipe<ComponentId>` (GDD
 * 7.1, reutilizando `composition/recipe.types.ts` sin tipos nuevos). Piezas
 * repetidas del mismo `componentDefinitionId` se agregan en un único
 * `RecipeIngredient` con `quantity` sumada — mismo criterio que el catálogo
 * de Fase 4 (ej. "Motor pequeño x2").
 */
export function buildRecipeFromPieces(pieces: ReadonlyArray<WorkbenchPiece>): Recipe<ComponentId> {
  const quantityByRef = new Map<ComponentId, number>();
  const order: ComponentId[] = [];

  for (const piece of pieces) {
    const ref = piece.componentDefinitionId;
    if (!quantityByRef.has(ref)) {
      order.push(ref);
      quantityByRef.set(ref, 0);
    }
    quantityByRef.set(ref, quantityByRef.get(ref)! + 1);
  }

  const ingredients: RecipeIngredient<ComponentId>[] = order.map((ref) => ({
    ref,
    quantity: quantityByRef.get(ref)!,
  }));

  return { ingredients };
}
