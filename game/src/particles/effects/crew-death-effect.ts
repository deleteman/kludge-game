import type { CrewDamageCause, CrewDamagedEvent, CrewDeathEvent } from "engine";

import type { EventDrivenEffect, GridPosition, ObjectCreatedHook } from "../particle-effect.types.js";
import {
  type EffectScene,
  spawnBurst,
  spawnDecal,
  spreadRange,
  textureScale,
  toPixel,
} from "../particle-utils.js";
import { crewDamageFlash } from "./combustion-effect.js";
import {
  BLOOD_POOL_TEXTURE,
  BLOOD_TEXTURES,
  CIRCLE_TEXTURES,
  SMOKE_TEXTURES,
  SPARK_TEXTURES,
} from "../particle-texture-registry.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";

/**
 * Muertes gráficas (GDD 6.8, tabla causa→efecto). Reutiliza el SISTEMA de
 * partículas ya establecido (mismos emisores/parámetros/paleta que el
 * fenómeno causante sobre estructura/componente), pero compone encima una
 * variante propia para el CUERPO del tripulante — decisión explícita del
 * operador: reutilizar la infraestructura, no el mismo resultado visual
 * literal, porque un tripulante debe leerse como algo distinto de un
 * componente destruido (principio 6: dos fenómenos nunca se ven igual, y eso
 * también vale entre "cosa" y "persona"). `crew-damaged` (herida no letal)
 * usa el mismo emisor base, sin la capa de variante de cuerpo.
 */

/**
 * Manchas de sangre PERSISTENTES sobre el suelo (pedido explícito del
 * operador, más allá del burst en el aire): un charco grande y duradero
 * exactamente en el punto de muerte (`BLOOD_POOL_TEXTURE`, ya trae un blob
 * central + gotas menores integradas) y varias gotas pequeñas dispersas
 * alrededor que se desvanecen antes que el charco.
 */
function bloodDecals(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnDecal(
    scene,
    px,
    py,
    BLOOD_POOL_TEXTURE,
    { radiusPx: 16, tint: 0x7a0f0f, alpha: 0.65, growMs: 250, holdMs: 9000, fadeMs: 6000 },
    RENDER_DEPTH.bloodDecal,
    onCreated,
  );
  const dropletCount = 5;
  for (let i = 0; i < dropletCount; i += 1) {
    const texture = BLOOD_TEXTURES[i % BLOOD_TEXTURES.length]!;
    const offsetX = spreadRange(20).min + Math.random() * (spreadRange(20).max - spreadRange(20).min);
    const offsetY = spreadRange(20).min + Math.random() * (spreadRange(20).max - spreadRange(20).min);
    spawnDecal(
      scene,
      px + offsetX,
      py + offsetY,
      texture,
      {
        radiusPx: 3 + Math.random() * 3,
        tint: 0x8a0f0f,
        alpha: 0.55,
        growMs: 80,
        holdMs: 3000 + Math.random() * 2000,
        fadeMs: 2500,
      },
      RENDER_DEPTH.bloodDecal,
      onCreated,
    );
  }
}

/** Salpicado de sangre en el aire (fuego/explosión/impacto cinético letal) — capa añadida sobre el burst base. */
function goreSplatter(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 500,
      speed: { min: 60, max: 160 },
      scale: { start: textureScale(16), end: textureScale(4) },
      quantity: 16,
      tint: 0x8a0f0f,
      x: spreadRange(10),
      y: spreadRange(10),
    },
    500,
    BLOOD_TEXTURES,
    onCreated,
  );
  bloodDecals(scene, px, py, onCreated);
}

/** Fragmentación en astillas de hielo (congelación letal) — sigue a la cristalización azulada. */
function frozenShatter(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 900,
      speed: { min: 5, max: 15 },
      scale: { start: textureScale(14), end: 0 },
      tint: 0xbfe8ff,
      quantity: 20,
      x: spreadRange(10),
      y: spreadRange(10),
    },
    900,
    CIRCLE_TEXTURES,
    onCreated,
  );
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 500,
      speed: { min: 40, max: 100 },
      scale: { start: textureScale(20), end: 0 },
      tint: 0xe4f7ff,
      quantity: 12,
      x: spreadRange(6),
      y: spreadRange(6),
    },
    500,
    CIRCLE_TEXTURES,
    onCreated,
  );
}

