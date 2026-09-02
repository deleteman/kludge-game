import type Phaser from "phaser";
import type { BlockingReason, CrewTaskId, TaskState } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import {
  CREW_TOKEN_COLORS,
  CRISIS_FATAL_COLOR,
  CRISIS_FATAL_CSS,
  CRISIS_WARNING_COLOR,
  CRISIS_WARNING_CSS,
  LABEL_COLOR,
  SELECTED_CELL_COLOR,
} from "../../render/palette.js";

/** Una tarea aplanada de la cola UNIFICADA (todos los tripulantes en una sola lista). */
export interface UnifiedQueueTask {
  readonly taskId: CrewTaskId;
  readonly actorIndex: number;
  readonly actorName: string;
  readonly label: string;
  readonly state: TaskState;
  readonly estimatedDurationSeconds: number;
  readonly elapsedSeconds: number;
  readonly selected: boolean;
  /**
   * Nivel de anidado (ronda 4a de playtest de 14a-4): 0 = tarea raíz, 1 = tarea
   * que DEPENDE de la de arriba. Lo calcula `ui/queue-rows.ts`; el widget solo
   * lo dibuja, como el resto de su contrato.
   *
   * Existe porque cancelar un movimiento bloquea la acción que lo seguía, y sin
   * ver la relación esa cancelación parecía inocua.
   */
  readonly depth: number;
  /** Por qué está bloqueada, si lo está. `undefined` en cualquier otro estado. */
  readonly blockReason?: BlockingReason;
}

export interface QueueCancelHit {
  /** Coords de CONTENIDO (y local dentro de `rowsContainer`, antes del scroll). */
  readonly yTop: number;
  readonly yBottom: number;
  /** Coords de PANTALLA (la cola no scrollea horizontal). */
  readonly xMin: number;
  readonly xMax: number;
  /** Extremos de la FILA entera (14a-4 ronda 4a): el click derecho cancela desde cualquier punto. */
  readonly rowXMin: number;
  readonly rowXMax: number;
  readonly taskId: CrewTaskId;
}

export interface CrewQueueHandle {
  readonly container: Phaser.GameObjects.Container;
  /** Sub-container con las filas; la escena lo desplaza en `y` para scrollear. */
  readonly rowsContainer: Phaser.GameObjects.Container;
  readonly mask: Phaser.Display.Masks.GeometryMask;
  readonly cancelHitAreas: ReadonlyArray<QueueCancelHit>;
  readonly contentHeight: number;
  readonly contentTop: number;
  readonly viewHeight: number;
}

const ROW_HEIGHT = 26;
const ROW_GAP = 4;
const PADDING = 8;
const CHIP_SIZE = 10;
/**
 * Ronda 4a de playtest de 14a-4: de 22 a 34 px. El operador no sabía que se
 * podían cancelar tareas — la "×" existía en cada fila desde siempre, pero era
 * un blanco chico que además no daba NINGUNA señal al clickearse. Una acción
 * sin confirmación es indistinguible de una que no existe.
 */
const CANCEL_HIT_WIDTH = 34;
/** Sangría por nivel de anidado (una tarea que depende de la de arriba). */
const DEPTH_INDENT_PX = 14;
/** Ancho reservado para el sufijo de tiempo ("99.9s" en el peor caso, a 10px). */
const TIME_WIDTH = 34;

/** Sufijo de tiempo: cuenta regresiva si está en curso, duración estimada si no. */
function taskTimeSuffix(task: UnifiedQueueTask): string {
  if (task.state === "in-progress") {
    const remaining = Math.max(0, task.estimatedDurationSeconds - task.elapsedSeconds);
    return `${remaining.toFixed(1)}s`;
  }
  // Redondear: la duración modulada es un producto de floats (ej. 12 × 0.6 =
  // 7.199999999999999) y se mostraba cruda con toda la basura decimal (obs de
  // playtest). Es una estimación ("~"), así que el entero alcanza.
  return `~${Math.round(task.estimatedDurationSeconds)}s`;
}

