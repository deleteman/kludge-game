import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { ResourceType } from "../properties/functional.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";

/**
 * Eventos de fallo (Observer, para Fase 8). GDD 5.6: exceder la capacidad de un
 * conductor/reservorio provoca fallo, y la exposición corrosiva prolongada
 * degrada la resistencia estructural hasta el fallo. Cada uno es un fenómeno
 * visual distinto (chispas de cortocircuito, incendio, explosión, metal que se
 * debilita, ruptura) — principio 6.
 */

/** Modo de fallo por sobrecarga, según el tipo de recurso (GDD 5.6). */
export type FailureMode = "cut" | "fire" | "explosion";

export interface OverloadEvent extends DomainEventBase {
  readonly kind: "overload";
  /** Instancia del conductor/reservorio que falló (id genérico). */
  readonly ref: string;
  readonly resourceType: ResourceType;
  readonly failureMode: FailureMode;
  readonly capacity: number;
  readonly load: number;
}

/** La resistencia estructural bajó un nivel (A→M→B) por corrosión. */
export interface StructuralDegradedEvent extends DomainEventBase {
  readonly kind: "structural-degraded";
  readonly ref: string;
  readonly newLevel: StructuralResistanceLevel;
}

/** La estructura falló por completo (por debajo de B). */
export interface StructuralFailureEvent extends DomainEventBase {
  readonly kind: "structural-failure";
  readonly ref: string;
}

export type FailureDomainEvent = OverloadEvent | StructuralDegradedEvent | StructuralFailureEvent;
