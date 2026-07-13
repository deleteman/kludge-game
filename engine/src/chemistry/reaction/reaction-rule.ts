import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ReactantSubstance, ReactionContext } from "./reaction-context.types.js";
import type { ReactionDomainEvent } from "./reaction-events.types.js";

/**
 * Identificadores de las reglas de reacción de GDD 5.3, en el vocabulario del
 * orden de prioridad de la Especificación de datos técnicos §2. La lista
 * ordenada vive en `reaction-priority.ts`.
 */
export type ReactionRuleId =
  | "neutralization"
  | "combustion"
  | "corrosive-substance"
  | "toxic-incapacitation"
  | "structural-degradation"
  | "crew-damage"
  | "spontaneous-ignition";

/**
 * Resultado de aplicar una regla de reacción:
 *  - `product`: la sustancia resultante que reemplaza a los reactivos
 *    consumidos (reglas que transforman identidad: neutralización, combustión,
 *    corrosivo+sustancia). Ausente en reglas que solo producen un efecto.
 *  - `consumedReactantIds`: qué reactivos se consumen (los que la regla de
 *    mayor prioridad "consume", Espec. §2). El resolver re-evalúa el resto
 *    junto al producto, no los reactivos originales.
 *  - `events`: efectos de dominio a emitir (calor, combustión, etc.).
 */
export interface ReactionResult {
  readonly product?: ReactantSubstance;
  readonly consumedReactantIds: ReadonlyArray<ChemicalSubstanceId>;
  readonly events: ReadonlyArray<ReactionDomainEvent>;
}

/**
 * Strategy de una regla de reacción química (CLAUDE.md: patrón Strategy para
 * las reglas de 5.3 — "¿aplica a este estado? → aplicar"). Reglas nuevas se
 * añaden implementando esta interfaz y registrándolas en la lista de prioridad,
 * nunca editando un switch central.
 */
export interface ReactionRule {
  readonly id: ReactionRuleId;
  appliesTo(ctx: ReactionContext): boolean;
  apply(ctx: ReactionContext): ReactionResult;
}
