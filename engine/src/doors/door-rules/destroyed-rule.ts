import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";

/**
 * Una puerta rota es un hueco permanente: no compartimenta, no bloquea y no
 * responde a nada (principio 5 — ninguna consecuencia es gratis). Gana sobre
 * todo lo demás, incluida la señal: un cable no cierra una puerta que ya no
 * existe.
 *
 * Solo `repair-door` la saca de acá, y lo hace escribiendo el estado
 * directamente en el runtime, no vía gobierno.
 */
export class DestroyedDoorRule implements DoorGovernanceRule {
  readonly source = "jammed-damage" as const;

  appliesTo(ctx: DoorGovernanceContext): boolean {
    return ctx.door.state === "destroyed";
  }

  resolve(): DoorGovernanceOutcome {
    return { forcedState: "destroyed", mode: "override", overrideSource: "jammed-damage" };
  }
}
