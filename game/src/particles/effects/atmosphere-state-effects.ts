import type Phaser from "phaser";

import type { GridPosition, ParticleEmitterHook, StateDrivenEffect } from "../particle-effect.types.js";
import { type EffectScene, pickTexture, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { CIRCLE_TEXTURES, SMOKE_TEXTURES } from "../particle-texture-registry.js";
import { THERMAL_SENSOR_TRIGGER_CELSIUS } from "engine";

/**
 * Tres fenómenos state-driven de GDD 11.1 leídos de `SectionAtmosphere` cada
 * frame (sin evento dedicado, mismo criterio que `conduit-flow-effect.ts`):
 * fuga de gas (concentración de un contaminante), congelación (temperatura
 * baja) y vapor por calor extremo (temperatura alta). Clasificar qué `GasKey`
 * es "tóxico" vs. "corrosivo" para el color de la nube requiere cruzar contra
 * el catálogo químico (Fase 4) — esa derivación es de quien llama a
 * `update()` (Fase 10), no de este archivo; aquí solo se pinta el estado ya
 * clasificado.
 *
 * Nota (CLAUDE.md, "avisar explícitamente cuando falte algo"): "derrame de
 * líquido" (otra fila de GDD 11.1) NO tiene gancho de motor todavía — no hay
 * ningún estado de líquido-en-piso modelado en `/engine` (solo gases en
 * `SectionAtmosphere`); implementarlo requeriría antes extender el motor,
 * fuera del alcance de `/game`. Queda señalado, no implementado en silencio.
 */

export interface GasCloudState {
  readonly concentration: number;
  readonly tint: number;
}

/**
 * Por debajo de esta concentración no se pinta nada (ronda 3 de fixes de 13e).
 * La difusión reparte trazas mínimas por toda la nave conexa a ~10%/s, así que
 * sin umbral una fuga en una sala terminaba encendiendo una nube en las ocho
 * secciones — ruido visual que ahoga la señal de dónde está el problema real.
 */
const CLOUD_VISIBILITY_THRESHOLD = 0.05;

/**
 * Velocidad a la que la nube MOSTRADA persigue a la concentración real, en
 * fracción por segundo. El motor puede saltar de 0 a 1 en un solo tick (un
 * reservorio que se vacía de golpe); sin este suavizado la nube aparecía
 * instantáneamente a pleno, en vez de expandirse. No altera el estado del
 * motor: es solo cómo se dibuja.
 */
const CLOUD_RAMP_PER_SECOND = 0.6;

export function createGasLeakEffect(onEmitterCreated?: ParticleEmitterHook): StateDrivenEffect<GasCloudState> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  /** Concentración que se está DIBUJANDO, persiguiendo a la real con retardo. */
  let shown = 0;

  return {
    start(s: EffectScene, position: GridPosition): void {
      scene = s;
      ({ px, py } = toPixel(position));
      shown = 0;
    },
    update(state: GasCloudState, deltaSeconds = 1 / 60): void {
      if (!scene) return;
      const target = state.concentration > CLOUD_VISIBILITY_THRESHOLD ? state.concentration : 0;
      // Persecución exponencial: sube y baja gradualmente, y nunca de un salto.
      const step = Math.min(1, CLOUD_RAMP_PER_SECOND * deltaSeconds);
      shown += (target - shown) * step;
      if (shown <= 0.01) {
        shown = 0;
        emitter?.stop();
        return;
      }
      const quantity = Math.max(1, Math.round(shown * 12));
      // La opacidad también acompaña: con solo `quantity`, una nube naciente y
      // una saturada se veían igual de densas y el crecimiento no se leía. Va
      // en el alpha del EMISOR (multiplica al de cada partícula) y no en el op
      // `alpha` del config, que solo admite número y borraría el desvanecido.
      const opacity = 0.25 + Math.min(1, shown) * 0.75;
      if (!emitter) {
        const radius = 6 + shown * 20;
        // Config COMPLETO en la creación (fix 11f.4): incluye `quantity`/`tint`/
        // `x`/`y` para NO depender de un `setConfig` posterior, que recarga
        // todos los ops del emisor y deja los ausentes (`scale`/`speed`/
        // `lifespan`) en su default (scale 1 → partículas de 512px, speed 0 →
        // inmóviles) — la causa de que la nube fuera invisible. Sin `frequency`
        // (= 0) el emisor emite cada frame, como antes.
        emitter = scene.add.particles(px, py, pickTexture(SMOKE_TEXTURES), {
          lifespan: 1000,
          speed: { min: 5, max: 15 },
          scale: { start: textureScale(16), end: textureScale(40) },
          alpha: { start: 0.35, end: 0 },
          quantity,
          tint: state.tint,
          x: spreadRange(radius),
          y: spreadRange(radius),
        });
        emitter.setAlpha(opacity);
        onEmitterCreated?.(emitter);
        return;
      }
      if (!emitter.emitting) emitter.start();
      // Densidad, opacidad y color se actualizan con setters puntuales (nunca
      // `setConfig`, que borraría el resto de ops). El radio de dispersión queda
      // fijo al de creación: no hay setter tipado para los ops x/y y no
      // justifica un cast por un matiz.
      emitter.setQuantity(quantity);
      emitter.setAlpha(opacity);
      emitter.setParticleTint(state.tint);
    },
    stop(): void {
      emitter?.destroy();
      emitter = undefined;
    },
  };
}

