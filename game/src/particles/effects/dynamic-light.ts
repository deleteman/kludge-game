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
