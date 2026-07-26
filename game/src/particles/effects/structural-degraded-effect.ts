import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { DIRT_TEXTURES, SMOKE_TEXTURES } from "../particle-texture-registry.js";

/**
 * Corrosión activa (GDD 11.1, "textura quemado/disuelto progresiva + humo/
 * vapor ácido"): un paso de degradación de resistencia estructural (A→M→B).
 * Distinto del fallo estructural completo (`structuralFailureEffect`, más
 * abajo) — principio 6: el jugador debe poder distinguir "se está debilitando"
 * de "ya colapsó".
 */
export const structuralDegradedEffect: EventDrivenEffect<"structural-degraded"> = {
  kind: "structural-degraded",
  trigger(scene, position: GridPosition): void {
    const { px, py } = toPixel(position);
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: 800,
        speed: { min: 5, max: 20 },
        angle: { min: 260, max: 280 },
        scale: { start: textureScale(14), end: textureScale(32) },
        alpha: { start: 0.4, end: 0 },
        quantity: 10,
        frequency: 50,
        tint: 0x8fbf6a,
        x: spreadRange(8),
        y: spreadRange(8),
      },
      800,
      SMOKE_TEXTURES,
    );
  },
};

/** Fallo estructural completo: colapso — escombros pesados, sin el vapor ácido de la corrosión progresiva. */
export const structuralFailureEffect: EventDrivenEffect<"structural-failure"> = {
  kind: "structural-failure",
  trigger(scene, position: GridPosition): void {
    const { px, py } = toPixel(position);
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: 700,
        speed: { min: 50, max: 130 },
        scale: { start: textureScale(24), end: textureScale(6) },
        quantity: 18,
        tint: 0x6a6a6a,
        x: spreadRange(6),
        y: spreadRange(6),
      },
      700,
      DIRT_TEXTURES,
    );
  },
};