const FREEZING_THRESHOLD_CELSIUS = -10;
/**
 * Subfase 14a-1: el vapor de calor aparece exactamente cuando dispara el
 * sensor térmico, y por eso importa SU constante en vez de repetir el 60.
 * Hasta acá los dos números coincidían por casualidad y nada impedía que se
 * separaran en el próximo balanceo — la UI mostrando un umbral y el motor
 * usando otro es la clase de mentira visual que el principio 6 prohíbe: si el
 * jugador ve vapor, el sensor está disparado, y al revés.
 */
const HEAT_VAPOR_THRESHOLD_CELSIUS = THERMAL_SENSOR_TRIGGER_CELSIUS;

export function createFreezingEffect(
  onEmitterCreated?: ParticleEmitterHook,
): StateDrivenEffect<{ temperatureCelsius: number }> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;

  return {
    start(s: EffectScene, position: GridPosition): void {
      scene = s;
      ({ px, py } = toPixel(position));
    },
    update(state: { temperatureCelsius: number }): void {
      if (!scene) return;
      if (state.temperatureCelsius > FREEZING_THRESHOLD_CELSIUS) {
        emitter?.stop();
        return;
      }
      if (!emitter) {
        emitter = scene.add.particles(px, py, pickTexture(CIRCLE_TEXTURES), {
          lifespan: 900,
          speed: { min: 2, max: 8 },
          scale: { start: textureScale(10), end: 0 },
          tint: 0xbfe8ff,
          quantity: 3,
          frequency: 100,
          x: spreadRange(10),
          y: spreadRange(10),
        });
        onEmitterCreated?.(emitter);
      }
      emitter.start();
    },
    stop(): void {
      emitter?.destroy();
      emitter = undefined;
    },
  };
}

export function createHeatVaporEffect(
  onEmitterCreated?: ParticleEmitterHook,
): StateDrivenEffect<{ temperatureCelsius: number }> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;

  return {
    start(s: EffectScene, position: GridPosition): void {
      scene = s;
      ({ px, py } = toPixel(position));
    },
    update(state: { temperatureCelsius: number }): void {
      if (!scene) return;
      if (state.temperatureCelsius < HEAT_VAPOR_THRESHOLD_CELSIUS) {
        emitter?.stop();
        return;
      }
      if (!emitter) {
        emitter = scene.add.particles(px, py, pickTexture(SMOKE_TEXTURES), {
          lifespan: 700,
          speed: { min: 8, max: 20 },
          angle: { min: 260, max: 280 },
          scale: { start: textureScale(16), end: textureScale(30) },
          alpha: { start: 0.3, end: 0 },
          tint: 0xf0f0f0,
          quantity: 4,
          frequency: 80,
          x: spreadRange(8),
          y: spreadRange(4),
        });
        onEmitterCreated?.(emitter);
      }
      emitter.start();
    },
    stop(): void {
      emitter?.destroy();
      emitter = undefined;
    },
  };
}
