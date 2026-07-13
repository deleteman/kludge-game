import type { DomainEventBase } from "../../simulation/domain-event.types.js";

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
}

/** Intensidad de combustión según el O2 de la sección (GDD 5.5). */
export type CombustionIntensity = "weak" | "standard" | "violent";

export interface CombustionEvent extends DomainEventBase {
  readonly kind: "combustion";
  readonly intensity: CombustionIntensity;
}

export interface SpontaneousIgnitionEvent extends DomainEventBase {
  readonly kind: "spontaneous-ignition";
}

export type ReactionDomainEvent = NeutralizationEvent | CombustionEvent | SpontaneousIgnitionEvent;
