import type Phaser from "phaser";

import type { GridPosition } from "../particle-effect.types.js";
import { CELL, type EffectScene, spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";

/**
 * Estática de fósforo LOCALIZADA sobre el tile averiado (roadmap Duskers, capa
 * "System Failure"): cuando un componente sufre un fallo grave, su celda del
 * esquema se llena de ruido de fósforo parpadeante, como una zona de la pantalla
 * CRT que pierde señal. Es la contraparte en ESPACIO DE MUNDO del CRT global del
 * shader (`crt-pipeline.ts`), que es en espacio de pantalla y no conoce dónde
 * ocurrió el fallo — por eso esto va como partículas y no como uniform.
 *
 * Sigue el contrato de `environmental-damage-effect.ts`: DEVUELVE los emisores
 * creados para que la escena les fije `depth` y los marque como objetos de mundo
 * (`markAsWorldObject`); sin eso, un objeto sin cámara asignada se pinta en las
 * dos cámaras (mundo + HUD) en coordenadas distintas y "salta" por la pantalla.
 *
 * La ESCENA decide si dispararla (gate del control de flicker de accesibilidad):
 * a flicker 0, un jugador fotosensible no ve esta estática, coherente con la
 * capa `uFailure` del shader.
 */

/** Severidad del fallo → cuánta estática y cuánto dura. */
export type PhosphorStaticSeverity = "minor" | "major";

const PHOSPHOR_COLOR = 0xbfeecb; // fósforo verde-blanquecino
const PHOSPHOR_COLOR_HOT = 0xffe6b0; // destellos cálidos ocasionales (avería con calor)

interface StaticParams {
  readonly durationMs: number;
  readonly quantity: number;
  readonly frequency: number;
}

const PARAMS_BY_SEVERITY: Readonly<Record<PhosphorStaticSeverity, StaticParams>> = {
  minor: { durationMs: 1400, quantity: 5, frequency: 40 },
  major: { durationMs: 2600, quantity: 10, frequency: 22 },
};

/**
 * Ruido de fósforo sobre la celda: partículas de 1-2px que aparecen y se apagan
 * enseguida por toda el área del tile (grano de estática), con parpadeo por la
 * corta vida + alta frecuencia. Dos emisores (frío + destellos cálidos) para que
 * lea como "señal perdida" y no como una nube uniforme.
 */
export function firePhosphorStatic(
  scene: EffectScene,
  position: GridPosition,
  severity: PhosphorStaticSeverity,
): Phaser.GameObjects.Particles.ParticleEmitter[] {
  const { px, py } = toPixel(position);
  const params = PARAMS_BY_SEVERITY[severity];
  const half = CELL / 2;

  const grain = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 90,
      speed: 0,
      scale: { start: textureScale(3), end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: params.quantity,
      frequency: params.frequency,
      tint: PHOSPHOR_COLOR,
      x: spreadRange(half),
      y: spreadRange(half),
    },
    params.durationMs,
  );

  const sparks = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 120,
      speed: 0,
      scale: { start: textureScale(4), end: 0 },
      alpha: { start: 0.7, end: 0 },
      quantity: Math.max(1, Math.round(params.quantity / 3)),
      frequency: params.frequency * 2,
      tint: PHOSPHOR_COLOR_HOT,
      x: spreadRange(half),
      y: spreadRange(half),
    },
    params.durationMs,
  );

  return [grain, sparks];
}
