import Phaser from "phaser";
import type { CrewDamageCause } from "engine";

import { type EffectScene, spawnBurst, spreadRange, textureScale } from "../particle-utils.js";
import { FLARE_TEXTURE, SPARK_TEXTURES } from "../particle-texture-registry.js";
import { createBurstLight } from "./dynamic-light.js";

/**
 * Daño AMBIENTAL sobre un tripulante — el entorno lo ataca (a diferencia de las
 * "muertes gráficas" de `crew-death-effect.ts`, que componen sobre el CUERPO).
 * Es una CATEGORÍA extensible: hoy implementa la electrocución (arco desde una
 * pared cercana), y `fireEnvironmentalDamage` deja el punto de extensión para
 * futuras causas del entorno (fuga de gas tóxico, salpicadura corrosiva, etc.).
 *
 * Todos los constructores DEVUELVEN los objetos creados para que el llamador
 * (la escena) les fije `depth` y los marque como objetos de MUNDO
 * (`markAsWorldObject`) — sin eso, un objeto no asignado a cámara renderiza en
 * las dos cámaras (mundo + HUD) en coordenadas distintas y "salta" por la
 * pantalla.
 */

/** Objeto de efecto ambiental: GameObject con componente de profundidad (Graphics/emisor de partículas/luz). */
export type EnvironmentalEffectObject =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Particles.ParticleEmitter
  | Phaser.GameObjects.PointLight;

const ARC_COLOR = 0x3d8bff;
const ARC_CORE_COLOR = 0xcfe6ff;
const ARC_SPARK_COLOR = 0x6fb4ff;
const ARC_STRIKES = 3;
const ARC_STRIKE_MS = 90;

/** Punto medio quebrado entre `a` y `b`, desplazado perpendicular un `jitter` aleatorio (rayo eléctrico). */
function jaggedPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segments: number,
  jitter: number,
): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // Vector perpendicular unitario para desplazar los vértices intermedios.
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i <= segments; i += 1) {
    const p = i / segments;
    const offset = i === 0 || i === segments ? 0 : (Math.random() * 2 - 1) * jitter;
    points.push(new Phaser.Math.Vector2(ax + dx * p + nx * offset, ay + dy * p + ny * offset));
  }
  return points;
}

/**
 * Arco eléctrico que se estira desde `origin` (un punto de pared cercano) hasta
 * `target` (el tripulante), con varios golpes rápidos que re-randomizan el
 * trazo, + un burst de chispas en el impacto. Devuelve el `Graphics` del rayo y
 * el emisor de chispas para que la escena los ancle a la cámara de mundo.
 */
export function electricArcEffect(
  scene: EffectScene,
  target: { x: number; y: number },
  origin: { x: number; y: number },
): EnvironmentalEffectObject[] {
  const graphics = scene.add.graphics();
  const segments = Math.max(4, Math.round(Math.hypot(target.x - origin.x, target.y - origin.y) / 18));

  const drawStrike = (): void => {
    const points = jaggedPoints(origin.x, origin.y, target.x, target.y, segments, 9);
    graphics.clear();
    // Halo azul ancho + núcleo celeste brillante para que el rayo "brille" eléctrico.
    graphics.lineStyle(7, ARC_COLOR, 0.28);
    graphics.strokePoints(points);
    graphics.lineStyle(4, ARC_COLOR, 0.55);
    graphics.strokePoints(points);
    graphics.lineStyle(2, ARC_CORE_COLOR, 0.95);
    graphics.strokePoints(points);
  };

  drawStrike();
  let strike = 1;
  const timer = scene.time.addEvent({
    delay: ARC_STRIKE_MS,
    repeat: ARC_STRIKES - 1,
    callback: () => {
      strike += 1;
      if (strike > ARC_STRIKES) {
        graphics.destroy();
        return;
      }
      drawStrike();
    },
  });
  // Barrido de fundido tras el último golpe, y limpieza garantizada.
  scene.time.delayedCall(ARC_STRIKE_MS * ARC_STRIKES, () => {
    timer.remove();
    scene.tweens.add({ targets: graphics, alpha: 0, duration: 140, onComplete: () => graphics.destroy() });
  });

  // Chispas en el punto de impacto (tripulante).
  const sparks = spawnBurst(
    scene,
    target.x,
    target.y,
    {
      lifespan: 300,
      speed: { min: 70, max: 170 },
      scale: { start: textureScale(14), end: 0 },
      quantity: 12,
      tint: ARC_SPARK_COLOR,
      x: spreadRange(5),
      y: spreadRange(5),
    },
    260,
    SPARK_TEXTURES,
  );
  // Destello puntual en el impacto.
  const flash = spawnBurst(
    scene,
    target.x,
    target.y,
    {
      lifespan: 180,
      speed: { min: 0, max: 10 },
      scale: { start: textureScale(26), end: 0 },
      alpha: { start: 0.8, end: 0 },
      quantity: 1,
      tint: ARC_CORE_COLOR,
    },
    180,
    FLARE_TEXTURE,
  );

  // Luz aditiva en el impacto (Fase 12a, corrección post-playtest): mismo
  // patrón de burst con tween de intensidad que `combustion-effect.ts`, vida
  // corta acorde a la duración total del arco (`ARC_STRIKES * ARC_STRIKE_MS`).
  // Intensidad/radio bajos A PROPÓSITO (2ª corrección, mismo playtest): la
  // primera versión (radio 60, intensidad hasta 1) tapaba el rayo y las
  // chispas del propio arco — la luz debe acompañar el fenómeno, no taparlo.
  // 12d.7: mismo corte seco que tenía la combustión (parpadeo + destroy sin
  // desvanecido). Acá se notaba menos porque el corte era desde 0.15, pero es
  // el mismo defecto y se arregla con el mismo helper.
  const totalArcMs = ARC_STRIKES * ARC_STRIKE_MS;
  const light = createBurstLight(scene, {
    x: target.x,
    y: target.y,
    color: ARC_CORE_COLOR,
    radiusPx: 26,
    flicker: { from: 0.15, to: 0.35, halfCycleMs: 60 },
    sustainMs: totalArcMs,
    fadeMs: 200,
  });

  return [graphics, sparks, flash, light];
}

/**
 * Dispatcher de daño ambiental por causa. Hoy solo `electrocution` tiene un
 * fenómeno propio (arco desde la pared); el resto de causas no son "ambientales"
 * (van por `crew-death-effect.ts`) y se ignoran acá. Extensión futura: sumar
 * `corrosion`/tóxico → nube/salpicadura desde la fuente, con su propio contexto.
 */
export function fireEnvironmentalDamage(
  scene: EffectScene,
  cause: CrewDamageCause,
  target: { x: number; y: number },
  context: { readonly origin: { x: number; y: number } },
): EnvironmentalEffectObject[] {
  if (cause === "electrocution") {
    return electricArcEffect(scene, target, context.origin);
  }
  return [];
}
