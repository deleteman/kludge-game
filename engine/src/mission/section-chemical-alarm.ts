import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { configurableSensorKindOf } from "../instance-config/configurable-of.js";
import { isExcessComparator } from "../instance-config/comparator.js";
import { sensorThresholdOf } from "../instance-config/instance-config-store.js";
import { defaultSensorThreshold, sensorFires } from "../instance-config/sensor-thresholds.js";
import { chemicalSensorReading } from "./chemical-emitter-input-source.js";

/**
 * ¿La sala está en alarma química? (Subfase 14b-3.) Es lo que dicen el tooltip
 * de la sala y el siseo de fuga, y tiene que ser el MISMO criterio que dispara
 * al sensor (patrón 1: la UI no puede tener su propia fórmula).
 *
 * Desde que cada escáner tiene su umbral por instancia, "el umbral" ya no es una
 * constante: la sala está en alarma si ALGÚN escáner instalado en ella dispara,
 * cada uno con el suyo. Una sala sin escáner no tiene quien dispare, pero la
 * contaminación sigue siendo real y el aviso de la sala no debe callarse por no
 * haber instrumentos: en ese caso se aplica el umbral de fábrica. Lo mismo si
 * ninguno de los escáneres de la sala está configurado como alarma de exceso.
 */
export function sectionChemicalAlarm(input: {
  readonly blueprint: Blueprint;
  readonly shipFloorplan: ShipFloorplan;
  readonly sectionId: SectionId;
  readonly atmosphere: SectionAtmosphere;
  readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
}): boolean {
  const { blueprint, shipFloorplan, sectionId, atmosphere, componentRegistry, chemicalRegistry } = input;
  const reading = chemicalSensorReading(atmosphere, chemicalRegistry);

  // Sólo cuentan los escáneres configurados en dirección de EXCESO (`>`, `>=`).
  // Un escáner en `<`, `<=` o `=` es lógica de cableado del jugador ("aire
  // limpio", "justo en tal valor"), no un umbral de fuga: con aire limpio la
  // lectura es 0 y "< 0.05" se cumple, así que contarlo declaraba la sala en
  // alarma —tooltip y siseo incluidos— sin que hubiera ningún gas. Además, con
  // una traza que nunca llega a 0 (principio 5) el siseo sonaría para siempre,
  // el mismo bug que 14b-2 ronda 2 ya había cerrado.
  const alarmScanners = blueprint.placedComponents
    .filter(
      (instance) =>
        configurableSensorKindOf(instance.componentDefinitionId, componentRegistry) === "chemical" &&
        sectionContainingCell(shipFloorplan, instance.placement.position)?.id === sectionId,
    )
    .map((instance) => sensorThresholdOf(blueprint.instanceConfigs, instance.instanceId, "chemical"))
    .filter((threshold) => isExcessComparator(threshold.comparator));
  if (alarmScanners.length === 0) {
    return sensorFires("chemical", reading, defaultSensorThreshold("chemical"));
  }
  return alarmScanners.some((threshold) => sensorFires("chemical", reading, threshold));
}
