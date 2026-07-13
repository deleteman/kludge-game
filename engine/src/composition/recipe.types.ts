/**
 * Receta genérica: qué partes (y en qué cantidad) forman una entidad
 * compuesta. `TRef` es el tipo de identificador de la parte referenciada —
 * cada dominio (física, química) lo instancia con su propio tipo de ID.
 */
export interface RecipeIngredient<TRef> {
  readonly ref: TRef;
  /** Entero positivo, ej. "Motor pequeño x2" (GDD 7.1). */
  readonly quantity: number;
}

export interface Recipe<TRef> {
  readonly ingredients: ReadonlyArray<RecipeIngredient<TRef>>;
}
