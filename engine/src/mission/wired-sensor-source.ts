import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { configurableSensorKindOf } from "../instance-config/configurable-of.js";
import type { ConfigurableSensorKind } from "../instance-config/sensor-thresholds.js";

/**
 * Registros que hace falta para reconocer un sensor por sus propiedades y leer
 * la contaminación del aire. Se agrupan porque LCD y LED los necesitan juntos.
 */
export interface SensorReadingRegistries {
  readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
}

/** El sensor de sección al que llega el cable de una pieza receptora, con el aire que lee. */
export interface WiredSensorSource {
  readonly sensorKind: ConfigurableSensorKind;
  readonly sectionId: SectionId;
  readonly atmosphere: SectionAtmosphere;
}

/**
 * Sigue el cableado de una pieza receptora (LCD, LED) hasta el sensor de sección
 * que la alimenta y devuelve el aire que ese sensor está leyendo — el canal de
 * lectura directa (no el booleano del `SignalEvaluator`, que sólo sabe ON/OFF).
 *
 * Extraído de `resolveLcdDisplayValue` (Subfase 14b-3) porque el LED necesita
 * exactamente lo mismo para evaluar un umbral sobre el valor real. El sensor se
 * reconoce por sus PROPIEDADES (`configurableSensorKindOf`, registro completo,
 * compuestos incluidos) y no por identidad — principio 1 de CLAUDE.md. Esto
 * arregla de paso que un LCD cableado al `sensor-presion-gas` compuesto no
 * mostraba nada: la versión anterior sólo miraba los átomos del catálogo.
 *
 * `null` si la pieza no está cableada, si su fuente no es un sensor con lectura
 * conocida (un chip, un botón…) o si la sala del sensor no tiene datos.
 */
export function resolveWiredSensorSource(
  blueprint: Blueprint,
  shipFloorplan: ShipFloorplan,
  receptorInstanceId: PlacedComponentInstanceId,
  atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
  componentRegistry: SensorReadingRegistries["componentRegistry"],
): WiredSensorSource | null {
  const receptorNode = blueprint.signalGraph.nodes.find(
    (node) => node.role === "receptor" && node.ownerRef === receptorInstanceId,
  );
  const incomingEdge = receptorNode && blueprint.signalGraph.edges.find((edge) => edge.to === receptorNode.id);
  const sourceNode = incomingEdge && blueprint.signalGraph.nodes.find((node) => node.id === incomingEdge.from);
  const sourceInstance =
    sourceNode && blueprint.placedComponents.find((instance) => instance.instanceId === sourceNode.ownerRef);
  if (!sourceNode || !sourceInstance) return null;

  const sensorKind = configurableSensorKindOf(sourceInstance.componentDefinitionId, componentRegistry);
  if (!sensorKind) return null;
  const section = sectionContainingCell(shipFloorplan, sourceNode.position);
  const atmosphere = section && atmosphereOf(section.id);
  if (!section || !atmosphere) return null;
  return { sensorKind, sectionId: section.id, atmosphere };
}
