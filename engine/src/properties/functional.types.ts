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
   * NO hay `powerDraw` acá: la Subfase 13g lo subió a
   * `PhysicalComponentDefinition.data.powerDraw`. Mientras vivió en este tag,
   * una pieza que no es actuador (un chip, un sensor, una mesa `FAB`) no tenía
   * dónde declarar consumo, y el reparto de 13b no podía gatear a nadie más
   * que a los actuadores. `power` —intensidad mecánica de la actuación— se
   * queda: es otra magnitud, no el costo eléctrico.
   */
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

/** Dominio de fabricación que habilita un aparato `FAB` (Subfase 13e). */
export type FabricatorDomain = "fisica" | "quimica";

/**
 * Aparato de fabricación (Subfase 13e, GDD 5.1 extendido). Es una propiedad de
 * HABILITACIÓN, no de trabajo: declara que la pieza permite abrir la mesa de
 * creación en un dominio concreto (`fisica` = ensamblar componentes,
 * `quimica` = sintetizar sustancias). No produce efecto físico por sí misma,
 * por eso no es un `ACT` — misma clase de aclaración semántica que 11h hizo
 * con LED/LCD.
 *
 * Existe como propiedad y no como lista de `ComponentId` para respetar el
 * Principio 1 (emergencia sobre recetas): cualquier pieza que la declare
 * habilita su mesa, sin que el motor conozca ids literales.
 */
export interface FabricatorProperty {
  readonly tag: "FAB";
  readonly domain: FabricatorDomain;
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
  | FabricatorProperty
  | ConductorProperty
  | StructureProperty;

/**
 * Array, no bag único con una entrada por tag: un mismo componente puede
 * tener varios roles funcionales a la vez (ej. GDD 7.3 "Servidor de
 * análisis" = REC+EM; "Sistema de purificación de aire" = ACT+REC).
 */
export type FunctionalProperties = ReadonlyArray<FunctionalProperty>;
