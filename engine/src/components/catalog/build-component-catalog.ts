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
import type { CompositeComponentSpec } from "./composite/composite-component-spec.types.js";
import { declaredPowerDraw } from "../../power/power-parameters.js";

/**
 * Inyecta la demanda eléctrica de `power-parameters.ts` en la definición
 * (Subfase 13g). Se hace acá y no en los specs para que los consumos vivan en
 * UNA tabla en vez de repartidos por los seis archivos de catálogo; `data` es
 * el sitio del dato porque `powerDraw` no es un tag del GDD, igual que
 * `footprint`. Las piezas sin entrada en la tabla quedan sin el campo (0).
 */
function withPowerDraw<T extends object>(id: ComponentId, data: T): T {
  const powerDraw = declaredPowerDraw(id);
  return powerDraw > 0 ? { ...data, powerDraw } : data;
}

/**
 * TODOS los specs de compuestos, en un solo array. Exportado porque hay
 * consumidores que necesitan el METADATO de autoría del spec (ej. `contains`,
 * Subfase 13e) y no la definición ya construida — la factory solo copia `data`,
 * así que ese metadato no sobrevive a `buildComposite`.
 */
export const ALL_COMPOSITE_SPECS: ReadonlyArray<CompositeComponentSpec> = [
  ...INVESTIGACION_CATALOG,
  ...GUERRA_CATALOG,
  ...EXPLORACION_CATALOG,
  ...MEDICA_CATALOG,
  ...TALLER_CATALOG,
];

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
      data: withPowerDraw(atomicSpec.id, atomicSpec.data),
    });
    registry.register(atomic.id, atomic);
  }

  // Construir compuestos de todos los arquetipos en ORDEN DE DEPENDENCIA.
  // El catálogo de compuestos es único y compartido entre los 4 arquetipos.
  // Primero: compuestos que solo referencian atómicos.
  // Segundo: compuestos que referencian otros compuestos (ensamblajes complejos como Torreta).

  // Kit base común a los 4 arquetipos (13e) incluido: ver `ALL_COMPOSITE_SPECS`.
  const allCompositeCatalogs = ALL_COMPOSITE_SPECS;

  // Separar composites por si dependen de otros composites.
  const atomicReferences = new Set(ATOMIC_COMPONENT_CATALOG.map((a) => a.id));
  const atomicOnlyComposites: CompositeComponentSpec[] = [];
  const complexAssemblies: CompositeComponentSpec[] = [];

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
      data: withPowerDraw(compositeSpec.id, compositeSpec.data),
      recipe: compositeSpec.recipe,
    });
    registry.register(composite.id, composite);
  }

  // Then build complex assemblies (may reference previously-built composites).
  for (const compositeSpec of complexAssemblies) {
    const composite = factory.buildComposite({
      id: compositeSpec.id,
      name: compositeSpec.name,
      data: withPowerDraw(compositeSpec.id, compositeSpec.data),
      recipe: compositeSpec.recipe,
    });
    registry.register(composite.id, composite);
  }

  return { registry, factory };
}
