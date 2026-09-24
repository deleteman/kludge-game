import type { SignalBehavior } from "engine";

/**
 * Opciones de configuración de un nodo de señal en el panel (Subfase 14b-3).
 * Lógica pura, aparte del widget, para poder testearla sin Phaser: qué opciones
 * ofrece el panel, cuál está activa y cómo se pasa de una a otra.
 *
 * `passthrough` y `gate OR` son el mismo circuito (OR de las entradas); el panel
 * los muestra como una sola opción, "OR", para no ofrecer dos botones que hacen
 * lo mismo.
 */
export type NodeBehaviorOption = "AND" | "OR" | "NOT" | "latch" | "delay" | "oscillator" | "counter";

export const NODE_BEHAVIOR_OPTIONS: ReadonlyArray<NodeBehaviorOption> = [
  "AND",
  "OR",
  "NOT",
  "latch",
  "delay",
  "oscillator",
  "counter",
];

/** Parámetro numérico editable de un behavior, con su paso y mínimo. */
export interface BehaviorParameter {
  readonly step: number;
  readonly min: number;
  readonly value: number;
  readonly unit: "seconds" | "count";
}

const DEFAULT_DELAY_SECONDS = 1;
const DEFAULT_PERIOD_SECONDS = 2;
const DEFAULT_COUNTER_THRESHOLD = 3;

export function optionOf(behavior: SignalBehavior | undefined): NodeBehaviorOption {
  if (!behavior || behavior.kind === "passthrough") return "OR";
  if (behavior.kind === "gate") return behavior.mode;
  return behavior.kind;
}

/** Behavior por defecto al elegir una opción (los parámetros arrancan en un valor jugable). */
export function behaviorForOption(option: NodeBehaviorOption): SignalBehavior {
  switch (option) {
    case "AND":
    case "OR":
    case "NOT":
      return { kind: "gate", mode: option };
    case "latch":
      return { kind: "latch" };
    case "delay":
      return { kind: "delay", delaySeconds: DEFAULT_DELAY_SECONDS };
    case "oscillator":
      return { kind: "oscillator", periodSeconds: DEFAULT_PERIOD_SECONDS };
    case "counter":
      return { kind: "counter", threshold: DEFAULT_COUNTER_THRESHOLD };
  }
}

/** El parámetro editable del behavior, o `undefined` si no tiene. */
export function parameterOf(behavior: SignalBehavior | undefined): BehaviorParameter | undefined {
  switch (behavior?.kind) {
    case "delay":
      return { step: 0.5, min: 0.5, value: behavior.delaySeconds, unit: "seconds" };
    case "oscillator":
      return { step: 0.5, min: 0.5, value: behavior.periodSeconds, unit: "seconds" };
    case "counter":
      return { step: 1, min: 1, value: behavior.threshold, unit: "count" };
    default:
      return undefined;
  }
}

/** Behavior con su parámetro movido un paso (−1/+1), sin bajar del mínimo. */
export function stepBehaviorParameter(behavior: SignalBehavior, direction: -1 | 1): SignalBehavior {
  const parameter = parameterOf(behavior);
  if (!parameter) return behavior;
  // Redondeo a 2 decimales: sumar 0.5 repetidamente no debe acumular ruido de coma flotante.
  const next = Math.round(Math.max(parameter.min, parameter.value + direction * parameter.step) * 100) / 100;
  switch (behavior.kind) {
    case "delay":
      return { kind: "delay", delaySeconds: next };
    case "oscillator":
      return { kind: "oscillator", periodSeconds: next };
    case "counter":
      return { kind: "counter", threshold: next };
    default:
      return behavior;
  }
}
