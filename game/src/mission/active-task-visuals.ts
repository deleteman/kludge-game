import type { CrewTaskId } from "engine";

/**
 * Trabajo VISUAL en curso de una tarea, con forma de cancelarlo (ronda 4b de
 * playtest de 14a-4).
 *
 * **Por qué existe.** `task-started` disparaba los visuales de una tarea —la
 * cadena de saltos de un `go-to`, las partículas de instalar/desmontar— y los
 * soltaba sin guardar nada. No había ninguna referencia con la que volver a
 * ellos, así que cancelar la tarea no podía detenerlos ni en principio: el
 * operador canceló un movimiento y el tripulante siguió caminando hasta el
 * destino, canceló una instalación y las chispas siguieron hasta agotar el
 * tiempo estimado de una tarea que ya no existía.
 *
 * El motor ya hacía su parte (la pieza NO se instalaba). El defecto era
 * enteramente de esta capa, y era el mismo en los dos casos, así que se arregla
 * en un solo sitio: cada visual de tarea registra acá **cómo se apaga**, y el
 * manejador de `task-cancelled`/`task-failed` lo invoca sin saber de qué visual
 * se trata.
 *
 * Vive fuera de la escena y sin tocar Phaser para poder tener test propio: su
 * modo de fallo —un apagador que no se invoca, o que se invoca dos veces sobre
 * un emisor ya destruido— es exactamente el que no se ve revisando código.
 */
export class ActiveTaskVisuals {
  private readonly stoppers = new Map<CrewTaskId, () => void>();

  /**
   * Registra cómo se apaga el visual de esta tarea. Si ya había uno registrado
   * (una tarea que se reintenta tras un bloqueo vuelve a emitir `task-started`),
   * se apaga el anterior antes de reemplazarlo: dejarlo colgado sería otra vez
   * un visual sin dueño, que es el defecto que este registro existe para evitar.
   */
  register(taskId: CrewTaskId, stop: () => void): void {
    this.stoppers.get(taskId)?.();
    this.stoppers.set(taskId, stop);
  }

  /** Apaga el visual de esta tarea, si tenía uno. Idempotente: el apagador corre una sola vez. */
  stop(taskId: CrewTaskId): void {
    const stop = this.stoppers.get(taskId);
    if (!stop) return;
    this.stoppers.delete(taskId);
    stop();
  }

  /**
   * Olvida el visual SIN apagarlo. Es lo que corresponde al completar: la
   * cadena de saltos llegó a destino y las partículas se agotan solas, apagarlas
   * ahí cortaría la última animación justo cuando el jugador mira el resultado.
   */
  forget(taskId: CrewTaskId): void {
    this.stoppers.delete(taskId);
  }
}
