import type { GridPosition } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import { DEFAULT_WEAR, type ComponentWear } from "../wear/wear.types.js";
import { stockCostKey, type StockCostLine } from "../inventory/component-stock-cost.js";
import { occupiedCells } from "../workbench/workbench-state.types.js";
import { TERMINAL_TASK_STATES, type CrewTask, type CrewTaskId } from "./task.types.js";

/**
 * Qué tiene COMPROMETIDO la cola de tareas viva (ronda 4c de playtest de 14a-4).
 *
 * **Por qué existe.** `queueInstall` encola sin reservar nada, así que dos
 * tareas podían pedir la misma celda o la misma última unidad del stock, y
 * nada lo decía hasta que la segunda se ejecutaba. Es la causa raíz de la
 * observación 8 (dos tripulantes instalando la única pieza que hay).
 *
 * **La reserva se DERIVA y nunca se persiste** (decisión del operador, ronda
 * 4b): `toUpdatedSave` no guarda tareas, así que descontar el stock al encolar
 * haría perder material al guardar. La verdad sigue siendo el ledger; esto es
 * una lectura de la cola, recalculada cada vez que se pregunta.
 *
 * Puro y en el motor —no en `/game`— porque su modo de fallo es silencioso: una
 * reserva de más bloquea una instalación legítima y una de menos deja volver el
 * crash, y ninguna de las dos la atrapa un smoke test visual.
 */

/** Lo que estas funciones necesitan de una tarea; el resto de `CrewTask` no les importa. */
export type ReservationTaskSource = Pick<CrewTask, "id" | "state" | "payload">;

/**
 * Una tarea reserva mientras está VIVA: `pending`, `blocked` e `in-progress`.
 *
 * - `in-progress` sí reserva: el efecto todavía no corrió y la pieza sigue
 *   entera en el ledger.
 * - `blocked` también, y a propósito: está viva y puede desbloquearse. Es el
 *   caso que el operador señaló al plantear el diseño ("hay formas de colgar
 *   tareas que nunca se ejecuten"); la salida es cancelarla —que las rondas
 *   4a/4b hicieron descubrible y visible—, no una caducidad automática que
 *   liberaría material a espaldas del jugador.
 * - Los tres estados terminales no reservan, con el mismo predicado que usa la
 *   cola dibujada (`TERMINAL_TASK_STATES`), para que lo que se ve y lo que se
 *   reserva no puedan discrepar.
 */
function isLive(task: ReservationTaskSource): boolean {
  return !TERMINAL_TASK_STATES.has(task.state);
}

/** Clave de celda; misma forma que la de `installation-validation.ts`. */
export function reservedCellKey(cell: GridPosition): string {
  return `${cell.x},${cell.y}`;
}

/**
 * Celdas que una instalación encolada ya tiene pedidas, con la tarea que las
 * pidió (para poder explicar QUIÉN reserva, no solo que está reservada).
 *
 * Solo `install`: es el único tipo de tarea que ocupa espacio en el plano. Un
 * cable no ocupa celdas (atraviesa conductos) y un desmontaje libera, no toma.
 */
export function reservedCells(
  tasks: ReadonlyArray<ReservationTaskSource>,
): ReadonlyMap<string, CrewTaskId> {
  const cells = new Map<string, CrewTaskId>();
  for (const task of tasks) {
    if (!isLive(task) || task.payload?.kind !== "install") continue;
    for (const cell of occupiedCells(task.payload.placement)) {
      const key = reservedCellKey(cell);
      // Primera tarea que la pidió: si dos se solaparan (no debería, la UI lo
      // rechaza), la que manda es la que llegó antes, no la última en el barrido.
      if (!cells.has(key)) cells.set(key, task.id);
    }
  }
  return cells;
}

/**
 * Unidades de stock comprometidas por la cola, agregadas por bucket
 * (`pieza|desgaste`, vía `stockCostKey`).
 *
 * `costOf` es el MISMO `componentStockCost` que cobra el efecto, inyectado para
 * no arrastrar el `ComponentRegistry` hasta acá: la reserva no puede usar otra
 * fórmula que el cobro o el jugador vería reservarse algo distinto de lo que
 * después se le descuenta.
 *
 * Reserva `install` y `connect`: tender un cable consume su conductor igual que
 * instalar consume la pieza, y el doble encolado es igual de alcanzable con dos
 * cables que con dos instalaciones. `disconnect` y `dismantle` ACREDITAN al
 * completarse, y ese crédito no se cuenta como disponible: reservar es
 * conservador a propósito, prometer material que todavía no volvió sería
 * exactamente el bug que esto arregla.
 */
export function reservedStock(
  tasks: ReadonlyArray<ReservationTaskSource>,
  costOf: (
    componentId: ComponentId,
    wear: ComponentWear,
    consumeRecipe: boolean,
  ) => ReadonlyArray<StockCostLine>,
): ReadonlyMap<string, number> {
  const reserved = new Map<string, number>();
  const add = (lines: ReadonlyArray<StockCostLine>): void => {
    for (const line of lines) {
      const key = stockCostKey(line.ref, line.wear);
      reserved.set(key, (reserved.get(key) ?? 0) + line.quantity);
    }
  };
  for (const task of tasks) {
    if (!isLive(task)) continue;
    const payload = task.payload;
    if (payload?.kind === "install") {
      add(costOf(payload.componentDefinitionId, payload.wear ?? DEFAULT_WEAR, payload.consumeRecipe === true));
      continue;
    }
    // Sin `conductorId` la tarea no cobra nada (tests y llamadores viejos, ver
    // `ConnectTaskPayload`), así que tampoco reserva.
    if (payload?.kind === "connect" && payload.conductorId) {
      add(costOf(payload.conductorId, payload.conductorWear ?? DEFAULT_WEAR, payload.consumeRecipe === true));
    }
  }
  return reserved;
}
