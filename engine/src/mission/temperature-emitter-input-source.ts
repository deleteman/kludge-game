import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { THERMAL_SENSOR_TRIGGER_CELSIUS } from "../atmosphere/thermal-parameters.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { emitterRangeOf, THERMAL_TRIGGER_TYPES } from "./emitter-sensing.js";
import type { EmitterInputSource } from "./mission-signal-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

function isThermalSensor(
  componentDefinitionId: ComponentId,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): boolean {
  return (
    emitterRangeOf(componentDefinitionId, componentRegistry, THERMAL_TRIGGER_TYPES) !== undefined
  );
}

/**
 * `EmitterInputSource` que resuelve `triggerType: "thermal"` contra la
 * temperatura real de la sección del sensor (Subfase 14a-1). Mismo molde que
 * `pressureAwareEmitterInputs`: envoltorio parcial que solo pisa los nodos que
 * sabe resolver y deja el resto de `base()` intacto, y búsqueda contra el
 * REGISTRO completo para cubrir también los sensores compuestos.
 *
 * Lo que arregla: `sensor-termico-precision` existía en el catálogo desde el
 * arranque, pero como ningún resolvedor conocía su `triggerType` caía en el
 * fail-open de `allEmittersActive` y quedaba **permanentemente disparado**.
 * Cablearlo a un LED encendía el LED para siempre, hubiera o no un incendio.
 *
 * Dispara POR ENCIMA del umbral, al revés que el de presión (que dispara por
 * debajo de la atmósfera estándar): lo peligroso acá es el exceso, no la
 * falta. Una sección sin dato de atmósfera NO dispara — el mismo criterio
 * conservador del sensor de presión: sin lectura no hay alarma.
 */
export function temperatureAwareEmitterInputs(
  shipState: MutableShipState,
  shipFloorplan: ShipFloorplan,
  atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  base: EmitterInputSource,
): EmitterInputSource {
  return () => {
    const inputs = new Map<SignalNodeId, boolean>(base());
    const blueprint = shipState.get();
    const instanceById = new Map(
      blueprint.placedComponents.map((instance) => [instance.instanceId, instance]),
    );
    for (const node of blueprint.signalGraph.nodes) {
      if (node.role !== "emitter") {
        continue;
      }
      const instance = instanceById.get(node.ownerRef as PlacedComponentInstanceId);
      if (!instance || !isThermalSensor(instance.componentDefinitionId, componentRegistry)) {
        continue;
      }
      const section = sectionContainingCell(shipFloorplan, node.position);
      const temperatureCelsius = section && atmosphereOf(section.id)?.temperatureCelsius;
      inputs.set(
        node.id,
        temperatureCelsius !== undefined && temperatureCelsius > THERMAL_SENSOR_TRIGGER_CELSIUS,
      );
    }
    return inputs;
  };
}
