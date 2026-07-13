import type { EntityRegistry } from "../../composition/entity-registry.js";
import { isCompositeEntity } from "../../composition/composable-entity.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemical-substance.types.js";
import type { ReactantSubstance } from "./reaction-context.types.js";
import { toReactant } from "./tag-predicates.js";

/**
 * Clave canónica de un multiset de sustancias por id+multiplicidad, insensible
 * al orden. `[H, O, H]` y `[H, H, O]` producen la misma clave, de modo que el
 * lookup de receta nombrada no depende del orden en que se mezclen.
 */
function canonicalKey(ids: ReadonlyArray<ChemicalSubstanceId>): string {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => `${id}x${count}`)
    .sort()
    .join("+");
}

/**
 * Paso 1 de la resolución de identidad (GDD 5.3): índice de reverse-lookup
 * `multiset de sustancias en contacto → compuesto nombrado`. Se construye desde
 * el `EntityRegistry` de composición existente (Fase 1) — reutiliza las recetas
 * elemento→compuesto de GDD 5.4.2, no un catálogo de reacciones aparte. Si un
 * conjunto de reactivos coincide EXACTAMENTE con la receta de un compuesto, la
 * mezcla ES ese compuesto (ej. Hidrógeno+Oxígeno → Agua), con precedencia sobre
 * cualquier regla de tags.
 */
export class NamedRecipeIndex {
  private readonly byKey = new Map<string, ChemicalSubstanceDefinition>();

  constructor(registry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>) {
    for (const definition of registry.all()) {
      if (!isCompositeEntity(definition)) {
        continue;
      }
      const ids = definition.recipe.ingredients.flatMap((ingredient) =>
        Array.from({ length: ingredient.quantity }, () => ingredient.ref),
      );
      this.byKey.set(canonicalKey(ids), definition);
    }
  }

  lookup(reactants: ReadonlyArray<ReactantSubstance>): ReactantSubstance | undefined {
    if (reactants.length < 2) {
      return undefined;
    }
    const definition = this.byKey.get(canonicalKey(reactants.map((r) => r.id)));
    return definition ? toReactant(definition) : undefined;
  }
}
