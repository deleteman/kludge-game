import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Eventos del dominio de energía (Observer, CLAUDE.md — cada bloque define sus
 * eventos junto a su lógica). Fase 13b, ronda 4 de playtest.
 */

/**
 * El jugador tiene más unidades repartidas que las que la nave puede entregar
 * — típicamente porque perdió una fuente al desmantelarla, no porque la UI se
 * lo permitiera (el slider topa en el presupuesto). `MissionPowerRuntime` ya
 * resolvió el conflicto apagando secciones de menor a mayor asignación; este
 * evento existe para que `/game` lo COMUNIQUE (aviso), no para que lo resuelva.
 */
export interface PowerShortfallEvent extends DomainEventBase {
  readonly kind: "power-shortfall";
  /** Presupuesto realmente disponible (suma de `powerUnits` de las fuentes instaladas). */
  readonly totalUnits: number;
  /** Suma de lo que el jugador tiene repartido, intacta — la reconciliación no es destructiva. */
  readonly requestedUnits: number;
  /** Secciones que se quedaron sin energía por el déficit (no incluye a las que nunca se asignaron). */
  readonly shedSectionIds: ReadonlyArray<SectionId>;
}

export type PowerDomainEvent = PowerShortfallEvent;
