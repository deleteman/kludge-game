import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

/**
 * Evento de dominio del subsistema de señales (Observer, para Fase 8). Se
 * emite cuando un latch cambia de estado — un fenómeno discreto que merece
 * feedback visual propio (un "clic"/enganche de memoria).
 *
 * Nota de principio 6 (CLAUDE.md): la actividad continua de señal (qué
 * conductor lleva señal ahora mismo) NO se modela como evento — sería ruido de
 * alta frecuencia. El "flujo animado en conductos activos" (GDD 10) se resuelve
 * en Fase 8 leyendo directamente `SignalNodeState.output` cada frame, no por
 * suscripción. El latch sí es un evento porque es un cambio de estado puntual.
 */
export interface SignalLatchedEvent extends DomainEventBase {
  readonly kind: "signal-latched";
  readonly nodeId: SignalNodeId;
  /** true = memoria activada (set); false = liberada (reset). */
  readonly engaged: boolean;
}

/**
 * Un contador (GDD 5.6, caso de validación 5) alcanzó su umbral — otro
 * fenómeno discreto puntual, misma justificación que `SignalLatchedEvent`
 * (principio 6): merece su propio feedback visual, no ruido continuo.
 */
export interface CounterThresholdReachedEvent extends DomainEventBase {
  readonly kind: "counter-threshold-reached";
  readonly nodeId: SignalNodeId;
  readonly count: number;
}

export type SignalDomainEvent = SignalLatchedEvent | CounterThresholdReachedEvent;
