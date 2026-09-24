import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { InstanceConfig, InstanceConfigEntry, SensorThresholdConfig } from "./instance-config.types.js";
import { defaultSensorThreshold, type ConfigurableSensorKind } from "./sensor-thresholds.js";

/** Config guardada de una instancia, o `undefined` si nunca se tocó. */
export function instanceConfigOf(
  configs: ReadonlyArray<InstanceConfigEntry>,
  instanceId: PlacedComponentInstanceId,
): InstanceConfig | undefined {
  return configs.find((entry) => entry.instanceId === instanceId)?.config;
}

/** Umbral efectivo de un sensor: el guardado, o el de fábrica de su tipo. */
export function sensorThresholdOf(
  configs: ReadonlyArray<InstanceConfigEntry>,
  instanceId: PlacedComponentInstanceId,
  kind: ConfigurableSensorKind,
): SensorThresholdConfig {
  const stored = instanceConfigOf(configs, instanceId);
  return stored?.kind === "sensor-threshold" ? stored : defaultSensorThreshold(kind);
}

/** Copia del mapa con la config de la instancia fijada (reemplaza la anterior). */
export function withInstanceConfig(
  configs: ReadonlyArray<InstanceConfigEntry>,
  instanceId: PlacedComponentInstanceId,
  config: InstanceConfig,
): ReadonlyArray<InstanceConfigEntry> {
  return [...configs.filter((entry) => entry.instanceId !== instanceId), { instanceId, config }];
}

/** Copia sin la entrada de la instancia (vuelve al valor de fábrica; también al desmontarla). */
export function withoutInstanceConfig(
  configs: ReadonlyArray<InstanceConfigEntry>,
  instanceId: PlacedComponentInstanceId,
): ReadonlyArray<InstanceConfigEntry> {
  return configs.some((entry) => entry.instanceId === instanceId)
    ? configs.filter((entry) => entry.instanceId !== instanceId)
    : configs;
}
