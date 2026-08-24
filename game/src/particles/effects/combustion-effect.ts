import type { CombustionEvent, CombustionIntensity, CombustionRadius } from "engine";

import type { EventDrivenEffect, GridPosition, ObjectCreatedHook } from "../particle-effect.types.js";
import {
  CELL,
  type EffectScene,
  spawnBurst,
  spreadRange,
  textureScale,
  toPixel,
} from "../particle-utils.js";
import { BLOOD_TEXTURES, FLAME_TEXTURES, SMOKE_TEXTURES } from "../particle-texture-registry.js";

/**
 * Fenómeno de referencia de Fase 8 (llamas + humo + luz parpadeante, GDD
 * 11.1). Fija el patrón que replican el resto de `effects/*.ts`: mapear
 * campos del `DomainEvent` a parámetros de emisor, posicionar en píxeles vía
 * `toPixel`/`CELL`, y limpiar todo al terminar el burst (`spawnBurst`).
 */
const FLAME_PARTICLE_COUNT: Readonly<Record<CombustionIntensity, number>> = {
  weak: 8,
  standard: 16,
  violent: 28,
};

/** Radio del emisor en píxeles, según cuánto de la sección alcanza el fuego. */
const EMIT_RADIUS_PX: Readonly<Record<CombustionRadius, number>> = {
  none: CELL * 0.4,
  "half-section": CELL * 1.5,
  "full-section": CELL * 3,
};

const FLAME_COLOR_BY_INTENSITY: Readonly<Record<CombustionIntensity, number>> = {
  weak: 0xd97a2e,
  standard: 0xef5a1f,
  violent: 0xff2f0f,
};

const FLAME_DURATION_MS: Readonly<Record<CombustionIntensity, number>> = {
  weak: 700,
  standard: 1200,
  violent: 2000,
};

/** Daño a tripulante (GDD 11.1, fila "daño a tripulante"): burst rojo corto superpuesto, reutilizado por el resto de efectos que también llevan `crewDamage`/`severity`. */
export function crewDamageFlash(
  scene: EffectScene,
  px: number,
  py: number,
  radiusPx: number,
  onCreated?: ObjectCreatedHook,
): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 350,
      speed: { min: 40, max: 90 },
      scale: { start: textureScale(14), end: 0 },
      quantity: 6,
      tint: 0xc21f1f,
      x: spreadRange(radiusPx * 0.5),
      y: spreadRange(radiusPx * 0.5),
    },
    350,
    BLOOD_TEXTURES,
    onCreated,
  );
}

export const combustionEffect: EventDrivenEffect<"combustion"> = {
  kind: "combustion",
  trigger(scene, position: GridPosition, event: CombustionEvent, options): void {
    const { px, py } = toPixel(position);
    const emitRadius = EMIT_RADIUS_PX[event.radius];
    const duration = FLAME_DURATION_MS[event.intensity];

    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: duration,
        speed: { min: 20, max: 60 },
        angle: { min: 250, max: 290 },
        scale: { start: textureScale(28), end: 0 },
        quantity: FLAME_PARTICLE_COUNT[event.intensity],
        frequency: 30,
        tint: FLAME_COLOR_BY_INTENSITY[event.intensity],
        x: spreadRange(emitRadius),
        y: spreadRange(emitRadius / 2),
      },
      duration,
      FLAME_TEXTURES,
      options?.onObjectCreated,
    );

    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: duration * 1.5,
        speed: { min: 10, max: 30 },
        angle: { min: 260, max: 280 },
        scale: { start: textureScale(20), end: textureScale(45) },
        alpha: { start: 0.35, end: 0 },
        quantity: Math.ceil(FLAME_PARTICLE_COUNT[event.intensity] / 2),
        frequency: 60,
        tint: 0x4a4a4a,
        x: spreadRange(emitRadius),
        y: spreadRange(emitRadius / 2),
      },
      duration * 1.5,
      SMOKE_TEXTURES,
      options?.onObjectCreated,
    );

    // Deuda #16, cerrada en el cierre de 12d: el fogonazo se creaba sin pasar
    // por el hook, así que la `hudCamera` lo repintaba fijo en pantalla. Desde
    // 13a la combustión se dispara en partida real (antes solo en la galería),
    // así que el duplicado era visible de verdad.
    const light = scene.add.pointlight(
      px,
      py,
      FLAME_COLOR_BY_INTENSITY[event.intensity],
      emitRadius * 2,
      0.6,
    );
    options?.onObjectCreated?.(light);
    scene.tweens.add({
      targets: light,
      intensity: { from: 0.4, to: 0.8 },
      duration: 90,
      yoyo: true,
      repeat: Math.ceil(duration / 180),
    });
    scene.time.delayedCall(duration * 2.5, () => light.destroy());

    if (event.crewDamage !== "none") {
      crewDamageFlash(scene, px, py, emitRadius, options?.onObjectCreated);
    }
  },
};
