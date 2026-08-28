import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";

/**
 * El DEFAULT, y la regla más importante de la subfase: la puerta se abre para
 * dejar pasar a un actor y se cierra sola el resto del tiempo.
 *
 * De acá sale la propiedad que 13h existe para producir — **la nave está
 * compartimentada por defecto**. Una brecha de 13f deja de desangrar al resto
 * de la nave sin que el jugador haga nada, y en cuanto manda a alguien a la
 * sección rota la puerta se abre y la presión se escapa. Eso es emergente del
 * default, no un script de crisis.
 *
 * Aplica siempre: es la última del registro y la que garantiza que
 * `resolveDoorGovernance` nunca se quede sin respuesta.
 */
export class AutoProximityRule implements DoorGovernanceRule {
  readonly source = "auto" as const;

  appliesTo(): boolean {
    return true;
  }

  resolve(ctx: DoorGovernanceContext): DoorGovernanceOutcome {
    return { targetOpen: ctx.actorNearby, mode: "auto" };
  }
}
