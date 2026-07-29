import type Phaser from "phaser";
import type { CrewTaskId, TaskState } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { CREW_TOKEN_COLORS, LABEL_COLOR, SELECTED_CELL_COLOR } from "../../render/palette.js";

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
}

export interface QueueCancelHit {
  /** Coords de CONTENIDO (y local dentro de `rowsContainer`, antes del scroll). */
  readonly yTop: number;
  readonly yBottom: number;
  /** Coords de PANTALLA (la cola no scrollea horizontal). */
  readonly xMin: number;
  readonly xMax: number;
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
const CANCEL_HIT_WIDTH = 22;
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

    const bg = scene.add
      .rectangle(0, rowY, contentWidth, ROW_HEIGHT, color, task.selected ? 0.28 : 0.14)
      .setOrigin(0, 0);
    if (task.selected) bg.setStrokeStyle(1, SELECTED_CELL_COLOR, 0.8);
    rowsContainer.add(bg);

    // Chip del color del tripulante (liga con el dot del mapa y el retrato).
    rowsContainer.add(
      scene.add
        .rectangle(6, rowY + ROW_HEIGHT / 2, CHIP_SIZE, CHIP_SIZE, color, 1)
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
    rowsContainer.add(
      scene.add
        .text(18, rowY + ROW_HEIGHT / 2, `${task.actorName} · ${task.label}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: LABEL_COLOR,
          wordWrap: { width: contentWidth - 18 - TIME_WIDTH - CANCEL_HIT_WIDTH },
          maxLines: 1,
        })
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

    // "×" de cancelar (visual); el hit lo resuelve la escena.
    rowsContainer.add(
      scene.add
        .text(contentWidth - 10, rowY + ROW_HEIGHT / 2, "×", {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "14px",
          color: LABEL_COLOR,
        })
        .setOrigin(1, 0.5),
    );
    cancelHitAreas.push({
      yTop: rowY,
      yBottom: rowY + ROW_HEIGHT,
      xMin: contentLeft + contentWidth - CANCEL_HIT_WIDTH,
      xMax: contentLeft + contentWidth,
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
