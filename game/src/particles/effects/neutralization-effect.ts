import type { NeutralizationEvent } from "engine";

import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { CIRCLE_TEXTURES, SMOKE_TEXTURES } from "../particle-texture-registry.js";

/** Neutralización química (GDD 5.3/11.1): efervescencia (burbujas) + vapor, duración ligada al pico de calor liberado. */
export const neutralizationEffect: EventDrivenEffect<"neutralization"> = {
  kind: "neutralization",
  trigger(scene, position: GridPosition, event: NeutralizationEvent, options): void {
    const { px, py } = toPixel(position);
    const durationMs = event.heatDurationSeconds * 1000;

    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: Math.min(durationMs, 900),
        speed: { min: 15, max: 45 },
        scale: { start: textureScale(10), end: textureScale(3) },
        quantity: 14,
        frequency: 40,
        tint: 0xbfe8f0,
        x: spreadRange(8),
        y: spreadRange(8),
      },
      Math.min(durationMs, 900),
      CIRCLE_TEXTURES,
      options?.onObjectCreated,
    );

    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: durationMs,
        speed: { min: 8, max: 20 },
        angle: { min: 260, max: 280 },
        scale: { start: textureScale(14), end: textureScale(30) },
        alpha: { start: 0.3, end: 0 },
        quantity: 8,
        frequency: 70,
        tint: 0xe8e8e8,
        x: spreadRange(10),
        y: spreadRange(6),
      },
      durationMs,
      SMOKE_TEXTURES,
      options?.onObjectCreated,
    );
  },
};
