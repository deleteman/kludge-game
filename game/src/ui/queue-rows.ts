import { TERMINAL_TASK_STATES } from "engine";
import type { BlockingReason, CrewTask, CrewTaskId } from "engine";

import type { UnifiedQueueTask } from "./widgets/crew-queue-panel.js";

/**
 * Orden y anidado de la cola de tareas (ronda 4a de playtest de 14a-4).
 *
 * **Por qué existe.** Desde esta ronda una acción con sitio DEPENDE del `go-to`
 * que la precede, así que cancelar el movimiento bloquea la acción para
 * siempre. Esa consecuencia era invisible: la cola era una lista plana en la
 * que nada indicaba que una fila esperaba a otra, y el operador canceló
 * movimientos creyendo que no arrastraban nada.
 *
 * **Pura y con test propio**, aunque viva en `/game`: su modo de fallo es
 * silencioso — un orden equivocado dibuja un árbol que MIENTE sobre qué espera
 * a qué, y eso no lo atrapa ningún smoke test visual. Además el widget de la
 * cola tiene por contrato explícito "solo dibuja" (ver `crew-queue-panel.ts`),
 * así que la decisión de en qué orden van las filas no le corresponde.
 */

/** Lo que esta función necesita de una tarea; el resto de `CrewTask` no le importa. */
export type QueueRowSource = Pick<CrewTask, "id" | "dependsOn" | "state">;

export interface QueueRowInput<T extends QueueRowSource> {
  readonly task: T;
  /** Fila ya construida por el llamador, sin `depth` ni `blockReason`. */
  readonly row: Omit<UnifiedQueueTask, "depth" | "blockReason">;
}

/**
 * Devuelve las filas en orden de dibujo: cada dependiente **inmediatamente
 * debajo de su dependencia**, con `depth: 1`.
 *
 * Reglas y por qué:
 * - Una tarea en estado TERMINAL (completada, cancelada o fallida) **no se
 *   dibuja**. La cola es la lista de lo que va a pasar, no un historial: el
 *   operador canceló una tarea, la vio quedarse en su fila con la barra en
 *   cero y concluyó que borrar no hacía nada (ronda 4b de playtest). El filtro
 *   corre ANTES de resolver los padres, así que un dependiente cuya
 *   dependencia se acaba de cancelar pasa a raíz y muestra su propio motivo de
 *   bloqueo en vez de colgar de una fila fantasma.
 * - Se respeta el orden de encolado para las raíces. La cola es cronológica y
 *   reordenarla por otro criterio rompería la lectura de "qué pasa primero".
 * - Una tarea cuya dependencia **no está en la lista** (ya se completó y se
 *   filtró, o pertenece a otro actor) se dibuja como RAÍZ. Sangrarla bajo nada
 *   la dejaría flotando sin conector, que es peor que no anidarla.
 * - Se anida por la PRIMERA dependencia presente. Hoy `ensureAt` produce como
 *   mucho una, y un árbol de varios padres no se puede dibujar como lista.
 * - `seen` protege de dibujar dos veces una tarea alcanzable por dos caminos;
 *   el grafo ya no admite ciclos (`linkDependency` los rechaza), pero esta
 *   función no tiene por qué confiar en eso para no colgarse.
 */
export function buildQueueRows<T extends QueueRowSource>(
  allEntries: ReadonlyArray<QueueRowInput<T>>,
  blockReasonOf: (taskId: CrewTaskId) => BlockingReason | undefined,
): ReadonlyArray<UnifiedQueueTask> {
  const entries = allEntries.filter((entry) => !TERMINAL_TASK_STATES.has(entry.task.state));
  const present = new Set(entries.map((entry) => entry.task.id));
  const childrenByParent = new Map<CrewTaskId, QueueRowInput<T>[]>();
  const roots: QueueRowInput<T>[] = [];

  for (const entry of entries) {
    const parent = entry.task.dependsOn.find((id) => present.has(id));
    if (parent === undefined) {
      roots.push(entry);
      continue;
    }
    const bucket = childrenByParent.get(parent);
    if (bucket) bucket.push(entry);
    else childrenByParent.set(parent, [entry]);
  }

  const rows: UnifiedQueueTask[] = [];
  const seen = new Set<CrewTaskId>();
  const push = (entry: QueueRowInput<T>, depth: number): void => {
    if (seen.has(entry.task.id)) return;
    seen.add(entry.task.id);
    const reason = entry.task.state === "blocked" ? blockReasonOf(entry.task.id) : undefined;
    rows.push({ ...entry.row, depth, ...(reason ? { blockReason: reason } : {}) });
    for (const child of childrenByParent.get(entry.task.id) ?? []) {
      push(child, depth + 1);
    }
  };
  for (const root of roots) push(root, 0);
  return rows;
}
