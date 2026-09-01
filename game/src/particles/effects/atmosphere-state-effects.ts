import type Phaser from "phaser";

import type { EffectArea, GridPosition, ParticleEmitterHook, StateDrivenEffect } from "../particle-effect.types.js";
import { type EffectScene, pickTexture, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { CIRCLE_TEXTURES, SMOKE_TEXTURES } from "../particle-texture-registry.js";
import { HAZARD_PARAMETERS, TEMPERATURE_CEILING_CELSIUS, TEMPERATURE_FLOOR_CELSIUS } from "engine";
import { coverageQuantity, sectionEmitZone, thresholdSeverity } from "./atmosphere-effect-coverage.js";

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
 * Origen del emisor. Con cobertura de sección va en (0,0) porque
 * `sectionEmitZone` devuelve coordenadas de MUNDO y Phaser las suma a la
 * posición del emisor; sin ella, en el punto de siempre.
 */
function emitterOrigin(px: number, py: number, area: EffectArea | undefined): [number, number] {
  return area ? [0, 0] : [px, py];
}

/**
 * Dispersión de las partículas: la sección entera si el llamador pasó sus
 * celdas, el radio puntual de antes si no.
 *
 * El fallback no es una concesión: la galería de partículas (Fase 8) y los
 * tests instancian estos efectos sin ninguna sección detrás, y romperlos para
 * arreglar la partida sería cambiar un problema por otro.
 */
function spread(area: EffectArea | undefined, radiusPx: number): Record<string, unknown> {
  return area ? { emitZone: sectionEmitZone(area) } : { x: spreadRange(radiusPx), y: spreadRange(radiusPx) };
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
  let area: EffectArea | undefined;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  /** Concentración que se está DIBUJANDO, persiguiendo a la real con retardo. */
  let shown = 0;

  return {
    start(s: EffectScene, position: GridPosition, sectionArea?: EffectArea): void {
      scene = s;
      ({ px, py } = toPixel(position));
      area = sectionArea;
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
      // La nube ya escalaba con la concentración; lo que se agrega en 14a-2 es
      // que además escale con el ÁREA y se reparta por las celdas reales de la
      // sección, igual que sus dos hermanos. Sin `area` (galería de partículas,
      // tests) cae al comportamiento puntual de antes.
      const quantity = area ? coverageQuantity(area.cells.length, shown) : Math.max(1, Math.round(shown * 12));
      // La opacidad también acompaña: con solo `quantity`, una nube naciente y
      // una saturada se veían igual de densas y el crecimiento no se leía. Va
      // en el alpha del EMISOR (multiplica al de cada partícula) y no en el op
      // `alpha` del config, que solo admite número y borraría el desvanecido.
      const opacity = 0.25 + Math.min(1, shown) * 0.75;
      if (!emitter) {
        // Config COMPLETO en la creación (fix 11f.4): incluye `quantity`/`tint`
        // y la zona para NO depender de un `setConfig` posterior, que recarga
        // todos los ops del emisor y deja los ausentes (`scale`/`speed`/
        // `lifespan`) en su default (scale 1 → partículas de 512px, speed 0 →
        // inmóviles) — la causa de que la nube fuera invisible. Sin `frequency`
        // (= 0) el emisor emite cada frame, como antes.
        emitter = scene.add.particles(...emitterOrigin(px, py, area), pickTexture(SMOKE_TEXTURES), {
          lifespan: 1000,
          speed: { min: 5, max: 15 },
          scale: { start: textureScale(16), end: textureScale(40) },
          alpha: { start: 0.35, end: 0 },
          quantity,
          tint: state.tint,
          ...spread(area, 6 + shown * 20),
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

/**
 * Umbral de la escarcha, ronda 1 de playtest de 14a-2: pasa del umbral de la
 * ESTRUCTURA (-40) al del TRIPULANTE (-10).
 *
 * 14a-2 lo había atado al daño estructural con el argumento correcto —que un
 * umbral visual suelto se separa del motor en el próximo balanceo— pero eligió
 * el umbral equivocado de los que existen. La escarcha es la señal de "no
 * entres acá", no de "el casco se está partiendo", y con -40 la sala mataba a
 * un tripulante durante 30 °C enteros sin mostrar absolutamente nada.
 *
 * Ahora **ver escarcha = esta sala mata**, exactamente, por los dos lados: el
 * vapor de calor ya coincidía con el umbral caliente desde 14a-1.
 */
const FREEZING_THRESHOLD_CELSIUS = HAZARD_PARAMETERS.thermal.coldOnsetCelsius;
/**
 * Subfase 14a-1: el vapor de calor aparece exactamente cuando dispara el
 * sensor térmico, y por eso importa una constante en vez de repetir el 60.
 * Hasta acá los dos números coincidían por casualidad y nada impedía que se
 * separaran en el próximo balanceo — la UI mostrando un umbral y el motor
 * usando otro es la clase de mentira visual que el principio 6 prohíbe: si el
 * jugador ve vapor, el sensor está disparado, y al revés. Ronda 1 de 14a-2:
 * pasa a leerse de `HAZARD_PARAMETERS.thermal`, que ES el disparo del sensor
 * (hay un test que lo fija) y además el umbral de daño a la tripulación — un
 * solo número para los tres.
 */
const HEAT_VAPOR_THRESHOLD_CELSIUS = HAZARD_PARAMETERS.thermal.hotOnsetCelsius;

export function createFreezingEffect(
  onEmitterCreated?: ParticleEmitterHook,
): StateDrivenEffect<{ temperatureCelsius: number }> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let area: EffectArea | undefined;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;

  return {
    start(s: EffectScene, position: GridPosition, sectionArea?: EffectArea): void {
      scene = s;
      ({ px, py } = toPixel(position));
      area = sectionArea;
    },
    update(state: { temperatureCelsius: number }): void {
      if (!scene) return;
      if (state.temperatureCelsius > FREEZING_THRESHOLD_CELSIUS) {
        emitter?.stop();
        return;
      }
      // Severidad, no on/off: la escarcha era binaria de tamaño fijo mientras
      // su hermano `gasLeak` ya escalaba con la concentración. Se unifican al
      // criterio del que lo hacía bien — a -12 °C apenas escarcha, a -70 la
      // sala está tomada.
      const severity = thresholdSeverity(
        state.temperatureCelsius,
        FREEZING_THRESHOLD_CELSIUS,
        TEMPERATURE_FLOOR_CELSIUS,
      );
      const quantity = area ? coverageQuantity(area.cells.length, severity) : 3;
      if (!emitter) {
        emitter = scene.add.particles(...emitterOrigin(px, py, area), pickTexture(CIRCLE_TEXTURES), {
          lifespan: 900,
          speed: { min: 2, max: 8 },
          scale: { start: textureScale(10), end: 0 },
          tint: 0xbfe8ff,
          quantity,
          frequency: 100,
          ...spread(area, 10),
        });
        onEmitterCreated?.(emitter);
      }
      emitter.setQuantity(quantity);
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
  let area: EffectArea | undefined;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;

  return {
    start(s: EffectScene, position: GridPosition, sectionArea?: EffectArea): void {
      scene = s;
      ({ px, py } = toPixel(position));
      area = sectionArea;
    },
    update(state: { temperatureCelsius: number }): void {
      if (!scene) return;
      if (state.temperatureCelsius < HEAT_VAPOR_THRESHOLD_CELSIUS) {
        emitter?.stop();
        return;
      }
      // Mismo criterio que la escarcha, del otro lado del eje: el rango es
      // enorme (60 → 900 °C), así que sin escalado un incendio y una sala
      // templada de más se veían idénticos.
      const severity = thresholdSeverity(
        state.temperatureCelsius,
        HEAT_VAPOR_THRESHOLD_CELSIUS,
        TEMPERATURE_CEILING_CELSIUS,
      );
      const quantity = area ? coverageQuantity(area.cells.length, severity) : 4;
      if (!emitter) {
        emitter = scene.add.particles(...emitterOrigin(px, py, area), pickTexture(SMOKE_TEXTURES), {
          lifespan: 700,
          speed: { min: 8, max: 20 },
          angle: { min: 260, max: 280 },
          scale: { start: textureScale(16), end: textureScale(30) },
          alpha: { start: 0.3, end: 0 },
          tint: 0xf0f0f0,
          quantity,
          frequency: 80,
          ...spread(area, 8),
        });
        onEmitterCreated?.(emitter);
      }
      emitter.setQuantity(quantity);
      emitter.start();
    },
    stop(): void {
      emitter?.destroy();
      emitter = undefined;
    },
  };
}
