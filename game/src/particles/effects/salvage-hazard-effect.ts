import type { DismantleLeakEvent, DismantleSpillEvent } from "engine";

import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import {
  type EffectScene,
  spawnBurst,
  spawnDecal,
  spreadRange,
  textureScale,
  toPixel,
} from "../particle-utils.js";
import {
  CIRCLE_TEXTURES,
  DIRT_TEXTURES,
  SMOKE_TEXTURES,
  SPARK_TEXTURES,
} from "../particle-texture-registry.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";

/**
 * Riesgo sistémico al desmontar (Subfase 13d). Tres fenómenos, tres lecturas
 * visuales claramente distintas — principio 6 de CLAUDE.md: el jugador tiene
 * que poder decir QUÉ salió mal sin leer texto.
 *
 *  - chispa  → estallido eléctrico corto, amarillo/blanco, hacia arriba.
 *  - derrame → charco que se expande en el piso + salpicadura baja.
 *  - fuga    → chorro de gas horizontal que se disipa, lento y ancho.
 */

const SPARK_COLOR = 0xf2e07a;
const SPILL_COLOR = 0x6fc4a8;
const LEAK_COLOR = 0xbcd2e0;

export const dismantleSparkEffect: EventDrivenEffect<"dismantle-spark"> = {
  kind: "dismantle-spark",
  trigger(scene, position: GridPosition): void {
    const { px, py } = toPixel(position);
    spawnBurst(
      scene as EffectScene,
      px,
      py,
      {
        lifespan: 260,
        speed: { min: 70, max: 180 },
        // Cono hacia arriba: el chispazo salta de la pieza al arrancarla.
        angle: { min: 240, max: 300 },
        scale: { start: textureScale(18), end: 0 },
        quantity: 14,
        frequency: 12,
        tint: SPARK_COLOR,
        x: spreadRange(5),
        y: spreadRange(5),
      },
      260,
      SPARK_TEXTURES,
    );
  },
};

export const dismantleSpillEffect: EventDrivenEffect<"dismantle-spill"> = {
  kind: "dismantle-spill",
  trigger(scene, position: GridPosition, event: DismantleSpillEvent): void {
    const { px, py } = toPixel(position);
    // Salpicadura: gotas bajas y lentas, cayendo alrededor de la celda.
    spawnBurst(
      scene as EffectScene,
      px,
      py,
      {
        lifespan: 600,
        speed: { min: 20, max: 55 },
        gravityY: 120,
        scale: { start: textureScale(14), end: textureScale(4) },
        quantity: 12,
        frequency: 25,
        tint: SPILL_COLOR,
        x: spreadRange(8),
        y: spreadRange(6),
      },
      600,
      CIRCLE_TEXTURES,
    );
    // Charco persistente: cuanto más había en el reservorio, más grande.
    spawnDecal(
      scene as EffectScene,
      px,
      py,
      DIRT_TEXTURES[0],
      {
        radiusPx: 10 + Math.min(event.amount, 20),
        tint: SPILL_COLOR,
        alpha: 0.45,
        growMs: 300,
        holdMs: 8000,
        fadeMs: 4000,
      },
      RENDER_DEPTH.bloodDecal,
    );
  },
};

export const dismantleLeakEffect: EventDrivenEffect<"dismantle-leak"> = {
  kind: "dismantle-leak",
  trigger(scene, position: GridPosition, event: DismantleLeakEvent): void {
    const { px, py } = toPixel(position);
    // Chorro ancho y lento que se disipa: aire escapando por el hueco que dejó
    // la pieza. Dura tanto como la fuga que el motor abrió, para que lo que se
    // ve y lo que la sección está perdiendo coincidan.
    const durationMs = Math.round(event.durationSeconds * 1000);
    spawnBurst(
      scene as EffectScene,
      px,
      py,
      {
        lifespan: 900,
        speed: { min: 25, max: 70 },
        scale: { start: textureScale(12), end: textureScale(38) },
        alpha: { start: 0.4, end: 0 },
        quantity: 2,
        frequency: 90,
        tint: LEAK_COLOR,
        x: spreadRange(4),
        y: spreadRange(4),
      },
      durationMs,
      SMOKE_TEXTURES,
    );
  },
};
