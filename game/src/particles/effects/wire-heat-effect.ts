import type Phaser from "phaser";

import type {
  EffectArea,
  GridPosition,
  ParticleEmitterHook,
  StateDrivenEffect,
} from "../particle-effect.types.js";
import { type EffectScene, pickTexture, textureScale, toPixel } from "../particle-utils.js";
import { CIRCLE_TEXTURES } from "../particle-texture-registry.js";
import {
  coverageQuantity,
  emitterOrigin,
  sectionCoverageSpread,
  thresholdSeverity,
} from "./atmosphere-effect-coverage.js";
import { HEAT_VAPOR_TINT } from "../../render/palette.js";

/**
 * Un cable CALENTÁNDOSE (ronda 1 de playtest de 14a-3).
 *
 * Pedido explícito del operador al aprobar que el conductor disipe calor: *"en
 * el caso de los cables, cuando vayan levantando temp, debe haber un indicador
 * visual"*.
 *
 * **Canal propio, no un segundo color.** El tinte del cable ya tiene dueño desde
 * 14a-4 (`wireLoadColor`, por su carga) y el calor se DERIVA de esa misma carga,
 * así que un segundo escritor de color solo podría contradecirlo o pintar dos
 * veces lo mismo (patrón 16). Estas partículas son la señal nueva, y el número
 * exacto vive en el tooltip del cable — un color es una alerta, la lectura es el
 * número (patrón 66).
 *
 * **Distinto en FORMA de la cicatriz del cable quemado**, que es ámbar, estática
 * y direccional: esto ASCIENDE y se desvanece, porque describe un cable que está
 * trabajando, no uno que ya se cortó (patrón 73 — dos estados del mismo objeto se
 * distinguen por forma, no por menos presencia).
 *
 * Se pinta sobre las celdas del CUERPO del cable, nunca las de sus extremos: ahí
 * están las piezas que une, y el jugador atribuye lo que ve a lo que hay debajo
 * (la lección de la ronda 3 de 14a-4, cuando el chip parecía roto por la
 * cicatriz de su propio cable).
 */

/**
 * Por debajo de esta disipación no se pinta nada.
 *
 * **El número sale de lo que significa, no de lo que se ve bien**: es la tasa
 * sostenida que hace falta para levantar una sala 10 °C sobre el nominal. Por
 * debajo de eso el cable calienta, sí, pero nada de lo que el jugador pueda hacer
 * depende de saberlo — y pintar cada cable de la nave con chispas de calor sería
 * el ruido que ahoga la señal, el mismo criterio con que
 * `CLOUD_VISIBILITY_THRESHOLD` filtra las trazas de gas.
 *
 * **Medido, no despejado** (ronda 2 de playtest de 14a-3): la ronda 1 lo escribió
 * como `10 × PASSIVE_DRIFT_PER_SECOND` = 0.5, despejando de la fórmula de
 * equilibrio que ignora la conducción a las vecinas. Sobre la nave real hacen
 * falta **1.41 °C/s** para esos mismos 10 °C. Con el valor viejo, un solo LED
 * cableado ya rozaba el umbral y la nave entera se habría llenado de destellos.
 */
export const WIRE_HEAT_VISIBLE_CELSIUS_PER_SECOND = 1.41;

/**
 * Disipación a la que el efecto ya está a pleno: la tasa que sostiene una sala
 * cerrada en el umbral de autoignición (90 °C). A partir de ahí el cable no es
 * "un poco caliente", es la causa de que la sala vaya a encenderse sola.
 *
 * **También medido.** El 3.45 de la ronda 1 salía de la misma fórmula mala, y con
 * la constante del conductor recalibrada (1.15) un tronco al límite disipa
 * 6.9 °C/s: el efecto habría nacido saturado en cualquier cable cargado, sin
 * distinguir ya entre "trabajando" y "esto va a prender la sala". El valor real
 * es **9.74 °C/s**, o sea que ni un tronco al límite llega solo al máximo — hace
 * falta el segundo montaje, que es exactamente lo que cuesta encender una sala.
 */
const WIRE_HEAT_FULL_CELSIUS_PER_SECOND = 9.74;

export interface WireHeatState {
  readonly celsiusPerSecond: number;
  /** La capa de señal está apagada: no dibujar nada aunque el cable arda. */
  readonly visible: boolean;
}

export function createWireHeatEffect(
  onEmitterCreated?: ParticleEmitterHook,
): StateDrivenEffect<WireHeatState> {
  let scene: EffectScene | undefined;
  let px = 0;
  let py = 0;
  let area: EffectArea | undefined;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;

  return {
    start(s: EffectScene, position: GridPosition, wireArea?: EffectArea): void {
      scene = s;
      ({ px, py } = toPixel(position));
      area = wireArea;
    },
    update(state: WireHeatState): void {
      if (!scene) return;
      if (!state.visible || state.celsiusPerSecond < WIRE_HEAT_VISIBLE_CELSIUS_PER_SECOND) {
        emitter?.stop();
        return;
      }
      // La misma normalización que usan los efectos de atmósfera, y no una copia
      // a mano: dos montajes cargados pasan de `FULL` y sin clamp la densidad se
      // iría por encima del techo pensado para no tapar lo que hay debajo.
      const severity = thresholdSeverity(
        state.celsiusPerSecond,
        WIRE_HEAT_VISIBLE_CELSIUS_PER_SECOND,
        WIRE_HEAT_FULL_CELSIUS_PER_SECOND,
      );
      // Misma función de densidad que los fenómenos de sala: un cable largo
      // reparte más partículas que uno corto, con el mismo techo para no tapar
      // lo que hay debajo.
      const quantity = coverageQuantity(area?.cells.length ?? 1, severity);
      if (!emitter) {
        emitter = scene.add.particles(
          ...emitterOrigin(px, py, area),
          pickTexture(CIRCLE_TEXTURES),
          {
            lifespan: 700,
            // Asciende: es lo que lo separa de la cicatriz del cable quemado.
            speedY: { min: -26, max: -8 },
            speedX: { min: -5, max: 5 },
            scale: { start: textureScale(6), end: 0 },
            alpha: { start: 0.7, end: 0 },
            quantity,
            frequency: 140,
            tint: HEAT_VAPOR_TINT,
            ...sectionCoverageSpread(area, 4),
          },
        );
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
