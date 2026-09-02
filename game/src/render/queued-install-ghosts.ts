import Phaser from "phaser";
import { GRID_CELL_SIZE_PX, occupiedCells } from "engine";
import type { ComponentId, CrewTaskId, PlacedFootprint, TaskState } from "engine";

import { RENDER_DEPTH } from "./render-depths.js";
import { componentTextureKey, ensureComponentPlaceholderTexture, hasComponentSprite } from "./component-sprite-registry.js";
import { dashedPolyline } from "./conduit-path.js";
import { CRISIS_WARNING_COLOR, SELECTED_CELL_COLOR } from "./palette.js";

/**
 * Fantasma de las instalaciones ENCOLADAS (ronda 4c de playtest de 14a-4).
 *
 * **Por qué existe.** Pedido literal del operador al abrir la ronda 4a: *"ver
 * dónde quedarán las piezas sin usar la memoria"*. Encolar tres instalaciones
 * en pausa no dejaba ninguna marca en el plano: la cola decía "instalar →
 * ingeniería" y el jugador tenía que recordar en qué celda había clickeado cada
 * una. Con la reserva de celda de esta misma ronda además hacía falta: una
 * celda pasa a estar prohibida y sin fantasma nada explicaba por qué.
 *
 * **Vocabulario visual reutilizado, no inventado**: trazo ENTRECORTADO
 * (`dashedPolyline`, el mismo de la cicatriz de cable de la ronda 3) más
 * transparencia. Un contorno discontinuo ya significa "esto no está entero" en
 * este juego; acá dice "todavía no está". Y va por DEBAJO de las piezas reales
 * (`RENDER_DEPTH.queuedGhost` < `objects`), porque un plan nunca puede tapar un
 * estado real del motor.
 */

/** Lo que el render necesita de una tarea encolada; lo resuelve `MissionRuntime.queuedInstallGhosts`. */
export interface QueuedInstallGhost {
  readonly taskId: CrewTaskId;
  readonly componentDefinitionId: ComponentId;
  readonly placement: PlacedFootprint;
  readonly state: TaskState;
}

const DASH_PX = 6;
const GAP_PX = 5;
const OUTLINE_WIDTH_PX = 2;

/** Una tarea ya en curso se ve más firme que una que todavía espera turno: el plan se está volviendo real. */
const SPRITE_ALPHA_BY_STATE: Readonly<Record<string, number>> = {
  "in-progress": 0.55,
  pending: 0.32,
  blocked: 0.28,
};

/**
 * Ámbar para una tarea BLOQUEADA, el mismo que la cola usa para su borde
 * (ronda 4a) y `planning` para el modo pausa. Un fantasma que nunca va a
 * llegar no puede verse igual que uno en camino.
 */
function ghostColor(state: TaskState): number {
  return state === "blocked" ? CRISIS_WARNING_COLOR : SELECTED_CELL_COLOR;
}

function alphaFor(state: TaskState): number {
  return SPRITE_ALPHA_BY_STATE[state] ?? 0.32;
}

/**
 * Dibuja el fantasma de cada instalación encolada y devuelve los objetos
 * creados, para que el llamador los destruya en el próximo redibujo.
 *
 * Se redibuja entero en cada cambio de la cola (mismo patrón de
 * `updateSelectedHighlight`): son pocos objetos, cambian por evento y no por
 * frame, y un pool incremental sería estado duplicado que puede desincronizarse
 * de la cola — exactamente el defecto que la ronda 4b tuvo que arreglar.
 */
export function renderQueuedInstallGhosts(
  scene: Phaser.Scene,
  ghosts: ReadonlyArray<QueuedInstallGhost>,
  onCreated?: (object: Phaser.GameObjects.GameObject) => void,
): ReadonlyArray<Phaser.GameObjects.GameObject> {
  const created: Phaser.GameObjects.GameObject[] = [];
  const register = (object: Phaser.GameObjects.GameObject): void => {
    created.push(object);
    onCreated?.(object);
  };

  for (const ghost of ghosts) {
    const cells = occupiedCells(ghost.placement);
    if (cells.length === 0) continue;
    const color = ghostColor(ghost.state);
    const alpha = alphaFor(ghost.state);

    // Sprite real de la pieza cuando existe; si no, el mismo placeholder
    // tinteable que usa el overlay (convención de CLAUDE.md: nunca un hueco
    // silencioso por falta de arte).
    const xs = cells.map((cell) => cell.x);
    const ys = cells.map((cell) => cell.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const widthPx = (Math.max(...xs) - minX + 1) * GRID_CELL_SIZE_PX;
    const heightPx = (Math.max(...ys) - minY + 1) * GRID_CELL_SIZE_PX;
    const hasSprite = hasComponentSprite(scene, ghost.componentDefinitionId);
    const textureKey = hasSprite
      ? componentTextureKey(ghost.componentDefinitionId)
      : ensureComponentPlaceholderTexture(scene);
    const image = scene.add
      .image(minX * GRID_CELL_SIZE_PX, minY * GRID_CELL_SIZE_PX, textureKey)
      .setOrigin(0, 0)
      .setDisplaySize(widthPx, heightPx)
      .setAlpha(alpha)
      .setDepth(RENDER_DEPTH.queuedGhost);
    // El placeholder es blanco: sin tinte sería una mancha que no dice de qué
    // color es el plan. El sprite real conserva el suyo, solo atenuado.
    if (!hasSprite) image.setTint(color);
    register(image);

    // Contorno entrecortado por celda: marca CADA celda ocupada, no solo el
    // rectángulo envolvente — una pieza en L reservaría celdas que no ocupa.
    const outline = scene.add.graphics().setDepth(RENDER_DEPTH.queuedGhost);
    outline.lineStyle(OUTLINE_WIDTH_PX, color, 0.9);
    for (const cell of cells) {
      const left = cell.x * GRID_CELL_SIZE_PX;
      const top = cell.y * GRID_CELL_SIZE_PX;
      const perimeter = [
        { x: left, y: top },
        { x: left + GRID_CELL_SIZE_PX, y: top },
        { x: left + GRID_CELL_SIZE_PX, y: top + GRID_CELL_SIZE_PX },
        { x: left, y: top + GRID_CELL_SIZE_PX },
        { x: left, y: top },
      ];
      for (const [from, to] of dashedPolyline(perimeter, DASH_PX, GAP_PX)) {
        outline.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
    register(outline);
  }

  return created;
}
