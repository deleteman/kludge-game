import { sectionTaggedConcentration } from "../atmosphere/tagged-concentration.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import { compareReading } from "./comparator.js";
import type { LedTrigger, OutputIndicatorConfig } from "./instance-config.types.js";
import { SENSOR_THRESHOLD_SPECS, defaultSensorThreshold, type ConfigurableSensorKind } from "./sensor-thresholds.js";

/** Configuración de fábrica de un LED: ámbar, encendido con señal — el comportamiento previo a 14b-3. */
export const DEFAULT_OUTPUT_INDICATOR: OutputIndicatorConfig = {
  kind: "output-indicator",
  color: "amber",
  trigger: { kind: "level", high: true },
};

/** Lo que el LED ve del mundo para decidir si se enciende. */
export interface LedTriggerContext {
  /** Salida booleana del nodo del LED (ya incluye el corte por falta de energía). */
  readonly signalActive: boolean;
  /** El sensor de sección cableado al LED y el aire que lee, o `null` si su fuente no es un sensor. */
  readonly source: {
    readonly sensorKind: ConfigurableSensorKind;
    readonly atmosphere: SectionAtmosphere;
  } | null;
  readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
}

/**
 * Una estrategia por tipo de trigger (Strategy, CLAUDE.md): un trigger nuevo se
 * añade implementando su entrada, no editando un `switch` central. Sin fuente
 * sensora, los triggers que necesitan una lectura NO se encienden — sin dato no
 * hay alarma, el mismo criterio de los sensores.
 */
const TRIGGER_EVALUATORS: {
  readonly [K in LedTrigger["kind"]]: (
    trigger: Extract<LedTrigger, { kind: K }>,
    context: LedTriggerContext,
    reading: number | undefined,
  ) => boolean;
} = {
  level: (trigger, context) => context.signalActive === trigger.high,
  compare: (trigger, context, reading) =>
    context.source !== null &&
    reading !== undefined &&
    compareReading(reading, trigger.comparator, trigger.value, SENSOR_THRESHOLD_SPECS[context.source.sensorKind].tolerance),
  substance: (trigger, context) =>
    context.source?.sensorKind === "chemical" &&
    sectionTaggedConcentration(context.source.atmosphere, context.chemicalRegistry, trigger.tag) >
      defaultSensorThreshold("chemical").value,
};

export function ledTriggerFires(
  trigger: LedTrigger,
  context: LedTriggerContext,
  reading: number | undefined,
): boolean {
  const evaluate = TRIGGER_EVALUATORS[trigger.kind] as (
    trigger: LedTrigger,
    context: LedTriggerContext,
    reading: number | undefined,
  ) => boolean;
  return evaluate(trigger, context, reading);
}

/**
 * Tipos de trigger que ofrece un LED según lo que tiene cableado. `level` siempre
 * está (todo se puede leer como señal); `compare` requiere un sensor de valor
 * continuo; `substance` sólo un escáner químico.
 */
export function ledTriggerKindsFor(sensorKind: ConfigurableSensorKind | undefined): ReadonlyArray<LedTrigger["kind"]> {
  if (sensorKind === undefined) return ["level"];
  return sensorKind === "chemical" ? ["level", "compare", "substance"] : ["level", "compare"];
}

/** Trigger por defecto al elegir un tipo, con un valor inicial jugable para el sensor cableado. */
export function defaultLedTrigger(kind: LedTrigger["kind"], sensorKind: ConfigurableSensorKind | undefined): LedTrigger {
  switch (kind) {
    case "level":
      return { kind: "level", high: true };
    case "substance":
      return { kind: "substance", tag: "TOX" };
    case "compare": {
      const fallback = defaultSensorThreshold(sensorKind ?? "thermal");
      return { kind: "compare", comparator: fallback.comparator, value: fallback.value };
    }
  }
}