/**
 * Cola UNIFICADA de tareas (playtest #16b): una sola lista con TODAS las tareas
 * de todos los tripulantes, en orden de encolado, cada fila con un chip del
 * color del tripulante dueño + nombre + tarea + cuenta regresiva + "×".
 *
 * INPUT DETERMINISTA: el widget SOLO dibuja (objetos planos de Phaser) y expone
 * `cancelHitAreas`; el cancelar y el scroll los resuelve la escena con
 * hit-testing a nivel de puntero (mismo mecanismo que el click de mapa). Sin
 * rexUI ni `setInteractive` por fila — reconstruir la lista es seguro porque el
 * input no vive en las filas. El recorte al alto de la caja es una máscara de
 * geometría sobre `rowsContainer`; la escena scrollea moviendo su `y`.
 *
 * `(x, y)` = esquina superior-izquierda de la caja.
 */
export function renderCrewQueue(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  tasks: ReadonlyArray<UnifiedQueueTask>,
  emptyQueueLabel: string,
  /** Texto del motivo de bloqueo (14a-4 ronda 4a). El widget no traduce: recibe la función. */
  blockReasonLabel?: (reason: BlockingReason) => string,
): CrewQueueHandle {
  const container = scene.add.container(0, 0);

  // Caja de fondo (no enmascarada).
  container.add(
    scene.add.rectangle(x, y, width, height, 0x0a0a0f, 0.72).setOrigin(0, 0).setStrokeStyle(1, 0x2a3040, 1),
  );

  const contentLeft = x + PADDING;
  const contentTop = y + PADDING;
  const contentWidth = width - PADDING * 2;
  const viewHeight = height - PADDING * 2;

  const rowsContainer = scene.add.container(contentLeft, contentTop);
  container.add(rowsContainer);

  const cancelHitAreas: QueueCancelHit[] = [];

  if (tasks.length === 0) {
    rowsContainer.add(
      scene.add
        .text(0, 4, emptyQueueLabel, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "11px",
          color: LABEL_COLOR,
        })
        .setOrigin(0, 0),
    );
  }

  let rowY = 0;
  for (const task of tasks) {
    const color = CREW_TOKEN_COLORS[task.actorIndex % CREW_TOKEN_COLORS.length]!;
    // Ronda 4a de 14a-4: sangría por nivel de anidado. `depth > 0` = esta tarea
    // DEPENDE de la de arriba, así que cancelar aquella la bloquea — la
    // consecuencia que antes era invisible y que el operador descubrió a la
    // mala.
    const indent = task.depth * DEPTH_INDENT_PX;
    const rowWidth = contentWidth - indent;

    const bg = scene.add
      .rectangle(indent, rowY, rowWidth, ROW_HEIGHT, color, task.selected ? 0.28 : 0.14)
      .setOrigin(0, 0);
    if (task.selected) bg.setStrokeStyle(1, SELECTED_CELL_COLOR, 0.8);
    rowsContainer.add(bg);

    // Conector con la fila de la que depende: sin él la sangría se lee como una
    // decoración, no como una relación.
    if (task.depth > 0) {
      rowsContainer.add(
        scene.add
          .text(indent - DEPTH_INDENT_PX + 3, rowY + ROW_HEIGHT / 2, "└", {
            fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
            fontSize: "11px",
            color: LABEL_COLOR,
          })
          .setOrigin(0, 0.5),
      );
    }

    // Bloqueada: borde ámbar del contrato 12e (escalable, no fatal — se resuelve
    // cancelándola) y su MOTIVO en el propio texto de la fila. Sin esto una
    // tarea bloqueada para siempre se veía igual que una esperando su turno,
    // que es lo que la hacía imposible de encontrar.
    if (task.state === "blocked") {
      bg.setStrokeStyle(1, CRISIS_WARNING_COLOR, 0.9);
    }

    // Chip del color del tripulante (liga con el dot del mapa y el retrato).
    rowsContainer.add(
      scene.add
        .rectangle(indent + 6, rowY + ROW_HEIGHT / 2, CHIP_SIZE, CHIP_SIZE, color, 1)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x0a0a0f, 1),
    );

    // Nombre + label en su propio `Text` con wordWrap/maxLines:1 (playtest de
    // Fase 11e: antes el sufijo de tiempo iba concatenado en esta MISMA cadena
    // y un label largo — sobre todo "analyze-substance" — lo empujaba a la
    // línea 2, que `maxLines:1` descarta en silencio; el tiempo desaparecía
    // sin avisar). Ahora el tiempo vive en un `Text` propio, anclado a la
    // derecha, así un nombre/label largo trunca ACÁ (visible, "…" implícito
    // por el corte de línea) sin volverse a comer el tiempo.
    // Con motivo de bloqueo, el motivo REEMPLAZA al nombre del tripulante: es lo
    // accionable, y la fila no da para las dos cosas sin volver a comerse el
    // tiempo (el bug de Fase 11e que este `Text` ya arrastra documentado).
    const blockedLabel = task.blockReason ? blockReasonLabel?.(task.blockReason) : undefined;
    rowsContainer.add(
      scene.add
        .text(
          indent + 18,
          rowY + ROW_HEIGHT / 2,
          blockedLabel ? `${task.label} · ${blockedLabel}` : `${task.actorName} · ${task.label}`,
          {
            fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
            fontSize: "10px",
            color: blockedLabel ? CRISIS_WARNING_CSS : LABEL_COLOR,
            wordWrap: { width: rowWidth - 18 - TIME_WIDTH - CANCEL_HIT_WIDTH },
            maxLines: 1,
          },
        )
        .setOrigin(0, 0.5),
    );

    rowsContainer.add(
      scene.add
        .text(contentWidth - CANCEL_HIT_WIDTH - 4, rowY + ROW_HEIGHT / 2, taskTimeSuffix(task), {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: LABEL_COLOR,
        })
        .setOrigin(1, 0.5),
    );

    // Botón de cancelar. Ronda 4a: caja propia además del glifo, y los dos más
    // grandes. Antes era una "×" de 14 px suelta sobre el fondo de la fila — el
    // operador ni sabía que se podía cancelar. El resaltado al pasar por encima
    // lo pone la escena sobre `cancelHitAreas`, que ya conoce la geometría.
    rowsContainer.add(
      scene.add
        .rectangle(
          contentWidth - CANCEL_HIT_WIDTH,
          rowY + 3,
          CANCEL_HIT_WIDTH,
          ROW_HEIGHT - 6,
          CRISIS_FATAL_COLOR,
          0.18,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, CRISIS_FATAL_COLOR, 0.5),
    );
    rowsContainer.add(
      scene.add
        .text(contentWidth - CANCEL_HIT_WIDTH / 2, rowY + ROW_HEIGHT / 2, "×", {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "17px",
          color: CRISIS_FATAL_CSS,
        })
        .setOrigin(0.5),
    );
    cancelHitAreas.push({
      yTop: rowY,
      yBottom: rowY + ROW_HEIGHT,
      xMin: contentLeft + contentWidth - CANCEL_HIT_WIDTH,
      xMax: contentLeft + contentWidth,
      /**
       * Ronda 4a: la fila ENTERA también cancela, con click derecho. La "×" es
       * el camino descubrible; el click derecho es el cómodo, para no tener que
       * apuntar a un blanco chico en una lista scrolleada.
       */
      rowXMin: contentLeft + indent,
      rowXMax: contentLeft + contentWidth,
      taskId: task.taskId,
    });

    rowY += ROW_HEIGHT + ROW_GAP;
  }

  const contentHeight = tasks.length === 0 ? viewHeight : rowY;

  // Máscara de geometría para recortar las filas al área de contenido. El
  // `GeometryMask.destroy()` de Phaser solo anula su referencia, NO destruye el
  // Graphics — así que lo agregamos al container (invisible) para que
  // `container.destroy(true)` lo limpie en cada redibujo y no se filtre.
  const maskShape = scene.add.graphics();
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(contentLeft, contentTop, contentWidth, viewHeight);
  maskShape.setVisible(false);
  container.add(maskShape);
  const mask = maskShape.createGeometryMask();
  rowsContainer.setMask(mask);

  return { container, rowsContainer, mask, cancelHitAreas, contentHeight, contentTop, viewHeight };
}
