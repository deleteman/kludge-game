import type Phaser from "phaser";

import type { GridPosition, LightHook, ParticleEmitterHook, StateDrivenEffect } from "../particle-effect.types.js";
import { type EffectScene, pickTexture, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { SPARK_TEXTURES } from "../particle-texture-registry.js";
import {
  OVERLOADED_CONDUCTOR_LIGHT_COLOR,
  OVERLOADED_CONDUCTOR_LIGHT_RADIUS_PX,
  overloadedConductorFlickerIntensity,
} from "../../render/palette.js";
import { createDynamicLight } from "./dynamic-light.js";

/**
 * Cicatriz de "conductor/reservorio en cortocircuito" (Fase 12a,
 * `Blueprint.overloadedRefs`, `MissionOverloadRuntime`): chispas continuas +
 * luz aditiva parpadeante en la posición de la instancia. A diferencia de las
 * partículas state-driven de atmósfera (`atmosphere-state-effects.ts`, que
 * pueden apagarse si el estado deja de aplicar), esta es una cicatriz sin
 * retorno — una vez creada nunca se detiene (mismo criterio que
 * `redrawUnpoweredSectionScar`, "consecuencias permanentes", principio 5 de
 * CLAUDE.md), así que `update()` solo avanza el parpadeo, nunca apaga nada.
 */
export interface OverloadedConductorState {
  readonly elapsedSeconds: number;
}

export function createOverloadedConductorEffect(
  onEmitterCreated?: ParticleEmitterHook,
  onLightCreated?: LightHook,
): StateDrivenEffect<OverloadedConductorState> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  let light: Phaser.GameObjects.PointLight | undefined;

  return {
    start(s: EffectScene, position: GridPosition): void {
      scene = s;
      ({ px, py } = toPixel(position));
    },
    update(state: OverloadedConductorState): void {
      if (!scene) return;
      if (!emitter) {
        emitter = scene.add.particles(px, py, pickTexture(SPARK_TEXTURES), {
          lifespan: 220,
          speed: { min: 40, max: 110 },
          scale: { start: textureScale(9), end: 0 },
          quantity: 1,
          frequency: 160,
          tint: OVERLOADED_CONDUCTOR_LIGHT_COLOR,
          x: spreadRange(4),
          y: spreadRange(4),
        });
        onEmitterCreated?.(emitter);
      }
      if (!light) {
        light = createDynamicLight(
          scene,
          px,
          py,
          OVERLOADED_CONDUCTOR_LIGHT_COLOR,
          OVERLOADED_CONDUCTOR_LIGHT_RADIUS_PX,
          overloadedConductorFlickerIntensity(state.elapsedSeconds),
          onLightCreated,
        );
      }
      light.intensity = overloadedConductorFlickerIntensity(state.elapsedSeconds);
    },
    stop(): void {
      emitter?.destroy();
      emitter = undefined;
      light?.destroy();
      light = undefined;
    },
  };
}
