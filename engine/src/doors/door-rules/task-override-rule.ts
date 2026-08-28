import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";

/**
 * El jugador mandó a alguien a dejar la puerta abierta o cerrada a mano.
 *
 * Va DEBAJO de la señal a propósito: si el jugador se tomó el trabajo de
 * cablear un sensor a la puerta, esa automatización manda sobre una orden
 * manual vieja. Para recuperar el control hay que cortar el cable, que es una
 * acción explícita y visible en el plano.
 */
export class TaskOverrideDoorRule implements DoorGovernanceRule {
  readonly source = "task" as const;

  appliesTo(ctx: DoorGovernanceContext): boolean {
    return ctx.taskOverrideOpen !== undefined;
  }

  resolve(ctx: DoorGovernanceContext): DoorGovernanceOutcome {
    return { targetOpen: ctx.taskOverrideOpen === true, mode: "override", overrideSource: "task" };
  }
}
