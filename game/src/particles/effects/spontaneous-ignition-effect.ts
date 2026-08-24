import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { FLARE_TEXTURE } from "../particle-texture-registry.js";

/**
 * Ignición espontánea (GDD 5.3/11.1): el evento no lleva intensidad/radio
 * (a diferencia de `CombustionEvent`) porque es el instante previo a que la
 * combustión se establezca — un chispazo/flare breve, no llamas sostenidas
 * (esas las dispara el `CombustionEvent` que sigue, vía `combustion-effect.ts`).
 */
export const spontaneousIgnitionEffect: EventDrivenEffect<"spontaneous-ignition"> = {
  kind: "spontaneous-ignition",
  trigger(scene, position: GridPosition, _event, options): void {
    const { px, py } = toPixel(position);
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: 250,
        speed: { min: 30, max: 70 },
        scale: { start: textureScale(26), end: 0 },
        quantity: 5,
        tint: 0xffd23f,
        x: spreadRange(4),
        y: spreadRange(4),
      },
      250,
      FLARE_TEXTURE,
      options?.onObjectCreated,
    );
  },
};
