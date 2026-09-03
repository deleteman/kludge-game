import type { DomainEventBase } from "../../simulation/domain-event.types.js";
import type { SectionId } from "../../atmosphere/section.types.js";
import type { PlacedComponentInstanceId } from "../../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { PhaseTransition } from "./phase-change.types.js";

/**
 * Eventos de dominio del cambio de estado (Subfase 14a-3, principio 6: ninguna
 * regla nueva del motor queda sin su gancho visual).
 *
 * Dos fenómenos distintos y por lo tanto dos eventos distintos —no un evento con
 * un flag—, porque en pantalla no pueden verse igual: una sustancia que hierve
 * en el suelo de una sala es una columna de vapor, y un tanque cuyo contenido se
 * solidifica es escarcha sobre la pieza.
 */

/**
 * Una sustancia SUELTA en una sección cambió de estado al caer: el charco se
 * evaporó, o el gas condensó. Lo emite el camino de derrame/vertido, que es
 * donde se conoce la cantidad.
 */
export interface SubstancePhaseChangeEvent extends DomainEventBase {
  readonly kind: "substance-phase-change";
  readonly sectionId: SectionId;
  readonly substanceId: ChemicalSubstanceId;
  readonly transition: PhaseTransition;
  /** Unidades implicadas: `/game` escala la intensidad del efecto con esto. */
  readonly amount: number;
}

/**
 * El CONTENIDO de un reservorio instalado cambió de estado por la temperatura de
 * su sección. Lleva la instancia además de la sección porque el efecto se pinta
 * sobre la pieza, no sobre la sala, y porque el desgaste que provoca la
 * congelación es de esa instancia concreta.
 */
export interface ReservoirContentPhaseChangeEvent extends DomainEventBase {
  readonly kind: "reservoir-content-phase-change";
  readonly instanceId: PlacedComponentInstanceId;
  readonly sectionId: SectionId;
  readonly substanceId: ChemicalSubstanceId;
  readonly transition: PhaseTransition;
  /** `true` si este cruce dañó el tanque (solo al congelar). */
  readonly damagedContainer: boolean;
  /** El tanque quedó destruido por este cruce (ya estaba en el peor desgaste). */
  readonly destroyedContainer: boolean;
}

export type PhaseDomainEvent = SubstancePhaseChangeEvent | ReservoirContentPhaseChangeEvent;
