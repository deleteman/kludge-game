import { CHEMICAL_SENSOR_TRIGGER_CONCENTRATION } from "../atmosphere/chemical-sensor-parameters.js";
import { THERMAL_SENSOR_TRIGGER_CELSIUS } from "../atmosphere/thermal-parameters.js";
import { PRESSURE_SENSOR_TRIGGER_KPA } from "../atmosphere/pressure-sensor-parameters.js";
import { compareReading } from "./comparator.js";
import type { Comparator, SensorThresholdConfig } from "./instance-config.types.js";

/**
 * Qué sensores de sección tienen umbral configurable y cuál es su valor de
 * fábrica. Los defaults son EXACTAMENTE las constantes que antes eran globales
 * (dirección incluida: presión dispara por debajo, temperatura y química por
 * encima), así que una instancia sin tocar se comporta igual que antes de 14b-3.
 */
export type ConfigurableSensorKind = "pressure" | "thermal" | "chemical";

export interface SensorThresholdSpec {
  readonly defaultComparator: Comparator;
  readonly defaultValue: number;
  /** Rango admitido para el umbral: fuera de él el valor no tiene sentido físico. */
  readonly min: number;
  readonly max: number;
  /** Paso de los botones ± del panel. */
  readonly step: number;
  /** Margen para `=`, `<=` y `>=` (ver `compareReading`). */
  readonly tolerance: number;
}

export const SENSOR_THRESHOLD_SPECS: Readonly<Record<ConfigurableSensorKind, SensorThresholdSpec>> = {
  pressure: { defaultComparator: "<", defaultValue: PRESSURE_SENSOR_TRIGGER_KPA, min: 0, max: 200, step: 1, tolerance: 0.5 },
  thermal: { defaultComparator: ">", defaultValue: THERMAL_SENSOR_TRIGGER_CELSIUS, min: -50, max: 500, step: 5, tolerance: 0.5 },
  chemical: { defaultComparator: ">", defaultValue: CHEMICAL_SENSOR_TRIGGER_CONCENTRATION, min: 0.01, max: 1, step: 0.01, tolerance: 0.005 },
};

export function defaultSensorThreshold(kind: ConfigurableSensorKind): SensorThresholdConfig {
  const spec = SENSOR_THRESHOLD_SPECS[kind];
  return { kind: "sensor-threshold", comparator: spec.defaultComparator, value: spec.defaultValue };
}

/** ¿El umbral es admisible para ese sensor? (valor finito dentro de rango, comparador conocido) */
export function isValidSensorThreshold(kind: ConfigurableSensorKind, config: SensorThresholdConfig): boolean {
  const spec = SENSOR_THRESHOLD_SPECS[kind];
  return Number.isFinite(config.value) && config.value >= spec.min && config.value <= spec.max;
}

/** ¿Dispara el sensor con esta lectura y este umbral? Una lectura ausente nunca dispara (sin dato no hay alarma). */
export function sensorFires(
  kind: ConfigurableSensorKind,
  reading: number | undefined,
  threshold: SensorThresholdConfig,
): boolean {
  return (
    reading !== undefined &&
    compareReading(reading, threshold.comparator, threshold.value, SENSOR_THRESHOLD_SPECS[kind].tolerance)
  );
}
