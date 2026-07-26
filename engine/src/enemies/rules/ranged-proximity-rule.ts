import type { CombatEvalContext, CombatRangeRule } from "../combat-rule.js";

/**
 * Ventana de distancia a la que un ataque a distancia puede aplicar (alcance
 * confirmado con el operador: "2 o 3 casillas"). Data-driven y ajustable,
 * mismo criterio que el resto de parámetros de reglas (`WEAPON_DAMAGE_PARAMETERS`,
 * `MAGNETIC_FIELD_PARAMETERS`).
 */
export const RANGED_PROXIMITY_PARAMETERS = { minCells: 2, maxCells: 3 } as const;

/**
 * A distancia: distancia Manhattan entre 2 y 3 celdas, y el arma tiene
 * `EmitterProperty` (`EM`) con `range` suficiente para alcanzar esa distancia
 * — reutiliza `EmitterProperty.range` tal cual (ver `torreta-automatizada`),
 * sin duplicar el concepto de alcance con un campo nuevo.
 */
export const RangedProximityRule: CombatRangeRule = {
  kind: "ranged",
  appliesTo(ctx: CombatEvalContext): boolean {
    if (ctx.actuator === undefined || ctx.emitter === undefined) {
      return false;
    }
    if (ctx.distance < RANGED_PROXIMITY_PARAMETERS.minCells || ctx.distance > RANGED_PROXIMITY_PARAMETERS.maxCells) {
      return false;
    }
    return ctx.emitter.range >= ctx.distance;
  },
};
