/**
 * Resolución de "¿esta instancia es un reservorio y de cuánta capacidad?"
 * (Subfase 13e), por propiedad funcional `RES` — nunca por `ComponentId`.
 *
 * Filtra por `resourceType`: el presupuesto de energía de 13b usa `RES` con
 * `resourceType: "E"` para las baterías/paneles, y esos NO son reservorios de
 * sustancia. Un tanque de gas/líquido sí.
 */

import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ReservoirProperty, ResourceType } from "../properties/functional.types.js";

/** Tipos de recurso que pueden contener una sustancia química (excluye el eléctrico). */
const SUBSTANCE_RESOURCE_TYPES: ReadonlySet<ResourceType> = new Set<ResourceType>(["G", "L", "T"]);

/** La propiedad `RES` de sustancia de una definición, si la tiene. */
export function substanceReservoirProperty(
  definition: PhysicalComponentDefinition | undefined,
): ReservoirProperty | undefined {
  const functional = definition?.data.functional;
  if (!functional) {
    return undefined;
  }
  for (const property of functional) {
    if (property.tag === "RES" && SUBSTANCE_RESOURCE_TYPES.has(property.resourceType)) {
      return property;
    }
  }
  return undefined;
}

/**
 * Capacidad de sustancia de una instancia colocada, o `undefined` si no es un
 * reservorio de sustancia. Una instancia `destroyed` no retiene nada — su
 * contenido se considera perdido, coherente con el derrame de 13d.
 */
export function instanceReservoirCapacity(
  instance: PlacedComponentInstance,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): number | undefined {
  if (instance.condition === "destroyed") {
    return undefined;
  }
  return substanceReservoirProperty(registry.get(instance.componentDefinitionId))?.capacity;
}

export function isSubstanceReservoir(
  instance: PlacedComponentInstance,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): boolean {
  return instanceReservoirCapacity(instance, registry) !== undefined;
}
