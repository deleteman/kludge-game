/**
 * Resolución de aparatos de fabricación (Subfase 13e).
 *
 * La mesa de creación dejó de ser un botón global disponible en cualquier
 * momento (Obs 4) y pasó a abrirse desde un aparato colocado en el plano. Este
 * módulo es el único punto que responde "¿qué instancias habilitan qué mesa?",
 * y lo hace leyendo la propiedad funcional `FAB` — nunca comparando contra un
 * `ComponentId` literal, que es exactamente lo que el Principio 1 prohíbe.
 *
 * Puro: no conoce `/game` ni el runtime de misión. Lo consumen el panel de
 * acciones contextual y la escena de la mesa.
 */

import type { Blueprint, PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { FabricatorDomain } from "../properties/functional.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "./physical-component.types.js";

/** Dominio de fabricación que declara una definición de catálogo, si declara alguno. */
export function fabricatorDomainOf(
  definition: PhysicalComponentDefinition | undefined,
): FabricatorDomain | undefined {
  const functional = definition?.data.functional;
  if (!functional) {
    return undefined;
  }
  for (const property of functional) {
    if (property.tag === "FAB") {
      return property.domain;
    }
  }
  return undefined;
}

/**
 * Dominio de fabricación de una INSTANCIA colocada. Una instancia `destroyed`
 * no habilita nada — un banco de trabajo hecho pedazos no fabrica (Principio 5:
 * las consecuencias se sienten). `jammed` sí sigue habilitando: está atascado,
 * no destruido, mismo criterio con que el resto del motor trata ese estado.
 */
export function instanceFabricatorDomain(
  instance: PlacedComponentInstance,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): FabricatorDomain | undefined {
  if (instance.condition === "destroyed") {
    return undefined;
  }
  return fabricatorDomainOf(registry.get(instance.componentDefinitionId));
}

/** Instancias del plano que habilitan la mesa del dominio pedido. */
export function findFabricators(
  blueprint: Blueprint,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  domain: FabricatorDomain,
): ReadonlyArray<PlacedComponentInstanceId> {
  return blueprint.placedComponents
    .filter((instance) => instanceFabricatorDomain(instance, registry) === domain)
    .map((instance) => instance.instanceId);
}

/** ¿La nave conserva al menos un aparato operativo de ese dominio? */
export function hasFabricator(
  blueprint: Blueprint,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  domain: FabricatorDomain,
): boolean {
  return blueprint.placedComponents.some(
    (instance) => instanceFabricatorDomain(instance, registry) === domain,
  );
}
