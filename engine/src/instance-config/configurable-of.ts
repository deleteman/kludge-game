import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import {
  CHEMICAL_TRIGGER_TYPES,
  PRESSURE_TRIGGER_TYPES,
  THERMAL_TRIGGER_TYPES,
  emitterRangeOf,
} from "../mission/emitter-sensing.js";
import type { ConfigurableSensorKind } from "./sensor-thresholds.js";

/**
 * Indicador LED. La pieza de salida configurable se reconoce por su ID y no por
 * sus propiedades, y es una EXCEPCIÓN consciente al principio 1: el LED y la
 * pantalla LCD tienen exactamente las mismas propiedades (un `REC` con el mismo
 * umbral), así que ninguna propiedad los distingue — lo que los separa es qué
 * DIBUJAN, y eso es de `/game`. `/game` ya los distinguía por id
 * (`mission-overlay-renderer.ts`); ahora la constante vive acá y `/game` la
 * importa. Registrado en PENDIENTES_OBSERVACIONES.md.
 */
export const LED_INDICATOR_COMPONENT_ID = "indicador-led" as ComponentId;

/** ¿La pieza es un indicador con color y condición de encendido configurables? */
export function isConfigurableIndicator(componentDefinitionId: ComponentId): boolean {
  return componentDefinitionId === LED_INDICATOR_COMPONENT_ID;
}

const SENSOR_TRIGGER_TYPES: ReadonlyArray<readonly [ConfigurableSensorKind, ReadonlySet<string>]> = [
  ["pressure", PRESSURE_TRIGGER_TYPES],
  ["thermal", THERMAL_TRIGGER_TYPES],
  ["chemical", CHEMICAL_TRIGGER_TYPES],
];

/**
 * Qué se puede configurar en una pieza, derivado de sus PROPIEDADES y no de su
 * id (principio 1): cualquier pieza —de catálogo, compuesta o una creación de la
 * mesa— con un `EM` cuyo `triggerType` simula el motor gana su umbral sin tocar
 * nada más. `emitterRangeOf` busca contra el registro completo, así que cubre
 * los compuestos; se compara contra `undefined` y no por truthiness porque el
 * `EM` del sensor de presión tiene `range: 0`.
 */
export function configurableSensorKindOf(
  componentDefinitionId: ComponentId,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): ConfigurableSensorKind | undefined {
  for (const [kind, triggerTypes] of SENSOR_TRIGGER_TYPES) {
    if (emitterRangeOf(componentDefinitionId, registry, triggerTypes) !== undefined) return kind;
  }
  return undefined;
}
