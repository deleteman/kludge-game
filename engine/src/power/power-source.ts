import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

/**
 * Presupuesto total de unidades de energía que aporta la nave (Fase 13b):
 * suma de `powerUnits` de toda instancia instalada cuya definición declare
 * una `ReservoirProperty` de `resourceType: "E"`. "Conectada" en este MVP
 * significa simplemente "instalada" — no hay simulación de cableado físico
 * de energía distinta del grafo de señal ya existente (mismo criterio de
 * simplificación que el resto del dominio de misión, ej.
 * `mission-overload-runtime.ts`).
 */
export function totalPowerBudget(
  placedComponents: ReadonlyArray<PlacedComponentInstance>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  // Subfase 13d (fix de playtest ronda 1): una fuente que el jugador descargó
  // para poder canibalizarla sin chispazo deja de aportar. Opcional para no
  // romper a los llamadores previos a 13d.
  dischargedSourceIds: ReadonlyArray<PlacedComponentInstanceId> = [],
): number {
  const discharged = new Set(dischargedSourceIds);
  let total = 0;
  for (const instance of placedComponents) {
    if (discharged.has(instance.instanceId)) {
      continue;
    }
    const definition = componentRegistry.get(instance.componentDefinitionId);
    const functional = definition?.data.functional;
    const source = functional?.find((property) => property.tag === "RES" && property.resourceType === "E");
    if (source && source.tag === "RES") {
      total += source.powerUnits ?? 0;
    }
  }
  return total;
}
