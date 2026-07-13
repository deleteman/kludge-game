/**
 * Constructor de catálogo químico compartido — instancia la factory y EntityRegistry,
 * construye elementos primero, luego compuestos (en orden de dependencia).
 * Exporta ambos para inyección en otras partes del motor.
 */

import type { EntityRegistry } from "../../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemical-substance.types.js";
import { MapEntityRegistry } from "../../composition/entity-registry.js";
import { createChemicalSubstanceFactory } from "../chemical-substance-factory.js";
import { ELEMENT_CATALOG } from "./element-catalog.js";
import { COMPOUND_CATALOG } from "./compound-catalog.js";

export function buildChemicalCatalog(): {
  registry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
  factory: ReturnType<typeof createChemicalSubstanceFactory>;
} {
  const registry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();
  const factory = createChemicalSubstanceFactory(registry);

  // Construir elementos primero (no tienen dependencias).
  for (const elementSpec of ELEMENT_CATALOG) {
    const atomic = factory.buildAtomic({
      id: elementSpec.id,
      name: elementSpec.name,
      data: elementSpec.data,
    });
    registry.register(atomic.id, atomic);
  }

  // Construir compuestos (pueden depender de elementos u otros compuestos).
  // Algunos compuestos no tienen receta (elementos reutilizados como compuestos puros,
  // placeholders sin definición aún) — esos deben crearse como atómicos, no compuestos.
  for (const compoundSpec of COMPOUND_CATALOG) {
    if (!compoundSpec.recipe) {
      // Sin receta: crear como atómico (elemento reutilizado como sustancia pura o placeholder).
      const atomic = factory.buildAtomic({
        id: compoundSpec.id,
        name: compoundSpec.name,
        data: compoundSpec.data,
      });
      registry.register(atomic.id, atomic);
    } else {
      // Con receta: crear como compuesto (derivado de elementos/otros compuestos).
      const composite = factory.buildComposite({
        id: compoundSpec.id,
        name: compoundSpec.name,
        data: compoundSpec.data,
        recipe: compoundSpec.recipe,
      });
      registry.register(composite.id, composite);
    }
  }

  return { registry, factory };
}
