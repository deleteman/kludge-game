import type { DomainEventBase } from "../simulation/domain-event.types.js";

/**
 * Nivel de velocidad acumulada de un objeto acelerado magnéticamente
 * (extensión GDD 5.2/5.6, documento §2). "N" = en reposo/sin pulsos aún.
 */
export type VelocityLevel = "N" | "B" | "M" | "A";

/**
 * Un objeto acelerado cambió de nivel de velocidad (Observer, para Fase 8 —
 * documento §4, "estela de partículas"). Se emite solo en transición de
 * nivel, no cada tick, mismo criterio que `signal-latched`/
 * `counter-threshold-reached` (principio 6 CLAUDE.md: eventos discretos, no
 * ruido continuo).
 */
export interface MagneticAccelerationEvent extends DomainEventBase {
  readonly kind: "magnetic-acceleration";
  readonly ref: string;
  readonly velocity: VelocityLevel;
}

/** Severidad del daño por impacto cinético (documento §3). Palabras, no letras — misma convención que `CrewDamageSeverity`/`CombustionIntensity` (evento de dominio, no propiedad de material). */
export type KineticDamageSeverity = "low" | "medium" | "high";

/** Un objeto acelerado colisionó con estructura, un componente o un tripulante (documento §3). */
export interface KineticImpactEvent extends DomainEventBase {
  readonly kind: "kinetic-impact";
  readonly targetRef: string;
  readonly velocity: VelocityLevel;
  readonly severity: KineticDamageSeverity;
}

export type KineticDomainEvent = MagneticAccelerationEvent | KineticImpactEvent;
