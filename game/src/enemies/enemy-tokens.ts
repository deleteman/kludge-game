import type Phaser from "phaser";
import type { EnemyActor, EnemyArchetype } from "engine";
import {
  hopMove,
  ARMORED_ENEMY_SIGNATURE,
  AGILE_ENEMY_SIGNATURE,
  type JumpSignature,
} from "../crew/hop-movement.js";
import { RENDER_DEPTH } from "../render/render-depths.js";

/**
 * Token visual de un enemigo (Fase 11d.3). Mismo criterio que los tokens de
 * tripulación (`floorplan-scene.ts::initCrewTokens`, círculo placeholder sin
 * sprite todavía, GDD §17): rectángulo de color sólido con el archetipo como
 * texto, hasta que existan `game/assets/sprites/crew/enemy-armored.png` y
 * `game/assets/sprites/crew/enemy-agile.png` (ninguno de los dos existe hoy
 * en el proyecto). Rectángulo, no círculo, para que un enemigo nunca se
 * confunda con un tripulante a simple vista (principio 6, CLAUDE.md).
 */
export interface EnemyToken {
  readonly shape: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  readonly archetype: EnemyArchetype;
}

const TINT_BY_ARCHETYPE: Readonly<Record<EnemyArchetype, number>> = {
  // Blindado: gris-azulado oscuro, pesado. Ágil: naranja, de alerta.
  armored: 0x555a63,
  agile: 0xd9662b,
};

const SIZE_PX_BY_ARCHETYPE: Readonly<Record<EnemyArchetype, number>> = {
  armored: 24,
  agile: 18,
};

const SIGNATURE_BY_ARCHETYPE: Readonly<Record<EnemyArchetype, JumpSignature>> = {
  armored: ARMORED_ENEMY_SIGNATURE,
  agile: AGILE_ENEMY_SIGNATURE,
};

/** Firma de salto (GDD 11.2) del archetipo de este token — para que `floorplan-scene.ts` la use al encadenar hops celda a celda (Fase 11d.4). */
export function enemyJumpSignature(token: EnemyToken): JumpSignature {
  return SIGNATURE_BY_ARCHETYPE[token.archetype];
}

export function createEnemyToken(
  scene: Phaser.Scene,
  markAsWorldObject: (obj: Phaser.GameObjects.GameObject) => void,
  enemy: EnemyActor,
  positionPx: { readonly x: number; readonly y: number },
): EnemyToken {
  const size = SIZE_PX_BY_ARCHETYPE[enemy.archetype];
  const shape = scene.add
    .rectangle(positionPx.x, positionPx.y, size, size, TINT_BY_ARCHETYPE[enemy.archetype])
    .setStrokeStyle(2, 0x0a0a0f, 1)
    .setDepth(RENDER_DEPTH.enemyEntity);
  markAsWorldObject(shape);
  const label = scene.add
    .text(positionPx.x, positionPx.y - size, enemy.archetype, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#f2d24b",
    })
    .setOrigin(0.5, 1)
    .setDepth(RENDER_DEPTH.enemyEntity);
  markAsWorldObject(label);
  return { shape, label, archetype: enemy.archetype };
}

/**
 * Salto DIRECTO de `from` (posición actual) a `toPx` en un solo `hopMove`, con
 * la firma de salto de su archetipo (GDD 11.2). Fallback (Fase 11d.4): el
 * camino principal es que `floorplan-scene.ts::handleEnemyEvent` encadene un
 * hop por celda (`chainHops`, mismo mecanismo que la tripulación) — esta
 * función solo se usa si no hay grilla transitable para calcular ese camino.
 * Un salto directo entre celdas lejanas se ve como un teletransporte, no
 * como caminar; por eso dejó de ser el camino normal.
 */
export function hopEnemyToken(
  scene: Phaser.Scene,
  token: EnemyToken,
  toPx: { readonly x: number; readonly y: number },
): Phaser.Tweens.Tween {
  const from = { x: token.shape.x, y: token.shape.y };
  return hopMove(scene, token.shape, from, toPx, "normal", SIGNATURE_BY_ARCHETYPE[token.archetype]);
}

/** Feedback corto de "este enemigo acaba de conectar un ataque" — pulso de escala + flash sobre su propio token. */
export function flashEnemyAttack(scene: Phaser.Scene, token: EnemyToken): void {
  scene.tweens.add({
    targets: token.shape,
    scale: 1.5,
    duration: 100,
    yoyo: true,
    ease: "Quad.easeOut",
  });
}

export function destroyEnemyToken(token: EnemyToken): void {
  token.shape.destroy();
  token.label.destroy();
}
