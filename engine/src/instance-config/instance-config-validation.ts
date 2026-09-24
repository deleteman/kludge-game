import { COMPARATORS, LED_COLORS, LED_SUBSTANCE_TAGS } from "./instance-config.types.js";
import type { Comparator, LedColor, LedSubstanceTag, OutputIndicatorConfig } from "./instance-config.types.js";
import { SENSOR_THRESHOLD_SPECS, type ConfigurableSensorKind } from "./sensor-thresholds.js";

/**
 * Forma de un `OutputIndicatorConfig` que llega de FUERA (un guardado, la UI).
 * Sólo estructura: ¿los enums existen y los números son finitos? El rango del
 * umbral depende del sensor cableado, que el guardado no sabe — eso lo valida
 * `isValidOutputIndicator`.
 */
export function isOutputIndicatorShape(value: unknown): value is OutputIndicatorConfig {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "output-indicator" || !LED_COLORS.includes(candidate.color as LedColor)) return false;
  const trigger = candidate.trigger as Record<string, unknown> | null | undefined;
  if (typeof trigger !== "object" || trigger === null) return false;
  switch (trigger.kind) {
    case "level":
      return typeof trigger.high === "boolean";
    case "compare":
      return (
        COMPARATORS.includes(trigger.comparator as Comparator) &&
        typeof trigger.value === "number" &&
        Number.isFinite(trigger.value)
      );
    case "substance":
      return LED_SUBSTANCE_TAGS.includes(trigger.tag as LedSubstanceTag);
    default:
      return false;
  }
}

/**
 * Además de la forma, ¿es coherente con lo que hay cableado? `compare` necesita
 * un sensor de valor continuo y un umbral dentro de SU rango; `substance`, un
 * escáner químico. Sin sensor cableado sólo vale `level`.
 */
export function isValidOutputIndicator(
  config: OutputIndicatorConfig,
  sensorKind: ConfigurableSensorKind | undefined,
): boolean {
  if (!isOutputIndicatorShape(config)) return false;
  switch (config.trigger.kind) {
    case "level":
      return true;
    case "compare": {
      if (sensorKind === undefined) return false;
      const spec = SENSOR_THRESHOLD_SPECS[sensorKind];
      return config.trigger.value >= spec.min && config.trigger.value <= spec.max;
    }
    case "substance":
      return sensorKind === "chemical";
  }
}
