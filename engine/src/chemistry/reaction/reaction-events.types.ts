import type { DomainEventBase } from "../../simulation/domain-event.types.js";
import type { SectionId } from "../../atmosphere/section.types.js";

/**
 * Eventos de dominio de las reacciones químicas (Observer, para Fase 8).
 * Principio 6 (CLAUDE.md): cada regla de reacción que produce un fenómeno
 * discreto define aquí su evento; las partículas de Fase 8 se enganchan a él.
 * Las reglas que solo transforman identidad de sustancia (corrosivo+sustancia →
 * gas derivado) no emiten evento propio — su feedback visual es el gas
 * resultante dispersándose en la atmósfera (Bloque 3).
 */

export interface NeutralizationEvent extends DomainEventBase {
  readonly kind: "neutralization";
  /** Calor liberado (Espec. §1): +15°C sobre la temperatura local. */
  readonly heatReleasedCelsius: number;
  /** Duración del pico de calor, en segundos de simulación (Espec. §1). */
  readonly heatDurationSeconds: number;
  /**
   * Dónde ocurrió. Mismo criterio y mismo llenado que en `CombustionEvent`:
   * la regla de neutralización es lógica pura sin noción de mundo, así que
   * solo lo estampan los llamadores con contexto de misión.
   *
   * Sin esto, el calor de la neutralización era un payload que nadie podía
   * aplicar: había +15 °C declarados pero ninguna sección a la que sumárselos
   * (Subfase 14a-1).
   */
  readonly sectionId?: SectionId;
}

/** Intensidad de combustión según el O2 de la sección (GDD 5.5). */
export type CombustionIntensity = "weak" | "standard" | "violent";

/** Radio de propagación de la combustión/explosión según el O2 de la sección (Espec. §1, caso 11). */
export type CombustionRadius = "none" | "half-section" | "full-section";

/** Severidad de daño a tripulante dentro del radio de la explosión (Espec. §1, caso 11). */
export type CrewDamageSeverity = "none" | "medium" | "high";

export interface CombustionEvent extends DomainEventBase {
  readonly kind: "combustion";
  readonly intensity: CombustionIntensity;
  readonly radius: CombustionRadius;
  readonly crewDamage: CrewDamageSeverity;
  /**
   * Dónde ocurrió, para que `/game` sepa qué sección iluminar/alertar (Fase
   * 13a). `CombustionRule.apply` no lo conoce — es lógica de reacción pura,
   * sin noción de mundo — así que solo lo llenan los llamadores de producción
   * con contexto de misión (`MissionReactionRuntime`); la mesa de creación
   * (`synthesizeSubstance`) lo deja `undefined` a propósito.
   */
  readonly sectionId?: SectionId;
}

export interface SpontaneousIgnitionEvent extends DomainEventBase {
  readonly kind: "spontaneous-ignition";
}

export type ReactionDomainEvent = NeutralizationEvent | CombustionEvent | SpontaneousIgnitionEvent;
