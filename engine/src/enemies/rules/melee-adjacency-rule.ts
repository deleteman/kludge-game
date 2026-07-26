import type { CombatEvalContext, CombatRangeRule } from "../combat-rule.js";

/**
 * Cuerpo a cuerpo: distancia Manhattan de exactamente 1 celda, y el arma NO
 * tiene `EmitterProperty` (`EM`) — un arma cuerpo a cuerpo se modela con solo
 * `ACT`, sin alcance de detección/disparo a distancia (ver `garra-de-abordaje`
 * en `components/catalog/composite/guerra.ts`, en contraste con
 * `torreta-automatizada`, que sí tiene `EM`).
 */
export const MeleeAdjacencyRule: CombatRangeRule = {
  kind: "melee",
  appliesTo(ctx: CombatEvalContext): boolean {
    return ctx.distance === 1 && ctx.actuator !== undefined && ctx.emitter === undefined;
  },
};
