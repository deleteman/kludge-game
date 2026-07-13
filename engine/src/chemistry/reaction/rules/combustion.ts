import type { ChemicalSubstanceId } from "../../chemical-substance.types.js";
import type { CombustionAtmosphere, ReactionContext } from "../reaction-context.types.js";
import type { ReactionResult, ReactionRule } from "../reaction-rule.js";
import { hasTag, anyReactantWithTag } from "../tag-predicates.js";
import {
  COMBUSTION_CREW_DAMAGE_BY_OXYGEN,
  COMBUSTION_INTENSITY_BY_OXYGEN,
  COMBUSTION_RADIUS_BY_OXYGEN,
} from "../reaction-parameters.js";

const COMBUSTION_RESIDUE_ID = "reaction:combustion-residue" as ChemicalSubstanceId;

/**
 * Oxidante + combustible + fuente de ignición → combustión, MODULADA por la
 * concentración de O2 de la sección (GDD 5.3 + 5.5). Resultado con nombre
 * genérico fijo "Residuo de combustión" (inerte).
 *
 * El oxidante puede ser una sustancia con tag OXI (ej. propelente) o el propio
 * O2 atmosférico de la sección. Por eso la combustión es imposible solo cuando
 * NO hay oxidante en sustancia Y el O2 de la sección es `none` (vacío) —
 * exactamente la fila "0%" de la tabla de GDD 5.5.
 */
export class CombustionRule implements ReactionRule {
  readonly id = "combustion" as const;

  private hasCombustible(ctx: ReactionContext): boolean {
    return ctx.reactants.some((r) => hasTag(r, "COMB") || hasTag(r, "VOLAT"));
  }

  /** O2 efectivo: un oxidante en sustancia equivale a atmósfera enriquecida. */
  private effectiveOxygen(ctx: ReactionContext): CombustionAtmosphere {
    if (anyReactantWithTag(ctx.reactants, "OXI")) {
      return "high";
    }
    return ctx.oxygen;
  }

  appliesTo(ctx: ReactionContext): boolean {
    if (!ctx.ignitionPresent || !this.hasCombustible(ctx)) {
      return false;
    }
    return this.effectiveOxygen(ctx) !== "none";
  }

  apply(ctx: ReactionContext): ReactionResult {
    const oxygen = this.effectiveOxygen(ctx) as Exclude<CombustionAtmosphere, "none">;
    const consumed = ctx.reactants.filter(
      (r) => hasTag(r, "COMB") || hasTag(r, "VOLAT") || hasTag(r, "OXI"),
    );
    return {
      product: {
        id: COMBUSTION_RESIDUE_ID,
        name: "Residuo de combustión",
        tags: [{ name: "INERTE" }],
        state: "G",
      },
      consumedReactantIds: consumed.map((r) => r.id),
      events: [
        {
          kind: "combustion",
          intensity: COMBUSTION_INTENSITY_BY_OXYGEN[oxygen],
          radius: COMBUSTION_RADIUS_BY_OXYGEN[oxygen],
          crewDamage: COMBUSTION_CREW_DAMAGE_BY_OXYGEN[oxygen],
          elapsedSeconds: ctx.elapsedSeconds,
        },
      ],
    };
  }
}
