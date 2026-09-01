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
import { declaredSignalOutputCapacity } from "../../signals/signal-output-parameters.js";
import type { FunctionalProperties } from "../../properties/functional.types.js";

/**
 * Inyecta en la definición los datos que viven en tablas de parámetros y no en
 * los specs de catálogo: la demanda eléctrica de `power-parameters.ts` (13g) y
 * la capacidad de salida de señal de `signal-output-parameters.ts` (14a-4,
 * ronda 2). Se hace acá para que cada número viva en UNA tabla en vez de
 * repartido por los seis archivos de catálogo; `data` es el sitio porque
 * ninguno de los dos es un tag del GDD, igual que `footprint`.
 *
 * Las piezas sin entrada en la tabla de consumo quedan sin el campo (0). La
 * capacidad de salida, en cambio, se inyecta a toda pieza que PUEDA alimentar a
 * otra —`EM`, `REC` o `ACT`— incluso cuando toma el default, porque ahí el campo
 * ausente significaría "no alimenta a nadie", no "alimenta gratis": una salida
 * sin límite es justo el estado que esta ronda viene a cerrar.
 *
 * `REC` entra en la lista y no es un descuido: desde que `orientSignalWiring`
 * acepta receptor→receptor (misma ronda), un `chip-circuito-generico` —que solo
 * declara `REC`— es el relé del sistema, y un relé sin presupuesto propio sería
 * capacidad infinita gratis.
 */
const SIGNAL_SOURCE_TAGS = new Set(["EM", "REC", "ACT"]);

function withParameterData<T extends { readonly functional?: FunctionalProperties }>(
  id: ComponentId,
  data: T,
): T {
  const powerDraw = declaredPowerDraw(id);
  const drivesOthers = data.functional?.some((property) => SIGNAL_SOURCE_TAGS.has(property.tag)) ?? false;
  return {
    ...data,
    ...(powerDraw > 0 ? { powerDraw } : {}),
    ...(drivesOthers ? { signalOutputCapacity: declaredSignalOutputCapacity(id) } : {}),
  };
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
      data: withParameterData(atomicSpec.id, atomicSpec.data),
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
      data: withParameterData(compositeSpec.id, compositeSpec.data),
      recipe: compositeSpec.recipe,
    });
    registry.register(composite.id, composite);
  }

  // Then build complex assemblies (may reference previously-built composites).
  for (const compositeSpec of complexAssemblies) {
    const composite = factory.buildComposite({
      id: compositeSpec.id,
      name: compositeSpec.name,
      data: withParameterData(compositeSpec.id, compositeSpec.data),
      recipe: compositeSpec.recipe,
    });
    registry.register(composite.id, composite);
  }

  return { registry, factory };
}
