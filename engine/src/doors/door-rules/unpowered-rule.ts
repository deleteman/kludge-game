import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";

/**
 * Sin energía la puerta **se congela donde está** (decisión del operador):
 * sin motor no se mueve, `auto` deja de funcionar y queda en override con
 * motivo "sin energía". Solo `force-door` la abre, lenta y a mano.
 *
 * Es lo que le da a `cut-power` (13d) una consecuencia que hasta ahora no
 * tenía: cortar la energía de una sección para desmontar sin chispas ahora
 * también decide si esa sección queda sellada o abierta de par en par.
 *
 * Gana sobre `signal` a propósito: una puerta sin alimentación no obedece a un
 * cable, y esa asimetría es lo que hace que valga la pena mirar el reparto de
 * energía antes de cablear nada.
 */
export class UnpoweredDoorRule implements DoorGovernanceRule {
  readonly source = "unpowered" as const;

  appliesTo(ctx: DoorGovernanceContext): boolean {
    return !ctx.powered;
  }

  resolve(): DoorGovernanceOutcome {
    // `targetOpen` ausente = congelar. No es lo mismo que "cerrar": una puerta
    // que se quedó sin luz mientras estaba abierta sigue abierta.
    return { mode: "override", overrideSource: "unpowered" };
  }
}
