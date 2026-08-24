import type { FailureMode, OverloadEvent, ResourceType } from "engine";

import type { EventDrivenEffect, GridPosition, ObjectCreatedHook } from "../particle-effect.types.js";
import {
  type EffectScene,
  spawnBurst,
  spawnDecal,
  spreadRange,
  textureScale,
  toPixel,
} from "../particle-utils.js";
import { FIRE_TEXTURES, FLAME_TEXTURES, SCORCH_TEXTURE, SPARK_TEXTURES } from "../particle-texture-registry.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";

/**
 * Sobrecarga de conductor/reservorio (GDD 5.6/11.1). Tres `failureMode`
 * distintos, tres fenómenos visuales distintos (principio 6): corte →
 * chispas/arco; incendio → llamarada corta (variante liviana de la paleta de
 * `combustion-effect.ts`, sin la duración de un incendio sostenido); explosión
 * → onda expansiva + escombros.
 */
const SPARK_COLOR_BY_RESOURCE: Readonly<Record<ResourceType, number>> = {
  E: 0xf2d24b,
  G: 0x8fd46a,
  L: 0x4a7bd4,
  T: 0xd97a2e,
};

function sparkBurst(
  scene: EffectScene,
  px: number,
  py: number,
  event: OverloadEvent,
  onCreated?: ObjectCreatedHook,
): void {
  const intensity = Math.min(event.load / event.capacity, 3);
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 300,
      speed: { min: 60, max: 140 * intensity },
      scale: { start: textureScale(20), end: 0 },
      quantity: Math.round(6 + 4 * intensity),
      frequency: 15,
      tint: SPARK_COLOR_BY_RESOURCE[event.resourceType],
      x: spreadRange(6),
      y: spreadRange(6),
    },
    300,
    SPARK_TEXTURES,
    onCreated,
  );
}

function fireFlash(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 500,
      speed: { min: 15, max: 40 },
      angle: { min: 255, max: 285 },
      scale: { start: textureScale(22), end: 0 },
      quantity: 10,
      frequency: 20,
      tint: 0xef5a1f,
      x: spreadRange(10),
      y: spreadRange(6),
    },
    500,
    FLAME_TEXTURES,
    onCreated,
  );
  scorchDecal(scene, px, py, 10, onCreated);
}

function explosionBurst(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 600,
      speed: { min: 120, max: 260 },
      scale: { start: textureScale(32), end: 0 },
      quantity: 24,
      tint: 0xffb347,
      x: spreadRange(4),
      y: spreadRange(4),
    },
    600,
    FIRE_TEXTURES,
    onCreated,
  );
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 900,
      speed: { min: 40, max: 100 },
      scale: { start: textureScale(16), end: textureScale(30) },
      quantity: 14,
      tint: 0x5a5248,
      x: spreadRange(4),
      y: spreadRange(4),
    },
    900,
    FIRE_TEXTURES,
    onCreated,
  );
  scorchDecal(scene, px, py, 16, onCreated);
}

/** Marca de quemadura persistente (GDD 6.8: reutilizada también por `crew-death-effect.ts`). */
function scorchDecal(
  scene: EffectScene,
  px: number,
  py: number,
  radiusPx: number,
  onCreated?: ObjectCreatedHook,
): void {
  spawnDecal(
    scene,
    px,
    py,
    SCORCH_TEXTURE,
    { radiusPx, tint: 0x2a2016, alpha: 0.6, growMs: 200, holdMs: 6000, fadeMs: 4000 },
    RENDER_DEPTH.bloodDecal,
    onCreated,
  );
}

const HANDLER_BY_MODE: Readonly<
  Record<
    FailureMode,
    (scene: EffectScene, px: number, py: number, event: OverloadEvent, onCreated?: ObjectCreatedHook) => void
  >
> = {
  cut: (scene, px, py, event, onCreated) => sparkBurst(scene, px, py, event, onCreated),
  fire: (scene, px, py, _event, onCreated) => fireFlash(scene, px, py, onCreated),
  explosion: (scene, px, py, _event, onCreated) => explosionBurst(scene, px, py, onCreated),
};

export const overloadEffect: EventDrivenEffect<"overload"> = {
  kind: "overload",
  trigger(scene, position: GridPosition, event: OverloadEvent, options): void {
    const { px, py } = toPixel(position);
    HANDLER_BY_MODE[event.failureMode](scene, px, py, event, options?.onObjectCreated);
  },
};
