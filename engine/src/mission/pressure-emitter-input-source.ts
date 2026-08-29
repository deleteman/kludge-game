import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { emitterRangeOf, PRESSURE_TRIGGER_TYPES } from "./emitter-sensing.js";
import type { EmitterInputSource } from "./mission-signal-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Umbral de "fuga activa" para el Sensor de Presión (Subfase 11h, caso 19):
 * cualquier caída bajo la atmósfera estándar (`standardSectionAtmosphere`,
 * 101 kPa) cuenta como disparo — decisión explícita del operador, sin margen
 * de tolerancia. `Especificacion_datos_tecnicos.md` no define un umbral de
 * presión-peligro; si a futuro se agrega uno, reemplazar esta constante.
 */
export const PRESSURE_SENSOR_TRIGGER_KPA = 101;

function isPressureSensor(
  componentDefinitionId: ComponentId,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): boolean {
  return (
    emitterRangeOf(componentDefinitionId, componentRegistry, PRESSURE_TRIGGER_TYPES) !== undefined
  );
}

/**
 * `EmitterInputSource` que resuelve `triggerType: "pressure"` contra la
 * atmósfera real de la sección del sensor (Subfase 11h), en vez de darlo
 * siempre por activo como `allEmittersActive` — este envoltorio solo reemplaza
 * el valor de los nodos que son sensores de presión, el resto de `base()` queda
 * intacto. Resuelve el punto 3 de PENDIENTES_OBSERVACIONES.md de forma acotada
 * a este `triggerType`.
 *
 * Ronda 1 de playtest de 13g: la búsqueda pasa por el REGISTRO completo y no
 * por `ATOMIC_COMPONENT_CATALOG`, así que `sensor-presion-gas` (compuesto) se
 * simula por primera vez — antes caía en el fail-open y quedaba siempre
 * encendido. Ver el límite conocido documentado en `motionAwareEmitterInputs`.
 */
export function pressureAwareEmitterInputs(
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
      if (!instance || !isPressureSensor(instance.componentDefinitionId, componentRegistry)) {
        continue;
      }
      const section = sectionContainingCell(shipFloorplan, node.position);
      const pressureKpa = section && atmosphereOf(section.id)?.pressureKpa;
      inputs.set(node.id, pressureKpa !== undefined && pressureKpa < PRESSURE_SENSOR_TRIGGER_KPA);
    }
    return inputs;
  };
}
