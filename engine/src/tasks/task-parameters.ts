import type { TaskType } from "./task.types.js";

/**
 * Duración base por tipo de tarea, en segundos simulados. Data-driven, mismo
 * criterio que `REACTION_PARAMETERS` / `THERMAL_CONDUCTIVITY_PARAMETERS`: son
 * valores de referencia ajustables en playtesting, NO constantes de diseño
 * cerradas — el GDD §4.2 solo exige que las tareas tengan "una duración
 * estimada, no instantánea", sin dar una tabla numérica.
 *
 * PENDIENTE FASE 9: estos son los valores base SIN modular. El tier y la
 * afinidad de especialidad (GDD 6.6: ×0.9/×0.75/×0.6 para desmontaje del
 * Ingeniero, +20% fuera de afinidad, etc.) multiplicarán esta base cuando el
 * modelo de tripulante exista. El scheduler acepta un override de duración al
 * encolar, de modo que Fase 9 pueda inyectar la duración ya modulada sin tocar
 * esta tabla.
 */
export const TASK_BASE_DURATION_SECONDS: Record<TaskType, number> = {
  "go-to": 4,
  dismantle: 12,
  transport: 6,
  combine: 10,
  install: 8,
  connect: 5,
  // Subfase 14a-4: retirar un cable quemado es más rápido que tenderlo — no hay
  // que rutear nada, solo arrancar lo que quedó. No es gratis igual: la pieza se
  // perdió, y el tiempo es lo de menos.
  disconnect: 3,
  "analyze-substance": 10,
  // Subfase 13d: baratas a propósito. El coste de asegurar no debe ser el
  // tiempo en sí, sino tener que PREVERLO en pausa — si costara tanto como el
  // desmontaje, el jugador preferiría siempre comerse el chispazo.
  "cut-power": 5,
  "purge-reservoir": 6,
  "discharge-source": 8,
  // Subfase 13e: manipular fluidos es más lento que abrir una válvula de
  // purga — hay que medir, trasvasar sin derramar. La extracción es la más
  // cara de las tres: es trabajo de laboratorio, no de fontanería.
  "transfer-substance": 10,
  "apply-substance": 8,
  "extract-elements": 14,
  // Subfase 13h. Operar una válvula es fontanería barata: lo caro es llegar
  // hasta ella mientras la sala se vacía. Forzar y reparar son lo contrario —
  // trabajo pesado sobre una hoja blindada; la duración real de `force-door`
  // además escala con la fuerza del motor que hay que vencer
  // (`MissionDoorRuntime.forceDurationSeconds`), esta es solo su base.
  "set-valve": 6,
  "force-door": 10,
  "repair-door": 20,
};

/** Duración base de un tipo de tarea (segundos). Punto único de lectura de la tabla. */
export function baseDurationFor(type: TaskType): number {
  return TASK_BASE_DURATION_SECONDS[type];
}
