import { type ComponentWear, wearSteps } from "./wear.types.js";

/**
 * Fracción de capacidad que pierde un conductor/reservorio por cada escalón de
 * desgaste. Valor de partida a validar en playtest, mismo criterio que el resto
 * de los parámetros de la Espec. §5.
 */
export const CAPACITY_LOSS_PER_WEAR_STEP = 0.15;

/**
 * Capacidad EFECTIVA de un conductor/reservorio degradado (Subfase 13c).
 *
 *   nuevo 100%  ·  usado 85%  ·  degradado 70%  ·  critico 55%
 *
 * Así se cumple "sube la probabilidad de fallo catastrófico" (`nuevo-orden.md`,
 * GDD 6.3) SIN meter dados en el tick de simulación: una pieza degradada se
 * sobrecarga con una carga que la misma pieza nueva aguantaba. `OverloadRule`
 * (`failure/overload-rule.ts`) sigue siendo puramente determinista —
 * `load > capacity` — y el jugador puede razonar su margen en vez de sufrir un
 * fallo impredecible. Decisión cerrada con el operador (2026-08-05); el único
 * azar de 13c vive en el escritor de canibalización, fuera del bucle de
 * simulación.
 */
export function wornCapacity(capacity: number, wear: ComponentWear): number {
  return capacity * (1 - CAPACITY_LOSS_PER_WEAR_STEP * wearSteps(wear));
}
