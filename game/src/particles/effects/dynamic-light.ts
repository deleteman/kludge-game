import type Phaser from "phaser";

import type { LightHook } from "../particle-effect.types.js";

/**
 * Sistema de luces aditivas dinámicas (Fase 12a). Generaliza el único
 * precedente existente en el proyecto (`combustion-effect.ts`, un
 * `scene.add.pointlight` con tween de intensidad, burst temporal) a un helper
 * reusable tanto para bursts (`EventDrivenEffect`) como para luz persistente
 * (`StateDrivenEffect`, ej. chispas de conductor sobrecargado, ambientación de
 * sección sin energía) — no requiere ningún setup previo de escena (`PointLight`
 * es un GameObject autocontenido, no depende del pipeline `Light2D`).
 */
export function createDynamicLight(
  scene: Phaser.Scene,
  px: number,
  py: number,
  color: number,
  radiusPx: number,
  intensity: number,
  hook?: LightHook,
): Phaser.GameObjects.PointLight {
  const light = scene.add.pointlight(px, py, color, radiusPx, intensity);
  hook?.(light);
  return light;
}

export interface BurstLightSpec {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly radiusPx: number;
  /** Parpadeo mientras el fenómeno está activo: `from`↔`to` con tween yoyo. */
  readonly flicker: { readonly from: number; readonly to: number; readonly halfCycleMs: number };
  /** Cuánto dura el parpadeo, en ms. */
  readonly sustainMs: number;
  /** Desvanecido hasta 0 al terminar el parpadeo, en ms. Es lo que evita el corte seco. */
  readonly fadeMs: number;
}

/**
 * Luz de BURST con ciclo de vida completo: parpadeo → desvanecido → destrucción
 * (12d.7).
 *
 * Es la mitad que faltaba de este módulo. El docblock de arriba dice que
 * generaliza el patrón "tanto para bursts como para luz persistente", pero solo
 * se llegó a escribir la persistente: los dos bursts que existen
 * (`combustion-effect.ts` y el arco de `environmental-damage-effect.ts`)
 * copiaron el patrón a mano y los dos quedaron con el mismo agujero — un tween
 * de parpadeo con `repeat` finito, que al terminar deja la luz QUIETA en su
 * valor `from`, y un `delayedCall` que la destruye mucho después de un frame al
 * otro. Reportado por el operador en el playtest de 12d.6: "deja una luz que
 * luego desaparece de golpe, no se desvanece".
 *
 * Desde 12d.5 el corte además arrastra la SOMBRA: estas luces se registran en
 * la capa de sombras (`registerBurstLight`), así que al desaparecer de golpe la
 * oscuridad del suelo también volvía de un frame al otro.
 *
 * Las tres fases se encadenan por `onComplete` y no por aritmética de tiempos:
 * dos tweens sobre la MISMA propiedad (`intensity`) se pelean si se solapan, y
 * arrancar el fade con un `delayedCall` calculado a mano es justamente la forma
 * de que se solapen cuando alguien cambie una duración.
 */
export function createBurstLight(
  scene: Phaser.Scene,
  spec: BurstLightSpec,
  hook?: LightHook,
): Phaser.GameObjects.PointLight {
  const light = createDynamicLight(
    scene,
    spec.x,
    spec.y,
    spec.color,
    spec.radiusPx,
    spec.flicker.from,
    hook,
  );

  scene.tweens.add({
    targets: light,
    intensity: { from: spec.flicker.from, to: spec.flicker.to },
    duration: spec.flicker.halfCycleMs,
    yoyo: true,
    repeat: Math.ceil(spec.sustainMs / (spec.flicker.halfCycleMs * 2)),
    onComplete: () => {
      if (!light.active) return;
      scene.tweens.add({
        targets: light,
        intensity: 0,
        duration: spec.fadeMs,
        onComplete: () => {
          // La escena pudo cerrarse entre medio (al cerrar la misión Phaser mata
          // los tweens, pero el objeto puede haber sido destruido por otra vía).
          if (light.active) light.destroy();
        },
      });
    },
  });

  return light;
}
