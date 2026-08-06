/**
 * Parámetros del manejo de sustancias (Subfase 13e, ronda 1 de fixes de
 * playtest). Data-driven, mismo criterio que `salvage/salvage-parameters.ts` y
 * `chemistry/reaction/reaction-parameters.ts`: son valores de referencia
 * ajustables en el balanceo de la Fase 23, no constantes de diseño cerradas.
 */

/**
 * Unidades que saca UNA tarea de "Extraer elementos".
 *
 * Existe porque al sembrar los reservorios llenos (ronda 1 de fixes) la
 * extracción vaciaba el tanque entero en una sola tarea: un reservorio de agua
 * de capacidad 100 daba 200 hidrógeno + 100 oxígeno de un saque, o sea materia
 * prima infinita desde el primer minuto — justo lo contrario de la escasez que
 * 13e venía a introducir.
 *
 * La decisión (operador, 2026-08-06) fue topear por TAREA en vez de autorar 21
 * cantidades iniciales a mano: vaciar un tanque grande cuesta varias tareas y
 * varios viajes del tripulante, así que la escasez pasa a ser de TIEMPO, que es
 * el recurso real del core loop.
 */
export const EXTRACTION_BATCH_UNITS = 5;
