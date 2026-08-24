import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";

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

/**
 * Contra qué chocó el proyectil (Subfase 13f). Existe porque la consecuencia
 * es distinta según el objetivo y no se puede deducir del `targetRef`: contra
 * `wall` daña la vida de la SECCIÓN, contra `crew`/`enemy` daña al ACTOR,
 * contra `component` daña la pieza. Antes de 13f el único choque posible era
 * contra un componente colocado, así que la distinción no hacía falta.
 */
export type KineticTargetKind = "component" | "crew" | "enemy" | "wall";

/** Un objeto acelerado colisionó con estructura, un componente o un tripulante (documento §3). */
export interface KineticImpactEvent extends DomainEventBase {
  readonly kind: "kinetic-impact";
  readonly targetRef: string;
  readonly targetKind: KineticTargetKind;
  /**
   * Celda donde ocurrió el impacto (Subfase 13f, hueco #1 de su relevamiento).
   * `kinetics/` no conoce secciones — emite la celda y quien tenga contexto de
   * mundo resuelve la sección con `sectionContainingCell`.
   *
   * Además arregla un agujero visual preexistente: `kineticEventPosition` en
   * `/game` resolvía la celda buscando el `targetRef` entre los componentes
   * colocados, así que un impacto contra un tripulante, un enemigo o una pared
   * no pintaba NADA.
   */
  readonly position: GridPosition;
  readonly velocity: VelocityLevel;
  readonly severity: KineticDamageSeverity;
}

export type KineticDomainEvent = MagneticAccelerationEvent | KineticImpactEvent;
