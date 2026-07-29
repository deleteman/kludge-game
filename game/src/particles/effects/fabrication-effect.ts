import type Phaser from "phaser";

import type { GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import {
  CIRCLE_TEXTURES,
  FLARE_TEXTURE,
  SMOKE_TEXTURES,
  SPARK_TEXTURES,
} from "../particle-texture-registry.js";

/**
 * Efectos de acciones de tripulación (playtest #11/#12): instalar y desmontar
 * antes no producían NINGÚN feedback de partículas, solo el anillo de
 * "trabajando" — la acción ocurría sin verse. No son `DomainEvent` del motor
 * (son eventos de core loop `task-started`/`task-completed`), así que no van en
 * `effect-registry.ts`; la escena los dispara directo.
 *
 * Corren MIENTRAS dura la acción (emisión continua durante `durationMs`, no un
 * burst puntual al terminar — playtest #12): reciben la duración estimada de la
 * tarea y emiten a lo largo de ella; `spawnBurst` detiene el emisor al vencer
 * ese tiempo y lo destruye cuando sus últimas partículas se apagan.
 *
 * Deben verse CLARAMENTE distintos entre sí (principio 6 CLAUDE.md): instalar es
 * energético/ascendente/frío (chispas cian + destellos); desmontar es sucio/
 * disperso/cálido apagado (escombros marrones + polvo gris).
 *
 * Devuelven los emisores creados para que el llamador los marque como objetos de
 * mundo y fije su profundidad (la escena de misión tiene doble cámara —
 * `floorplan-scene.ts`; sin `hudCamera.ignore` el burst se duplicaría sobre el
 * HUD).
 */
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Montaje de una pieza: chorro continuo de chispas cian/blancas en arco hacia arriba + destellos periódicos, durante toda la acción. */
export function installEffect(scene: Phaser.Scene, position: GridPosition, durationMs: number): Emitter[] {
  const { px, py } = toPixel(position);

  const sparks = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 420,
      speed: { min: 50, max: 130 },
      angle: { min: 200, max: 340 }, // arco hacia arriba (270 = arriba en pantalla)
      gravityY: 280,
      scale: { start: textureScale(7), end: 0 },
      alpha: { start: 1, end: 0.2 },
      quantity: 3,
      frequency: 45,
      tint: [0x9ff2ff, 0xffffff, 0x66d4ff],
      x: spreadRange(6),
      y: spreadRange(6),
    },
    durationMs,
    SPARK_TEXTURES,
  );

  const flashes = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 280,
      speed: 0,
      scale: { start: textureScale(6), end: textureScale(34) },
      alpha: { start: 0.55, end: 0 },
      quantity: 1,
      frequency: 320,
      tint: 0xcffcff,
    },
    durationMs,
    FLARE_TEXTURE,
  );

  return [sparks, flashes];
}

/**
 * Desmontaje de una pieza (12c.7, obs #3/#4): en vez de escombros marrones
 * apagados, "bolas de energía" — orbes brillantes cian/dorados que salen
 * disparados radialmente con blend aditivo (glow), chispas rápidas y una tenue
 * nube de humo para dar peso. Se ve satisfactorio tanto en el desmontaje de un
 * compuesto como de una pieza atómica (ambas ahora recuperan piezas al stock).
 * La "luz" energética que pidió el playtest va sobre las fichas coleccionables
 * que vuelan hacia la mesa (`fireCollectibleToWorkbench`), no sobre este efecto
 * de proceso.
 */
export function dismantleEffect(
  scene: Phaser.Scene,
  position: GridPosition,
  durationMs: number,
): Emitter[] {
  const { px, py } = toPixel(position);

  const orbs = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 620,
      speed: { min: 60, max: 150 },
      angle: { min: 0, max: 360 }, // radial
      gravityY: 60,
      scale: { start: textureScale(11), end: textureScale(2) },
      alpha: { start: 1, end: 0 },
      quantity: 3,
      frequency: 55,
      blendMode: "ADD",
      tint: [0x9ff2ff, 0xffe27a, 0xffffff, 0x66d4ff],
      x: spreadRange(5),
      y: spreadRange(5),
    },
    durationMs,
    CIRCLE_TEXTURES,
  );

  const sparks = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 380,
      speed: { min: 90, max: 210 },
      angle: { min: 0, max: 360 },
      scale: { start: textureScale(6), end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 2,
      frequency: 70,
      blendMode: "ADD",
      tint: [0xffffff, 0x9ff2ff, 0xffe27a],
      x: spreadRange(4),
      y: spreadRange(4),
    },
    durationMs,
    SPARK_TEXTURES,
  );

  const smoke = spawnBurst(
    scene,
    px,
    py,
    {
      lifespan: 640,
      speed: { min: 8, max: 22 },
      angle: { min: 250, max: 290 },
      scale: { start: textureScale(9), end: textureScale(22) },
      alpha: { start: 0.22, end: 0 },
      quantity: 1,
      frequency: 120,
      tint: 0x334155,
      x: spreadRange(7),
      y: spreadRange(5),
    },
    durationMs,
    SMOKE_TEXTURES,
  );

  return [orbs, sparks, smoke];
}
