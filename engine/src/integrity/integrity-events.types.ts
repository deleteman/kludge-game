import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/** Qué fenómeno físico dañó la sección (Subfase 13f, los cuatro escritores). */
export type SectionDamageCause =
  | "kinetic-impact"
  | "combustion"
  | "corrosion"
  | "decompression"
  /** Temperatura fuera del rango de operación, por calor o por frío (Subfase 14a-2). */
  | "thermal";

/**
 * La vida de una sección cruzó a un nivel peor (nominal → warning → critical).
 * Se emite POR FLANCO de nivel y no en cada tick, mismo criterio que
 * `magnetic-acceleration` y `signal-latched`: eventos discretos, no ruido
 * continuo (principio 6 de CLAUDE.md).
 */
export interface SectionDamagedEvent extends DomainEventBase {
  readonly kind: "section-damaged";
  readonly sectionId: SectionId;
  readonly cause: SectionDamageCause;
  /** Fracción de vida restante tras el daño, [0,1]. */
  readonly remainingFraction: number;
}

/**
 * La vida de una sección llegó a 0: brecha al vacío. Se emite UNA sola vez
 * (`SectionIntegrity.breached` no vuelve a `false`, principio 5).
 *
 * `breachCell` es la celda concreta del casco que se abrió: es lo que hace
 * sellable la brecha (instalar una pieza apta ahí), y por eso se resuelve al
 * emitir y no se deja implícita.
 */
export interface SectionBreachedEvent extends DomainEventBase {
  readonly kind: "section-breached";
  readonly sectionId: SectionId;
  readonly breachCell: GridPosition;
  readonly cause: SectionDamageCause;
}

export type IntegrityDomainEvent = SectionDamagedEvent | SectionBreachedEvent;
