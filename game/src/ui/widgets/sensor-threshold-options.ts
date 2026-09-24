import { COMPARATORS, SENSOR_THRESHOLD_SPECS, defaultSensorThreshold } from "engine";
import type { Comparator, ConfigurableSensorKind, SensorThresholdConfig } from "engine";

/**
 * Lógica pura del bloque "umbral del sensor" del panel (Subfase 14b-3), aparte
 * del widget para poder testearla sin Phaser. Los rangos y pasos salen del
 * motor (`SENSOR_THRESHOLD_SPECS`): el panel no inventa límites propios.
 */

export const SENSOR_COMPARATOR_OPTIONS: ReadonlyArray<Comparator> = COMPARATORS;

/** Config movida un paso, dentro del rango del sensor y sin ruido de coma flotante. */
export function stepSensorThreshold(
  kind: ConfigurableSensorKind,
  config: SensorThresholdConfig,
  direction: -1 | 1,
): SensorThresholdConfig {
  const spec = SENSOR_THRESHOLD_SPECS[kind];
  const moved = Math.min(spec.max, Math.max(spec.min, config.value + direction * spec.step));
  return { ...config, value: Math.round(moved * 1000) / 1000 };
}

/** ¿Los botones ± pueden mover el valor en esa dirección? */
export function canStepSensorThreshold(
  kind: ConfigurableSensorKind,
  config: SensorThresholdConfig,
  direction: -1 | 1,
): boolean {
  const spec = SENSOR_THRESHOLD_SPECS[kind];
  return direction === -1 ? config.value > spec.min : config.value < spec.max;
}

/** ¿Ya está en el valor de fábrica? (el botón "Restaurar" no tiene nada que hacer). */
export function isDefaultSensorThreshold(kind: ConfigurableSensorKind, config: SensorThresholdConfig): boolean {
  const fallback = defaultSensorThreshold(kind);
  return config.comparator === fallback.comparator && config.value === fallback.value;
}
