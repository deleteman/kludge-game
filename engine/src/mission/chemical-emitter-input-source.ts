import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { sectionTaggedConcentration } from "../atmosphere/tagged-concentration.js";
import { CHEMICAL_SENSOR_TAGS } from "../atmosphere/chemical-sensor-parameters.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { sensorThresholdOf } from "../instance-config/instance-config-store.js";
import { sensorFires } from "../instance-config/sensor-thresholds.js";
import { emitterRangeOf, CHEMICAL_TRIGGER_TYPES } from "./emitter-sensing.js";
import type { EmitterInputSource } from "./mission-signal-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

function isChemicalSensor(
  componentDefinitionId: ComponentId,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): boolean {
  return (
    emitterRangeOf(componentDefinitionId, componentRegistry, CHEMICAL_TRIGGER_TYPES) !== undefined
  );
}

/**
 * Concentración que este sensor "ve" en una sección: la peor entre los tags que
 * detecta. Exportada porque la consume también el tooltip de `/game` — una
 * segunda fórmula para la lectura sería la UI mintiendo sobre el motor
 * (patrón 1), igual que `emitterReaches` es compartida entre el disparo y el
 * dibujo del radio.
 */
export function chemicalSensorReading(
  atmosphere: SectionAtmosphere,
  chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
): number {
  let worst = 0;
  for (const tagName of CHEMICAL_SENSOR_TAGS) {
    worst = Math.max(worst, sectionTaggedConcentration(atmosphere, chemicalRegistry, tagName));
  }
  return worst;
}

/**
 * `EmitterInputSource` que resuelve `triggerType: "spectral"` contra la
 * composición química real del aire de la sección del sensor (Subfase 14b-1).
 * Mismo molde que `temperatureAwareEmitterInputs`/`pressureAwareEmitterInputs`:
 * envoltorio parcial que solo pisa los nodos que sabe resolver y deja el resto
 * de `base()` intacto, y búsqueda contra el REGISTRO completo para cubrir
 * también los sensores compuestos —que es lo que `escaner-espectro` es—.
 *
 * Lo que arregla: el escáner existía en el catálogo desde el arranque, pero
 * como ningún resolvedor conocía su `triggerType` caía en el fail-open de
 * `allEmittersActive` y quedaba **permanentemente disparado**. Cablearlo a un
 * LED encendía el LED para siempre, hubiera o no contaminación. Es el mismo bug
 * que 14a-1 tuvo que arreglar en el sensor térmico.
 *
 * Dispara POR ENCIMA del umbral, como el térmico: lo peligroso es el exceso.
 * Una sección sin dato de atmósfera NO dispara — el mismo criterio conservador
 * de los otros dos sensores de sección: sin lectura no hay alarma.
 *
 * Toma el registro QUÍMICO además del de componentes porque la convención de
 * `atmosphere-composition.types.ts` guarda los contaminantes como ids de
 * sustancia dentro de `gases`, y sin resolverlos no hay forma de saber si lo
 * que hay en el aire es tóxico o es vapor de agua.
 */
export function chemicalAwareEmitterInputs(
  shipState: MutableShipState,
  shipFloorplan: ShipFloorplan,
  atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
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
      if (!instance || !isChemicalSensor(instance.componentDefinitionId, componentRegistry)) {
        continue;
      }
      const section = sectionContainingCell(shipFloorplan, node.position);
      const atmosphere = section && atmosphereOf(section.id);
      // 14b-3: umbral y comparador por instancia; sin tocar es "> 0.05", como siempre.
      const threshold = sensorThresholdOf(blueprint.instanceConfigs, instance.instanceId, "chemical");
      inputs.set(
        node.id,
        sensorFires("chemical", atmosphere && chemicalSensorReading(atmosphere, chemicalRegistry), threshold),
      );
    }
    return inputs;
  };
}
