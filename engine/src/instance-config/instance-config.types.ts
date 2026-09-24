import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

/**
 * Configuración por instancia (Subfase 14b-3, deuda #15). Dos piezas del mismo
 * componente pueden comportarse distinto sin ser componentes distintos: el
 * jugador afina cada una una vez colocada, sin gastar una tarea de tripulante
 * (es ajuste, no reparación — decisión del operador).
 *
 * Es un mapa DISPERSO: sólo las instancias que el jugador tocó tienen entrada;
 * el resto usa el valor por defecto que declara el motor. Mismo formato de
 * array de entradas que `PowerState.instancePriorities`.
 *
 * El chip (`SignalNode.behavior`) no vive acá: ya tiene su propio campo en el
 * grafo. Este archivo cubre lo que NO cabe en un nodo.
 */

/** Comparador de un umbral numérico. */
export type Comparator = "<" | ">" | "<=" | ">=" | "=";

export const COMPARATORS: ReadonlyArray<Comparator> = ["<", ">", "<=", ">=", "="];

/** Umbral y comparador de un sensor de valor continuo (presión, temperatura, química). */
export interface SensorThresholdConfig {
  readonly kind: "sensor-threshold";
  readonly comparator: Comparator;
  readonly value: number;
}

/** Paleta de un indicador LED. Cuatro colores a propósito: cada uno tiene que leerse distinto a simple vista (pilar 6). */
export type LedColor = "amber" | "green" | "red" | "blue";

export const LED_COLORS: ReadonlyArray<LedColor> = ["amber", "green", "red", "blue"];

/**
 * Cuándo se enciende el LED. Qué opciones ofrece depende de LO QUE ESTÉ
 * CABLEADO a él (`ledTriggerKindsFor`):
 *  - `level`: según la señal que le llega — encendido con señal (`high`) o
 *    encendido SIN señal. Vale para cualquier fuente.
 *  - `compare`: compara el valor real del sensor cableado contra un umbral
 *    propio del LED (independiente del umbral del sensor). Sólo con un sensor de
 *    valor continuo (presión, temperatura, contaminación).
 *  - `substance`: se enciende si en el aire de la sala del escáner hay un
 *    contaminante con ese tag. Sólo con un escáner químico.
 */
export type LedTrigger =
  | { readonly kind: "level"; readonly high: boolean }
  | { readonly kind: "compare"; readonly comparator: Comparator; readonly value: number }
  | { readonly kind: "substance"; readonly tag: LedSubstanceTag };

export type LedSubstanceTag = "TOX" | "CORR";

export const LED_SUBSTANCE_TAGS: ReadonlyArray<LedSubstanceTag> = ["TOX", "CORR"];

/** Color y condición de encendido de un indicador de salida (LED). */
export interface OutputIndicatorConfig {
  readonly kind: "output-indicator";
  readonly color: LedColor;
  readonly trigger: LedTrigger;
}

export type InstanceConfig = SensorThresholdConfig | OutputIndicatorConfig;

export interface InstanceConfigEntry {
  readonly instanceId: PlacedComponentInstanceId;
  readonly config: InstanceConfig;
}
