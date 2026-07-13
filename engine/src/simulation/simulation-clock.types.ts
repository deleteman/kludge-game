/**
 * Contexto de un paso de simulación discreto. La Fase 2 decidió (con el
 * operador) modelar el tiempo como un loop de tick: casi todas las reglas del
 * motor son temporales (difusión ~10%/s, corrosión ~15s/nivel, toxicidad
 * >30% durante >5s, osciladores, delay de propagación) y no pueden evaluarse
 * de forma puramente instantánea.
 *
 * Este tipo NO conoce el wall-clock ni el framerate: el driver del bucle
 * (Fase 6 core loop / Fase 8 render) decide el `dtSeconds` de cada paso y va
 * acumulando `elapsedSeconds`. Las reglas del motor son funciones puras de
 * `(estado, TickContext) → nuevo estado + eventos`; el estado mutable de
 * simulación vive en cada subsistema, no aquí.
 */
export interface TickContext {
  /** Tiempo simulado transcurrido en este paso, en segundos. Debe ser > 0. */
  readonly dtSeconds: number;
  /** Tiempo simulado total acumulado desde el inicio de la simulación. */
  readonly elapsedSeconds: number;
}
