import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { instanceConfigOf } from "../instance-config/instance-config-store.js";
import type { LedColor } from "../instance-config/instance-config.types.js";
import { DEFAULT_OUTPUT_INDICATOR, ledTriggerFires } from "../instance-config/led-trigger.js";
import type { ConfigurableSensorKind } from "../instance-config/sensor-thresholds.js";
import { chemicalSensorReading } from "./chemical-emitter-input-source.js";
import { resolveWiredSensorSource, type SensorReadingRegistries } from "./wired-sensor-source.js";

/** Valor numérico real que el sensor cableado está leyendo (el mismo que muestra un LCD). */
export function sensorReadingOf(
  sensorKind: ConfigurableSensorKind,
  atmosphere: SectionAtmosphere,
  chemicalRegistry: SensorReadingRegistries["chemicalRegistry"],
): number {
  switch (sensorKind) {
    case "pressure":
      return atmosphere.pressureKpa;
    case "thermal":
      return atmosphere.temperatureCelsius;
    case "chemical":
      return chemicalSensorReading(atmosphere, chemicalRegistry);
  }
}

export interface LedIndicatorState {
  readonly lit: boolean;
  readonly color: LedColor;
}

/**
 * Estado de un indicador LED (Subfase 14b-3): si está encendido y de qué color.
 *
 * Sigue el cableado hasta el sensor que lo alimenta, igual que el LCD
 * (`resolveWiredSensorSource`), para poder evaluar triggers sobre el valor REAL
 * y no sólo sobre el booleano del grafo. Sin configuración guardada devuelve el
 * comportamiento de siempre: ámbar, encendido cuando le llega señal.
 *
 * `signalActive` lo pasa el llamador (la salida del nodo del LED, que ya incluye
 * los cortes por energía); `powered` se pide aparte porque el trigger
 * "encendido SIN señal" no puede confundir un LED sin energía con uno sin señal
 * — un LED apagado por triaje no se enciende por eso.
 */
export function resolveLedIndicatorState(
  blueprint: Blueprint,
  shipFloorplan: ShipFloorplan,
  ledInstanceId: PlacedComponentInstanceId,
  atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
  registries: SensorReadingRegistries,
  live: { readonly signalActive: boolean; readonly powered: boolean },
): LedIndicatorState {
  const stored = instanceConfigOf(blueprint.instanceConfigs, ledInstanceId);
  const config = stored?.kind === "output-indicator" ? stored : DEFAULT_OUTPUT_INDICATOR;
  if (!live.powered) return { lit: false, color: config.color };

  const source = resolveWiredSensorSource(blueprint, shipFloorplan, ledInstanceId, atmosphereOf, registries.componentRegistry);
  const reading = source
    ? sensorReadingOf(source.sensorKind, source.atmosphere, registries.chemicalRegistry)
    : undefined;
  const lit = ledTriggerFires(
    config.trigger,
    {
      signalActive: live.signalActive,
      source: source && { sensorKind: source.sensorKind, atmosphere: source.atmosphere },
      chemicalRegistry: registries.chemicalRegistry,
    },
    reading,
  );
  return { lit, color: config.color };
}
