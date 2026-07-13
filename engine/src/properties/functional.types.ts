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
}

export interface ReservoirProperty {
  readonly tag: "RES";
  readonly resourceType: ResourceType;
  readonly capacity: number;
  readonly dischargeRate: number;
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
