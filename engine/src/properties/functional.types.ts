/**
 * Propiedades funcionales (GDD 5.1). Determinan qué "hace" un componente en
 * el grafo de sistemas. Las etiquetas (`tag`) corresponden exactamente a la
 * leyenda de GDD 7.0 para trazabilidad al documento de diseño.
 */

/** Tipo de recurso transportado/almacenado: eléctrico/gas/líquido/térmico (GDD 7.0). */
export type ResourceType = "E" | "G" | "L" | "T";

export interface EmitterProperty {
  readonly tag: "EM";
  readonly range: number;
  readonly triggerType: string;
  readonly frequency: number;
}

export interface ReceptorProperty {
  readonly tag: "REC";
  readonly threshold: number;
  readonly responseDelayMs: number;
}

export interface ActuatorProperty {
  readonly tag: "ACT";
  readonly power: number;
  readonly cadence: number;
  readonly directional: boolean;
  /**
   * Costo eléctrico en unidades de presupuesto de energía (Fase 13b,
   * `engine/src/power/`), distinto de `power` (intensidad mecánica de la
   * actuación) — ambos coexisten. Ausente o `0` = no consume del presupuesto,
   * siempre alimentado (retrocompatible con todo el catálogo anterior a 13b).
   */
  readonly powerDraw?: number;
}

/**
 * Sub-categoría conceptual "actuador de salida de información" (Subfase 11h,
 * docs/Extension_indicador_led_pantalla_lcd.md §3): piezas como el Indicador
 * LED o la Pantalla LCD no encajan en `ActuatorProperty` — no convierten
 * energía en trabajo físico, solo visualizan el estado de otro nodo. No se
 * modelan como `ACT`: se etiquetan `REC` (reciben la señal que muestran), sin
 * agregar un tag nuevo al esquema.
 */

export interface ReservoirProperty {
  readonly tag: "RES";
  readonly resourceType: ResourceType;
  readonly capacity: number;
  readonly dischargeRate: number;
  /**
   * Unidades discretas de presupuesto que aporta esta fuente al sistema de
   * energía (Fase 13b, `engine/src/power/`), solo relevante cuando
   * `resourceType === "E"` — distinto de `capacity` (reservorio físico).
   * Ausente = no aporta al presupuesto (ej. reservorios de G/L/T).
   */
  readonly powerUnits?: number;
}

export interface ConductorProperty {
  readonly tag: "COND";
  readonly resourceType: ResourceType;
  readonly maxCapacity: number;
}

export interface StructureProperty {
  readonly tag: "EST";
  readonly damageResistance: number;
  readonly articulatedRange?: number;
}

export type FunctionalProperty =
  | EmitterProperty
  | ReceptorProperty
  | ActuatorProperty
  | ReservoirProperty
  | ConductorProperty
  | StructureProperty;

/**
 * Array, no bag único con una entrada por tag: un mismo componente puede
 * tener varios roles funcionales a la vez (ej. GDD 7.3 "Servidor de
 * análisis" = REC+EM; "Sistema de purificación de aire" = ACT+REC).
 */
export type FunctionalProperties = ReadonlyArray<FunctionalProperty>;
