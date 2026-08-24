import type { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { fractionToLevel } from "../ship-status/ship-status-aggregation.js";
import type { IntegrityDomainEvent, SectionDamageCause } from "./integrity-events.types.js";
import { integrityFraction, type SectionIntegrity } from "./section-integrity.types.js";

export interface ApplySectionDamageInput {
  readonly sectionId: SectionId;
  readonly integrity: SectionIntegrity;
  readonly amount: number;
  readonly cause: SectionDamageCause;
  /** Celda del casco que se abre si este daño colapsa la sección. */
  readonly breachCell: GridPosition;
  /**
   * Piso de vida que este daño no puede cruzar por sí solo, en HP absolutos.
   * Lo usa la descompresión para no realimentarse (ver
   * `SECTION_INTEGRITY_PARAMETERS.decompression.floorFraction`). Sin piso, 0.
   */
  readonly floorHp?: number;
  readonly tick: TickContext;
  readonly emitter?: EventEmitter<IntegrityDomainEvent>;
}

/**
 * Aplica daño a la vida de una sección (Subfase 13f) y emite lo que
 * corresponda. Función pura sobre el estado mutable de la sección, mismo
 * criterio que el resto del dominio de atmósfera — no una clase con estado
 * propio, porque el estado ya vive en `SectionIntegrity` y se serializa.
 *
 * Emite `section-damaged` solo cuando la fracción CRUZA a un nivel peor del
 * corte de 3 niveles del HUD (`fractionToLevel`), no en cada tick: así el
 * evento coincide exactamente con el momento en que el jugador ve cambiar de
 * color el indicador (la UI y el motor cuentan la misma historia), y la
 * corrosión no dispara un evento por frame.
 *
 * Al llegar a 0 emite `section-breached` UNA vez. La vida no se recupera nunca
 * (principio 5 de CLAUDE.md): sellar la brecha detiene la fuga, no repara el
 * casco.
 */
export function applySectionDamage(input: ApplySectionDamageInput): ReadonlyArray<IntegrityDomainEvent> {
  const { sectionId, integrity, amount, cause, breachCell, tick, emitter } = input;
  if (amount <= 0 || integrity.hp <= 0) {
    return [];
  }

  const floorHp = Math.max(0, input.floorHp ?? 0);
  // Un daño amortiguado sobre una sección que ya está por debajo de su piso no
  // la empuja más abajo, pero tampoco la sube: solo no hace nada.
  if (integrity.hp <= floorHp) {
    return [];
  }

  const levelBefore = fractionToLevel(integrityFraction(integrity));
  integrity.hp = Math.max(floorHp, integrity.hp - amount);
  const fractionAfter = integrityFraction(integrity);

  const events: IntegrityDomainEvent[] = [];

  if (integrity.hp <= 0 && !integrity.breached) {
    integrity.breached = true;
    events.push({
      kind: "section-breached",
      sectionId,
      breachCell,
      cause,
      elapsedSeconds: tick.elapsedSeconds,
    });
  } else if (fractionToLevel(fractionAfter) !== levelBefore) {
    events.push({
      kind: "section-damaged",
      sectionId,
      cause,
      remainingFraction: fractionAfter,
      elapsedSeconds: tick.elapsedSeconds,
    });
  }

  for (const event of events) {
    emitter?.emit(event);
  }
  return events;
}
