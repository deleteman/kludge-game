import Phaser from "phaser";
import { GRID_CELL_SIZE_PX } from "engine";
import type { ProjectileState } from "engine";

import { RENDER_DEPTH } from "./render-depths.js";
import { componentTextureKey, hasComponentSprite } from "./component-sprite-registry.js";

const CELL = GRID_CELL_SIZE_PX;

/**
 * Placeholder por código (CLAUDE.md, "cuando falte un sprite"): usado cuando
 * el proyectil no tiene `componentDefinitionId` resuelto (`resolveDefinitionId`
 * no encontró nada, ej. proyectil sin promoter que lo registre) o cuando la
 * pieza sí tiene identidad de catálogo pero no hay sprite cargado para ella.
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
 *
 * `resolveDefinitionId` (Fase 12f, deuda #5): la pieza pierde su identidad de
 * catálogo al promoverse a proyectil suelto (`ProjectileBody.ref` solo guarda
 * el `instanceId`), así que el sprite real se resuelve consultando aparte a
 * `LooseFerromagneticPromoter.definitionIdForRef` — si no hay definición o no
 * hay sprite cargado para ella, cae al círculo placeholder de siempre.
 */
export function renderProjectileTokens(
  scene: Phaser.Scene,
  projectiles: ReadonlyArray<ProjectileState>,
  resolveDefinitionId: (ref: string) => string | undefined,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(RENDER_DEPTH.projectileEntity);
  const graphics = scene.add.graphics();
  container.add(graphics);

  for (const state of projectiles) {
    const cx = state.position.x * CELL + CELL / 2;
    const cy = state.position.y * CELL + CELL / 2;
    const definitionId = resolveDefinitionId(state.ref);
    if (definitionId !== undefined && hasComponentSprite(scene, definitionId)) {
      const sprite = scene.add
        .image(cx, cy, componentTextureKey(definitionId))
        .setOrigin(0.5, 0.5)
        .setDisplaySize(CELL * 0.6, CELL * 0.6);
      container.add(sprite);
      continue;
    }
    graphics.fillStyle(PROJECTILE_TOKEN_COLOR, 1);
    graphics.fillCircle(cx, cy, CELL * 0.3);
    graphics.lineStyle(2, PROJECTILE_TOKEN_OUTLINE, 1);
    graphics.strokeCircle(cx, cy, CELL * 0.3);
  }

  return container;
}
