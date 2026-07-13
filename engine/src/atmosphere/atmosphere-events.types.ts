import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { SectionId } from "./section.types.js";

/**
 * Eventos de umbral de atmósfera (Observer, para Fase 8). Decisión de Fase 2:
 * el motor emite el cruce de umbral y NO modela tripulantes — la reacción del
 * tripulante (caer incapacitado, morir) la resuelve Fase 9 al suscribirse a
 * estos eventos. Cubre los efectos por tiempo de exposición de GDD 5.3 que no
 * son transformación de sustancia: incapacitación tóxica (caso 10) y daño
 * corrosivo directo a tripulante.
 */
export type HazardSeverity = "incapacitation" | "lethal";

export interface HazardEvent extends DomainEventBase {
  readonly kind: "toxic-threshold" | "corrosive-exposure";
  readonly sectionId: SectionId;
  readonly severity: HazardSeverity;
  /** Concentración que cruzó el umbral, para contexto visual/diagnóstico. */
  readonly concentration: number;
}

export type AtmosphereDomainEvent = HazardEvent;
