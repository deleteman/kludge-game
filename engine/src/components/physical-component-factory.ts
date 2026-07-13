import { CompositionError, CompositionFactory } from "../composition/composition-factory.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type {
  AtomicComponentData,
  ComponentId,
  CompositeComponentData,
  PhysicalComponentDefinition,
} from "./physical-component.types.js";

/**
 * Instancia la CompositionFactory genérica para el dominio físico (GDD
 * 7.1-7.2), con la única regla propia de este dominio en Fase 1: una pieza
 * atómica debe declarar un footprint positivo.
 */
export function createPhysicalComponentFactory(
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): CompositionFactory<ComponentId, AtomicComponentData, CompositeComponentData, ComponentId> {
  return new CompositionFactory<
    ComponentId,
    AtomicComponentData,
    CompositeComponentData,
    ComponentId
  >(registry, {
    validateAtomicData: (data) => {
      if (data.footprint.width <= 0 || data.footprint.height <= 0) {
        throw new CompositionError("Atomic component footprint must be positive");
      }
    },
  });
}
