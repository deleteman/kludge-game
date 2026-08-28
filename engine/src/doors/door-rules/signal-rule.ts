import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";

/**
 * La puerta como ACTUADOR gobernado por señal (Subfase 13h).
 *
 * Esta regla es la razón de ser del "panel de compuerta" que el Cap.1 siembra
 * desde la Fase 11 y que hasta ahora era un nodo receptor sin nada que
 * gobernar. `true` = abrir, `false` = cerrar; ambos en override, porque una
 * puerta cableada dejó de ser automática por definición.
 *
 * La puerta no sabe QUIÉN la gobierna: un fotorreceptor, un chip lógico, un
 * sensor de presión o una compuerta AND improvisada valen igual. No hay
 * combinación válida hardcodeada (principio 1) — la puerta solo lee la salida
 * de su nodo receptor.
 *
 * `signalOutput === undefined` (sin cable tendido) es DISTINTO de `false` (cable
 * tendido ordenando cerrar): sin cable la regla no aplica y la puerta sigue en
 * `auto`. Sin esa distinción, instalar una puerta la dejaría cerrada para
 * siempre hasta que alguien la cablee.
 */
export class SignalDoorRule implements DoorGovernanceRule {
  readonly source = "signal" as const;

  appliesTo(ctx: DoorGovernanceContext): boolean {
    return ctx.signalOutput !== undefined;
  }

  resolve(ctx: DoorGovernanceContext): DoorGovernanceOutcome {
    return { targetOpen: ctx.signalOutput === true, mode: "override", overrideSource: "signal" };
  }
}