/** Disolución progresiva del sprite completo (corrosión letal), distinta de las picaduras de `structural-degraded-effect.ts`. */
function fullBodyDissolve(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 1100,
      speed: { min: 5, max: 25 },
      angle: { min: 260, max: 280 },
      scale: { start: textureScale(18), end: textureScale(42) },
      alpha: { start: 0.5, end: 0 },
      quantity: 22,
      frequency: 40,
      tint: 0x8fbf6a,
      x: spreadRange(10),
      y: spreadRange(14),
    },
    1100,
    SMOKE_TEXTURES,
    onCreated,
  );
}

/** Colapso rígido (electrocución letal), tras el arco eléctrico — caída sin control, sin animación de salto. */
function rigidCollapse(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 250,
      speed: { min: 80, max: 180 },
      scale: { start: textureScale(18), end: 0 },
      quantity: 10,
      tint: 0xf2d24b,
      x: spreadRange(6),
      y: spreadRange(6),
    },
    250,
    SPARK_TEXTURES,
    onCreated,
  );
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 400,
      speed: { min: 10, max: 30 },
      scale: { start: textureScale(24), end: textureScale(10) },
      tint: 0x3a3a3a,
      quantity: 8,
      x: spreadRange(4),
      y: spreadRange(4),
    },
    400,
    SMOKE_TEXTURES,
    onCreated,
  );
}

/**
 * Impacto de arma enemiga (Fase 11d.2) — chispazo de disparo/zarpazo
 * (naranja, distinto del amarillo de `rigidCollapse`) más el mismo charco de
 * sangre que el resto de causas físicas: distingue visualmente "me mató un
 * enemigo" de "me electrocutó el sistema" o "me quemé", sin duplicar el burst
 * genérico de `goreSplatter`. Placeholder mínimo — pulido de partículas por
 * arquetipo/arma (cuerpo a cuerpo vs. a distancia) queda para Fase 11d.3
 * cuando exista el enemigo visible en pantalla.
 */
function weaponStrike(scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook): void {
  spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 300,
      speed: { min: 70, max: 170 },
      scale: { start: textureScale(16), end: 0 },
      quantity: 12,
      tint: 0xff5522,
      x: spreadRange(8),
      y: spreadRange(8),
    },
    300,
    SPARK_TEXTURES,
    onCreated,
  );
  bloodDecals(scene, px, py, onCreated);
}

const DEATH_VARIANT_BY_CAUSE: Readonly<Record<CrewDamageCause, (scene: EffectScene, px: number, py: number, onCreated?: ObjectCreatedHook) => void>> = {
  fire: goreSplatter,
  explosion: goreSplatter,
  "kinetic-impact": goreSplatter,
  cold: frozenShatter,
  corrosion: fullBodyDissolve,
  electrocution: rigidCollapse,
  "enemy-attack": weaponStrike,
};

export const crewDeathEffect: EventDrivenEffect<"crew-death"> = {
  kind: "crew-death",
  trigger(scene, position: GridPosition, event: CrewDeathEvent, options): void {
    const { px, py } = toPixel(position);
    // Capa base: mismo burst rojo corto que ya usan combustión/impacto/etc. para "daño a tripulante".
    crewDamageFlash(scene, px, py, 16, options?.onObjectCreated);
    DEATH_VARIANT_BY_CAUSE[event.cause](scene, px, py, options?.onObjectCreated);
  },
};

export const crewDamagedEffect: EventDrivenEffect<"crew-damaged"> = {
  kind: "crew-damaged",
  trigger(scene, position: GridPosition, event: CrewDamagedEvent, options): void {
    const { px, py } = toPixel(position);
    crewDamageFlash(scene, px, py, event.hpLost > 0 ? 12 : 8, options?.onObjectCreated);
  },
};
