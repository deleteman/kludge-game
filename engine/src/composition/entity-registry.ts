/**
 * Registro de entidades por id, usado por `CompositionFactory` para resolver
 * referencias de receta. Interfaz separada de la implementación para que
 * los dominios puedan sustituirla (ej. un registro respaldado por el
 * catálogo de contenido de Fase 4) sin tocar la factory.
 */
export interface EntityRegistry<TId, TEntity> {
  get(id: TId): TEntity | undefined;
  has(id: TId): boolean;
  all(): ReadonlyArray<TEntity>;
}

export class MapEntityRegistry<TId, TEntity> implements EntityRegistry<TId, TEntity> {
  private readonly entries = new Map<TId, TEntity>();

  register(id: TId, entity: TEntity): void {
    this.entries.set(id, entity);
  }

  get(id: TId): TEntity | undefined {
    return this.entries.get(id);
  }

  has(id: TId): boolean {
    return this.entries.has(id);
  }

  all(): ReadonlyArray<TEntity> {
    return [...this.entries.values()];
  }
}
