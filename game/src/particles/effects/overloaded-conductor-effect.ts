import type Phaser from "phaser";

import type {
  EffectArea,
  GridPosition,
  LightHook,
  ParticleEmitterHook,
  StateDrivenEffect,
} from "../particle-effect.types.js";
import { type EffectScene, pickTexture, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { SPARK_TEXTURES } from "../particle-texture-registry.js";
import {
  OVERLOADED_CONDUCTOR_LIGHT_COLOR,
  OVERLOADED_CONDUCTOR_LIGHT_RADIUS_PX,
  OVERLOADED_SPARK_CORE_COLOR,
  overloadedConductorFlickerIntensity,
} from "../../render/palette.js";
import { sectionEmitZone } from "./atmosphere-effect-coverage.js";
import { createDynamicLight } from "./dynamic-light.js";

/** Ver el homónimo de `atmosphere-state-effects.ts`: con zona de emisión el emisor va en (0,0), porque la zona devuelve coordenadas de mundo. */
function emitterOrigin(px: number, py: number, area: EffectArea | undefined): [number, number] {
  return area ? [0, 0] : [px, py];
}

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
  let area: EffectArea | undefined;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  let light: Phaser.GameObjects.PointLight | undefined;

  return {
    start(s: EffectScene, position: GridPosition, footprintArea?: EffectArea): void {
      scene = s;
      ({ px, py } = toPixel(position));
      // El `area` acá son las celdas del FOOTPRINT de la pieza, no las de una
      // sección — es el mismo mecanismo de cobertura que usan los efectos de
      // atmósfera, aplicado a una superficie mucho más chica. La luz sigue
      // yendo en `position`: es un punto de emisión, no una superficie.
      area = footprintArea;
    },
    update(state: OverloadedConductorState): void {
      if (!scene) return;
      if (!emitter) {
        // Ronda 1 de playtest de 14a-2: "el brillo sube y baja, ¿qué
        // representa? No veo chispas continuas, ¿la luz las tapa?".
        //
        // La luz NO puede taparlas: vive en `dynamicLight` (1.8) y las chispas
        // en `effect` (7), o sea que van encima. Las tres causas reales, y su
        // arreglo:
        //
        //  (a) CONTRASTE. Chispa y luz usaban el MISMO tint exacto, así que la
        //      chispa no tenía contra qué destacar dentro de su propio glow
        //      ámbar. Ahora el núcleo es casi blanco: es lo que la hace visible
        //      DENTRO de la luz, no a pesar de ella.
        //  (b) CONTINUIDAD. `quantity: 1` cada 240 ms con `lifespan: 200`
        //      dejaba 40 ms de cada 240 sin NINGUNA partícula viva — el efecto
        //      literalmente desaparecía a ratos. La frecuencia pasa a estar
        //      cómodamente por debajo de la vida, así que siempre hay varias.
        //  (c) EXTENSIÓN. Estaban confinadas a ±4 px dentro de un glow de 64 px
        //      de radio: un punto en el medio de una mancha de luz. Ahora se
        //      reparten por el footprint REAL de la pieza, así que el arco
        //      recorre el objeto que se quemó.
        //
        // Y el hallazgo de la ronda previa —"se atenuaron porque el glow tapaba
        // el campo de luz"— no se reintroduce, porque lo que lo causaba era la
        // DENSIDAD por píxel, no la cantidad total: repartir las chispas sobre
        // el footprint en vez de apilarlas en un punto baja esa densidad aunque
        // suba el conteo. Se mantienen además pequeñas (scale ↓ respecto de
        // aquella versión) y no aditivas.
        emitter = scene.add.particles(...emitterOrigin(px, py, area), pickTexture(SPARK_TEXTURES), {
          lifespan: 300,
          speed: { min: 30, max: 90 },
          scale: { start: textureScale(5), end: 0 },
          alpha: { start: 0.9, end: 0 },
          quantity: 1,
          frequency: 90,
          tint: OVERLOADED_SPARK_CORE_COLOR,
          ...(area ? { emitZone: sectionEmitZone(area) } : { x: spreadRange(4), y: spreadRange(4) }),
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
