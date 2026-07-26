import Phaser from "phaser";
import { GRID_CELL_SIZE_PX } from "engine";
import type { ProjectileState } from "engine";

import { RENDER_DEPTH } from "./render-depths.js";

const CELL = GRID_CELL_SIZE_PX;

/**
 * Placeholder por código (CLAUDE.md, "cuando falte un sprite"): la pieza
 * pierde su identidad de catálogo al promoverse a proyectil suelto
 * (`LooseFerromagneticPromoter`, Fase 11a.3), así que hoy no hay forma de
 * reutilizar su sprite de componente para este token. Mismo criterio que los
 * tokens de tripulación (`render-depths.ts`, "sin sprite todavía").
 */
const PROJECTILE_TOKEN_COLOR = 0xd8d8d8;
const PROJECTILE_TOKEN_OUTLINE = 0x1a2030;

/**
 * Dibuja el token de cada proyectil ferromagnético en vuelo (Fase 11a.3).
 * Patrón `redraw()` destructivo (como `mission-overlay-renderer.ts`), llamado
 * cada frame durante ejecución — a diferencia de los tokens de tripulación
 * (que necesitan identidad persistente para animar el salto), un proyectil no
 * se anima entre celdas: su posición ya es continua (avance fraccionario de
 * `ProjectileSimulation`), así que redibujar de cero es suficiente y más
 * simple.
 */
export function renderProjectileTokens(
  scene: Phaser.Scene,
  projectiles: ReadonlyArray<ProjectileState>,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(RENDER_DEPTH.projectileEntity);
  const graphics = scene.add.graphics();
  container.add(graphics);

  for (const state of projectiles) {
    const cx = state.position.x * CELL + CELL / 2;
    const cy = state.position.y * CELL + CELL / 2;
    graphics.fillStyle(PROJECTILE_TOKEN_COLOR, 1);
    graphics.fillCircle(cx, cy, CELL * 0.3);
    graphics.lineStyle(2, PROJECTILE_TOKEN_OUTLINE, 1);
    graphics.strokeCircle(cx, cy, CELL * 0.3);
  }

  return container;
}
