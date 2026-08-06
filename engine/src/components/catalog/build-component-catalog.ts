/**
 * Constructor de catálogo de componentes — instancia la factory y EntityRegistry,
 * construye atómicos primero, luego compuestos por arquetipo (en orden de dependencia).
 * Exporta ambos para inyección en otras partes del motor.
 */

import type { EntityRegistry } from "../../composition/entity-registry.js";
import type { PhysicalComponentDefinition, ComponentId } from "../physical-component.types.js";
import { MapEntityRegistry } from "../../composition/entity-registry.js";
import { createPhysicalComponentFactory } from "../physical-component-factory.js";
import { ATOMIC_COMPONENT_CATALOG } from "./atomic-component-catalog.js";
import { INVESTIGACION_CATALOG } from "./composite/investigacion.js";
import { GUERRA_CATALOG } from "./composite/guerra.js";
import { EXPLORACION_CATALOG } from "./composite/exploracion.js";
import { MEDICA_CATALOG } from "./composite/medica.js";
import { TALLER_CATALOG } from "./composite/taller.js";

export function buildComponentCatalog(): {
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  factory: ReturnType<typeof createPhysicalComponentFactory>;
} {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  const factory = createPhysicalComponentFactory(registry);

  // Construir atómicos primero (no tienen dependencias).
  for (const atomicSpec of ATOMIC_COMPONENT_CATALOG) {
    const atomic = factory.buildAtomic({
      id: atomicSpec.id,
      name: atomicSpec.name,
      data: atomicSpec.data,
    });
    registry.register(atomic.id, atomic);
  }

  // Construir compuestos de todos los arquetipos en ORDEN DE DEPENDENCIA.
  // El catálogo de compuestos es único y compartido entre los 4 arquetipos.
  // Primero: compuestos que solo referencian atómicos.
  // Segundo: compuestos que referencian otros compuestos (ensamblajes complejos como Torreta).

  const allCompositeCatalogs = [
    ...INVESTIGACION_CATALOG,
    ...GUERRA_CATALOG,
    ...EXPLORACION_CATALOG,
    ...MEDICA_CATALOG,
    // Kit base común a los 4 arquetipos (13e), no de un arquetipo concreto.
    ...TALLER_CATALOG,
  ];

  // Separar composites por si dependen de otros composites.
  const atomicReferences = new Set(ATOMIC_COMPONENT_CATALOG.map((a) => a.id));
  const atomicOnlyComposites: typeof allCompositeCatalogs = [];
  const complexAssemblies: typeof allCompositeCatalogs = [];

  for (const compositeSpec of allCompositeCatalogs) {
    const referencesOnlyAtomics = compositeSpec.recipe.ingredients.every((ing) =>
      atomicReferences.has(ing.ref),
    );
    if (referencesOnlyAtomics) {
      atomicOnlyComposites.push(compositeSpec);
    } else {
      complexAssemblies.push(compositeSpec);
    }
  }

  // Build atomic-only composites first.
  for (const compositeSpec of atomicOnlyComposites) {
    const composite = factory.buildComposite({
      id: compositeSpec.id,
      name: compositeSpec.name,
      data: compositeSpec.data,
      recipe: compositeSpec.recipe,
    });
    registry.register(composite.id, composite);
  }

  // Then build complex assemblies (may reference previously-built composites).
  for (const compositeSpec of complexAssemblies) {
    const composite = factory.buildComposite({
      id: compositeSpec.id,
      name: compositeSpec.name,
      data: compositeSpec.data,
      recipe: compositeSpec.recipe,
    });
    registry.register(composite.id, composite);
  }

  return { registry, factory };
}
