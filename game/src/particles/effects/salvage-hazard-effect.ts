import type Phaser from "phaser";
import type { DismantleLeakEvent, DismantleSpillEvent } from "engine";

import type {
  EventDrivenEffect,
  EventEffectOptions,
  GridPosition,
  ObjectCreatedHook,
} from "../particle-effect.types.js";
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
/**
 * Color de respaldo del derrame. Era FIJO hasta 13e ronda 2, así que un charco
 * de agua y uno de ácido se veían idénticos — dos fenómenos distintos con la
 * misma lectura visual, justo lo que el principio 6 prohíbe. Ahora el llamador
 * pasa el tinte derivado de la sustancia (`chemicalSubstanceColor`) y esto solo
 * cubre el caso sin sustancia conocida.
 */
const SPILL_COLOR = 0x6fc4a8;
const LEAK_COLOR = 0xbcd2e0;

export const dismantleSparkEffect: EventDrivenEffect<"dismantle-spark"> = {
  kind: "dismantle-spark",
  trigger(scene, position: GridPosition, _event, options): void {
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
      options?.onObjectCreated,
    );
  },
};

/**
 * Salpicadura + charco de una sustancia que cae al piso. Extraído del efecto de
 * derrame en 13e ronda 2 porque ahora hay TRES formas de mojar el suelo — el
 * derrame accidental al desmontar (13d), verter deliberadamente en una sección
 * y purgar un reservorio — y las tres son el mismo fenómeno físico. Dejarlo
 * dentro del `EventDrivenEffect` obligaba a fabricar un `DismantleSpillEvent`
 * falso para las otras dos.
 */
export function firePouredSubstance(
  scene: Phaser.Scene,
  position: GridPosition,
  amount: number,
  tint: number = SPILL_COLOR,
  /**
   * Registro de los objetos creados (13e ronda 4). SIN esto el charco caía en
   * el "bug de doble cámara" que el resto de efectos ya evita: la `hudCamera`
   * lo pintaba también, sin scroll y fuera de sitio, así que el derrame no se
   * veía donde tenía que verse. Es el mismo hook que usan los efectos
   * state-driven (`ParticleEmitterHook`).
   */
  onObjectCreated?: ObjectCreatedHook,
): void {
  const { px, py } = toPixel(position);
  // Salpicadura: gotas bajas y lentas, cayendo alrededor de la celda.
  const burst = spawnBurst(
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
      tint,
      x: spreadRange(8),
      y: spreadRange(6),
    },
    600,
    CIRCLE_TEXTURES,
  );
  // La salpicadura tampoco fijaba depth, así que quedaba en 0 — empatada con el
  // suelo del tilemap.
  burst.setDepth(RENDER_DEPTH.effect);
  onObjectCreated?.(burst);
  // Charco persistente: cuanto más se volcó, más grande.
  const decal = spawnDecal(
    scene as EffectScene,
    px,
    py,
    DIRT_TEXTURES[0],
    {
      radiusPx: 10 + Math.min(amount, 20),
      tint,
      alpha: 0.6,
      growMs: 300,
      holdMs: 8000,
      fadeMs: 4000,
    },
    RENDER_DEPTH.substanceSpill,
  );
  onObjectCreated?.(decal);
}

export const dismantleSpillEffect: EventDrivenEffect<"dismantle-spill"> = {
  kind: "dismantle-spill",
  trigger(
    scene,
    position: GridPosition,
    event: DismantleSpillEvent,
    options?: EventEffectOptions,
  ): void {
    firePouredSubstance(
      scene,
      position,
      event.amount,
      options?.tint ?? SPILL_COLOR,
      options?.onObjectCreated,
    );
  },
};

export const dismantleLeakEffect: EventDrivenEffect<"dismantle-leak"> = {
  kind: "dismantle-leak",
  trigger(scene, position: GridPosition, event: DismantleLeakEvent, options): void {
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
      options?.onObjectCreated,
    );
  },
};
