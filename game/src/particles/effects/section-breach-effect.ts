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
} from "../particle-texture-registry.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";

/**
 * Daño y colapso de una sección (Subfase 13f). Dos fenómenos con lecturas
 * distintas, principio 6 de CLAUDE.md:
 *
 *  - `section-damaged` → sacudida corta de polvo y cascotes cayendo: el casco
 *    aguantó, pero se sintió. Se emite solo al cruzar de nivel, así que no
 *    satura la pantalla.
 *  - `section-breached` → el agujero al vacío: chorro violento y LARGO de aire
 *    escapando hacia afuera + una mancha oscura permanente en la celda, que es
 *    lo que el jugador tiene que poder localizar después para taparla.
 *
 * La brecha se distingue a propósito de la fuga por desmontaje de 13d
 * (`dismantle-leak`, chorro suave que se disipa): esto no es una fuga, es un
 * agujero, y tiene que leerse como algo peor.
 */

const DUST_COLOR = 0xb0a89a;
const VACUUM_COLOR = 0xcfe2f0;
const BREACH_SCAR_COLOR = 0x1b2230;

export const sectionDamagedEffect: EventDrivenEffect<"section-damaged"> = {
  kind: "section-damaged",
  trigger(scene, position: GridPosition, _event, options): void {
    const { px, py } = toPixel(position);
    spawnBurst(
      scene as EffectScene,
      px,
      py,
      {
        lifespan: 700,
        speed: { min: 15, max: 50 },
        // Cae: es polvo desprendiéndose del techo, no una explosión.
        gravityY: 200,
        angle: { min: 250, max: 290 },
        scale: { start: textureScale(10), end: textureScale(3) },
        alpha: { start: 0.7, end: 0 },
        quantity: 10,
        frequency: 30,
        tint: DUST_COLOR,
        x: spreadRange(14),
        y: spreadRange(10),
      },
      700,
      CIRCLE_TEXTURES,
      options?.onObjectCreated,
    );
  },
};

export const sectionBreachedEffect: EventDrivenEffect<"section-breached"> = {
  kind: "section-breached",
  trigger(scene, position: GridPosition, _event, options): void {
    const { px, py } = toPixel(position);
    // Descompresión: rápido, ancho y sostenido varios segundos. La sección se
    // está vaciando de verdad, no es un fogonazo.
    const burst = spawnBurst(
      scene as EffectScene,
      px,
      py,
      {
        lifespan: 1100,
        speed: { min: 90, max: 220 },
        scale: { start: textureScale(8), end: textureScale(44) },
        alpha: { start: 0.75, end: 0 },
        quantity: 6,
        frequency: 30,
        tint: VACUUM_COLOR,
        x: spreadRange(6),
        y: spreadRange(6),
      },
      4000,
      SMOKE_TEXTURES,
      options?.onObjectCreated,
    );
    burst.setDepth(RENDER_DEPTH.effect);

    // Marca permanente del agujero: `holdMs` altísimo porque la brecha NO se
    // cierra sola (principio 5). Es además la pista visual de dónde instalar el
    // parche — sin ella el jugador sabría que hay una brecha pero no dónde.
    const decal = spawnDecal(
      scene as EffectScene,
      px,
      py,
      DIRT_TEXTURES[0],
      {
        radiusPx: 22,
        tint: BREACH_SCAR_COLOR,
        alpha: 0.85,
        growMs: 400,
        holdMs: 10 * 60 * 1000,
        fadeMs: 2000,
      },
      RENDER_DEPTH.substanceSpill,
    );
    options?.onObjectCreated?.(decal);
  },
};
