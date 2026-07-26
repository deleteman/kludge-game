import Phaser from "phaser";
import { GRID_CELL_SIZE_PX } from "engine";

import type { GridPosition } from "./particle-effect.types.js";
import { PARTICLE_TEXTURE_SIZE_PX } from "./particle-texture-registry.js";

/**
 * Utilidades compartidas por todos los `effects/*.ts` (evita repetir el
 * boilerplate de posicionamiento grid→píxel y de limpieza de emisor en cada
 * archivo — establecido junto con `combustion-effect.ts`, el fenómeno de
 * referencia).
 */
export const CELL = GRID_CELL_SIZE_PX;

/** Alias corto reutilizado por todos los `effects/*.ts` para tipar sus helpers internos. */
export type EffectScene = Phaser.Scene;

export function toPixel(position: GridPosition): { px: number; py: number } {
  return { px: position.x * CELL + CELL / 2, py: position.y * CELL + CELL / 2 };
}

/**
 * Elige una key al azar de una familia de texturas (`particle-texture-registry.ts`)
 * — Phaser no soporta múltiples texturas standalone por emisor (solo múltiples
 * `frame` de UNA textura/atlas), así que la variedad se resuelve eligiendo una
 * variante por burst/instancia en vez de por partícula individual.
 */
export function pickTexture(texture: string | readonly string[]): string {
  if (typeof texture === "string") return texture;
  return texture[Math.floor(Math.random() * texture.length)]!;
}

/**
 * Crea un emisor de burst con la textura dada (una key, o una familia —
 * `pickTexture` elige una variante al azar, ver `particle-texture-registry.ts`)
 * que se detiene tras `lifespanMs` y se destruye una vez que sus partículas
 * vivas terminan de apagarse. `texture` por defecto es `"__WHITE"` (pixel 4×4
 * interno de Phaser) para los pocos usos que todavía no migraron a arte real.
 */
export function spawnBurst(
  scene: Phaser.Scene,
  px: number,
  py: number,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  lifespanMs: number,
  texture: string | readonly string[] = "__WHITE",
): Phaser.GameObjects.Particles.ParticleEmitter {
  const emitter = scene.add.particles(px, py, pickTexture(texture), config);
  scene.time.delayedCall(lifespanMs, () => {
    emitter.stop();
    scene.time.delayedCall(lifespanMs, () => emitter.destroy());
  });
  return emitter;
}

/** Radio de spread cuadrado (aproximación a un círculo) para `x`/`y` de un `ParticleEmitterConfig`. */
export function spreadRange(radiusPx: number): { min: number; max: number } {
  return { min: -radiusPx, max: radiusPx };
}

/**
 * Escala de partícula equivalente a `desiredSizePx` para una textura del pack
 * de `particle-texture-registry.ts` (fuente ~512px) — reemplaza los valores
 * de `scale` calibrados a mano para `__WHITE` (4px) que usaban los efectos
 * antes de que existiera arte real.
 */
export function textureScale(desiredSizePx: number): number {
  return desiredSizePx / PARTICLE_TEXTURE_SIZE_PX;
}

/** Parámetros de un decal estático persistente (mancha sobre el suelo, distinto de un burst efímero). */
export interface DecalConfig {
  readonly radiusPx: number;
  readonly tint: number;
  readonly alpha: number;
  /** Duración de la aparición/crecimiento inicial, en ms. 0 = aparece de golpe. */
  readonly growMs?: number;
  /** Tiempo a alpha completo antes de empezar a desvanecerse, en ms. */
  readonly holdMs: number;
  /** Duración del fade-out final, en ms. */
  readonly fadeMs: number;
  /** Rotación aleatoria [0, 2π) para que copias de la misma textura no se vean idénticas. Default: aleatoria. */
  readonly rotation?: number;
}

/**
 * Mancha estática persistente sobre el suelo (sangre, quemaduras — GDD 6.8),
 * distinta de `spawnBurst` (emisor de partículas efímero): una sola `Image`
 * con la textura real del pack (`particle-texture-registry.ts`, ~512px de
 * fuente), tintada y escalada al radio pedido, con ciclo
 * aparición→sostenido→desvanecimiento→destrucción. Se autolimpia igual que
 * `spawnBurst` — nadie más necesita registrarla para destruirla.
 */
export function spawnDecal(
  scene: Phaser.Scene,
  px: number,
  py: number,
  texture: string,
  config: DecalConfig,
  depth: number,
): Phaser.GameObjects.Image {
  const targetScale = (config.radiusPx * 2) / PARTICLE_TEXTURE_SIZE_PX;
  const decal = scene.add
    .image(px, py, texture)
    .setTint(config.tint)
    .setRotation(config.rotation ?? Math.random() * Math.PI * 2)
    .setDepth(depth)
    .setAlpha(0)
    .setScale(0);

  const growMs = config.growMs ?? 0;
  scene.tweens.add({
    targets: decal,
    scale: targetScale,
    alpha: config.alpha,
    duration: Math.max(growMs, 1),
    onComplete: () => {
      scene.time.delayedCall(config.holdMs, () => {
        scene.tweens.add({
          targets: decal,
          alpha: 0,
          duration: config.fadeMs,
          onComplete: () => decal.destroy(),
        });
      });
    },
  });
  return decal;
}
