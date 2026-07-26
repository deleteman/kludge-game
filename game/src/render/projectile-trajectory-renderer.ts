import Phaser from "phaser";
import { GRID_CELL_SIZE_PX } from "engine";
import type { GridPosition, ProjectileState, TrajectoryPreviewStep } from "engine";

import { RENDER_DEPTH } from "./render-depths.js";
import { TRAJECTORY_GHOST_COLOR } from "./palette.js";

const CELL = GRID_CELL_SIZE_PX;
const center = (n: number): number => n * CELL + CELL / 2;

/** Cada cuántos pasos predichos se dibuja un marcador de tick, para no saturar el trazo (paso fijo de 0.1s, horizonte de 10s). */
const TICK_MARKER_STRIDE = 5;

/**
 * Dibuja la trayectoria fantasma de cada proyectil vivo (Fase 11a.3, ASA 3):
 * una polilínea tenue desde la posición ACTUAL del proyectil a través de cada
 * paso predicho (`previewMissionTrajectory`), con marcadores de tick cada
 * `TICK_MARKER_STRIDE` pasos. Se calcula UNA vez al entrar en pausa táctica
 * (no por frame — ver `MissionRuntime.previewProjectileTrajectories`) y se
 * destruye al reanudar. Patrón `redraw()` destructivo, igual que el resto del
 * proyecto.
 */
export function renderTrajectoryGhost(
  scene: Phaser.Scene,
  liveProjectiles: ReadonlyArray<ProjectileState>,
  trajectoriesByRef: ReadonlyMap<string, ReadonlyArray<TrajectoryPreviewStep>>,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(RENDER_DEPTH.trajectoryGhost);
  const graphics = scene.add.graphics();
  container.add(graphics);

  for (const live of liveProjectiles) {
    const steps = trajectoriesByRef.get(live.ref);
    if (!steps || steps.length === 0) {
      continue;
    }

    graphics.lineStyle(2, TRAJECTORY_GHOST_COLOR, 0.45);
    let previous: GridPosition = live.position;
    for (const step of steps) {
      graphics.lineBetween(center(previous.x), center(previous.y), center(step.position.x), center(step.position.y));
      previous = step.position;
    }

    steps.forEach((step, index) => {
      if (index % TICK_MARKER_STRIDE !== 0 && index !== steps.length - 1) {
        return;
      }
      graphics.fillStyle(TRAJECTORY_GHOST_COLOR, 0.8);
      graphics.fillCircle(center(step.position.x), center(step.position.y), 3);
    });
  }

  return container;
}
