import { DOOR_PARAMETERS } from "../door-parameters.js";
import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";

/**
 * Puerta golpeada pero no rota: la hoja se deformó y ya no corre por su riel.
 *
 * Existe para que castigar una puerta tenga un tramo INTERMEDIO entre "intacta"
 * y "hueco permanente". Sin esta regla, la vida de la puerta sería un
 * interruptor: el enemigo golpea sin efecto visible hasta que de golpe la
 * atraviesa. Con ella, una puerta maltratada se queda trabada donde estaba —
 * que puede jugar a favor del jugador (queda cerrada y compartimentando) o en
 * contra (queda abierta y desangrando la sección).
 */
export class DamageJamRule implements DoorGovernanceRule {
  readonly source = "jammed-damage" as const;

  appliesTo(ctx: DoorGovernanceContext): boolean {
    const { door } = ctx;
    if (door.maxHp <= 0) {
      return false;
    }
    return door.hp / door.maxHp <= DOOR_PARAMETERS.damageJamFraction;
  }

  resolve(ctx: DoorGovernanceContext): DoorGovernanceOutcome {
    // Se traba DONDE ESTÁ: si la pillaron abierta, queda abierta.
    const openWhenJammed = ctx.door.state === "open" || ctx.door.state === "opening";
    return {
      ...(openWhenJammed ? { targetOpen: true } : { forcedState: "jammed" as const }),
      mode: "override",
      overrideSource: "jammed-damage",
    };
  }
}
