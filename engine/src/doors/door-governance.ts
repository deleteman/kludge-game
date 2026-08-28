import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { MagneticFieldIntensity } from "../kinetics/magnetic-field.js";
import type { DoorMode, DoorOverrideSource, DoorRuntime, DoorState } from "./door.types.js";

/**
 * Estado del mundo que las reglas de gobierno leen para decidir qué hace una
 * puerta este tick (Subfase 13h).
 *
 * Todo lo que la puerta necesita saber llega YA RESUELTO por el runtime: la
 * regla no consulta la nave, no conoce el grid ni el grafo de señales, y por
 * eso es testeable en aislamiento. Mismo criterio que `SignalRuleContext`.
 */
export interface DoorGovernanceContext {
  readonly door: DoorRuntime;
  /**
   * Hay al menos un actor (tripulante O enemigo) dentro de
   * `autoOpenRadiusCells` del umbral. La puerta no distingue quién se acerca:
   * un intruso la abre igual que un tripulante, y por eso trabarla es una
   * decisión táctica en vez de un detalle.
   */
  readonly actorNearby: boolean;
  /**
   * Salida del nodo receptor cableado a la puerta. `undefined` = no hay cable
   * tendido, que es distinto de un cable en `false` (que ordena cerrar).
   */
  readonly signalOutput?: boolean;
  /** Override pedido por el jugador vía tarea. `undefined` = sin override vigente. */
  readonly taskOverrideOpen?: boolean;
  /** `false` si la sección no tiene energía otorgada este tick o arrastra la cicatriz de 13b. */
  readonly powered: boolean;
  /** Intensidad de campo magnético en la celda de la puerta. */
  readonly magneticFieldIntensity: MagneticFieldIntensity;
  /** RE efectiva de la hoja, para saber si el campo puede trabarla. */
  readonly resistance: StructuralResistanceLevel;
}

/**
 * Qué quiere la regla que pase. Se expresa como INTENCIÓN, no como estado
 * final: `targetOpen` es la posición deseada y el runtime se encarga de la
 * transición de `ACT.cadence`. Una regla nunca teletransporta la hoja.
 */
export interface DoorGovernanceOutcome {
  /** Posición deseada. `undefined` = congelar donde está (puerta sin motor). */
  readonly targetOpen?: boolean;
  /** Estado forzado que ignora la transición: la hoja no se mueve más. */
  readonly forcedState?: Extract<DoorState, "jammed" | "destroyed">;
  readonly mode: DoorMode;
  readonly overrideSource?: DoorOverrideSource;
}

/**
 * Strategy de gobierno. Añadir un motivo nuevo por el que una puerta deja de
 * obedecer es implementar esta interfaz y registrarla en el orden que
 * corresponda — nunca editar un switch central (CLAUDE.md).
 */
export interface DoorGovernanceRule {
  readonly source: DoorOverrideSource | "auto";
  appliesTo(ctx: DoorGovernanceContext): boolean;
  resolve(ctx: DoorGovernanceContext): DoorGovernanceOutcome;
}

/**
 * Resuelve el gobierno de una puerta recorriendo las reglas EN ORDEN y
 * quedándose con la primera que aplica.
 *
 * La prioridad es la del diseño de la subfase —trabada > sin energía > señal >
 * tarea > auto— y es un dato del array, no una cadena de `if`. Que sea un orden
 * y no un conjunto importa: una puerta trabada por electroimán no debe abrirse
 * porque alguien se acerque, y una puerta sin energía no debe obedecer a una
 * señal que no le llega.
 */
export function resolveDoorGovernance(
  rules: readonly DoorGovernanceRule[],
  ctx: DoorGovernanceContext,
): DoorGovernanceOutcome {
  for (const rule of rules) {
    if (rule.appliesTo(ctx)) {
      return rule.resolve(ctx);
    }
  }
  // El registro por defecto termina en `auto-proximity-rule`, que aplica
  // siempre. Llegar acá significa un registro mal armado, no un estado válido.
  throw new Error(`No door governance rule applied to door ${ctx.door.id}`);
}
