import type { AtomicEntity, ComposableEntity, CompositeEntity } from "./composable-entity.types.js";
import type { EntityRegistry } from "./entity-registry.js";
import type { Recipe } from "./recipe.types.js";

export class CompositionError extends Error {}

/**
 * Hooks de validación específicos de dominio. La factory genérica valida la
 * integridad de la receta (referencias colgantes, cantidades); cada dominio
 * (física, química) añade aquí las reglas que le son propias, sin duplicar
 * la lógica de recorrido/registro.
 */
export interface CompositionFactoryHooks<TAtomicData, TCompositeData> {
  readonly validateAtomicData?: (data: TAtomicData) => void;
  readonly validateCompositeData?: (data: TCompositeData) => void;
}

export interface ResolvedIngredient<TId, TAtomicData, TCompositeData, TRef> {
  readonly entity: ComposableEntity<TId, TAtomicData, TCompositeData, TRef>;
  readonly quantity: number;
}

/**
 * Fábrica genérica de entidades componibles: implementa GDD 7.1-7.2
 * (átomo→compuesto→ensamblaje) y 5.4.1-5.4.2 (elemento→compuesto) con la
 * MISMA lógica (CLAUDE.md, principio de diseño #3 y patrón Factory pedido
 * para "construir compuestos desde recetas atómicas"). Cada dominio la
 * instancia con sus propios tipos y hooks de validación — ver
 * `components/physical-component-factory.ts` y
 * `chemistry/chemical-substance-factory.ts`.
 */
export class CompositionFactory<TId, TAtomicData, TCompositeData, TRef extends TId> {
  constructor(
    private readonly registry: EntityRegistry<
      TId,
      ComposableEntity<TId, TAtomicData, TCompositeData, TRef>
    >,
    private readonly hooks: CompositionFactoryHooks<TAtomicData, TCompositeData> = {},
  ) {}

  buildAtomic(params: {
    readonly id: TId;
    readonly name: string;
    readonly data: TAtomicData;
  }): AtomicEntity<TId, TAtomicData> {
    this.hooks.validateAtomicData?.(params.data);
    return { level: "atomic", id: params.id, name: params.name, data: params.data };
  }

  buildComposite(params: {
    readonly id: TId;
    readonly name: string;
    readonly data: TCompositeData;
    readonly recipe: Recipe<TRef>;
  }): CompositeEntity<TId, TCompositeData, TRef> {
    this.hooks.validateCompositeData?.(params.data);
    this.assertRecipeIntegrity(params.recipe);
    return {
      level: "composite",
      id: params.id,
      name: params.name,
      data: params.data,
      recipe: params.recipe,
    };
  }

  /** Resuelve cada ingrediente de una receta a su entidad registrada (recursivo por construcción: un ingrediente puede ser a su vez compuesto — Nivel 2). */
  resolveIngredients(
    recipe: Recipe<TRef>,
  ): ReadonlyArray<ResolvedIngredient<TId, TAtomicData, TCompositeData, TRef>> {
    return recipe.ingredients.map(({ ref, quantity }) => {
      const entity = this.registry.get(ref);
      if (!entity) {
        throw new CompositionError(`Dangling recipe reference: ${String(ref)}`);
      }
      return { entity, quantity };
    });
  }

  private assertRecipeIntegrity(recipe: Recipe<TRef>): void {
    for (const { ref, quantity } of recipe.ingredients) {
      if (!this.registry.has(ref)) {
        throw new CompositionError(`Dangling recipe reference: ${String(ref)}`);
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new CompositionError(`Invalid ingredient quantity for ${String(ref)}: ${quantity}`);
      }
    }
  }
}
