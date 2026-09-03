import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import {
  coverageQuantity,
  emitterOrigin,
  sectionCoverageSpread,
} from "./atmosphere-effect-coverage.js";
import { CIRCLE_TEXTURES } from "../particle-texture-registry.js";
import { chemicalSubstanceColor, FROST_LAYER_COLOR } from "../../render/palette.js";

/**
 * Cambio de estado de sustancia (Subfase 14a-3, GDD §5.6).
 *
 * Dos efectos y no uno con un flag, por el principio 6: un charco que hierve y
 * un tanque que se solidifica son fenómenos distintos y no pueden verse igual.
 *
 * **Dirección, no solo color**: la evaporación SUBE (velocidad hacia arriba,
 * escala creciente) y la condensación/congelación se queda quieta y se apaga
 * hacia abajo. Es la lección de 14a-4 ronda 3 sobre los efectos de arista —
 * cuando dos estados comparten paleta, lo que los distingue tiene que ser la
 * forma del movimiento, no el tono.
 */

/**
 * Cuánto dura la nube de la transición. Larga a propósito (ronda 1 de playtest
 * de 14a-3): el operador tiene que poder VER el fenómeno mientras coordina el
 * paso siguiente, y un burst de un segundo en una sala de 40 celdas se pierde.
 * Es el aviso del cambio; la nube persistente de `gasLeak` se ocupa del después.
 */
const EVAPORATION_LIFESPAN_MS = 2200;
const CONDENSATION_LIFESPAN_MS = 1200;

/**
 * Severidad de la transición según cuántas unidades cambiaron de estado.
 *
 * Verter un bidón entero y volcar un chorrito no pueden verse igual, pero la
 * DENSIDAD final la decide `coverageQuantity` cruzando esto con el área de la
 * sala — misma función que los tres efectos de atmósfera, para que la misma
 * cantidad se lea igual de densa en un armario y en el hangar.
 *
 * 30 unidades saturan la escala: es la mitad de un reservorio de disolvente
 * (60), o sea que un vertido normal ya se ve a pleno.
 */
function severityFor(amount: number): number {
  return Math.min(1, amount / 30);
}

/**
 * Una sustancia SUELTA cambió de estado en la sección: el charco se evaporó (o
 * el gas condensó). El color sale de `chemicalSubstanceColor`, la misma función
 * que pinta el charco del derrame — el jugador ve subir el mismo color que
 * acababa de volcar, que es lo que conecta las dos mitades del fenómeno.
 *
 * **Cubre la SALA, no un punto** (ronda 1 de playtest de 14a-3). La primera
 * versión creaba un burst con ±14 px de dispersión en la celda centroide, que es
 * exactamente el defecto que la ronda 1 de 14a-2 había corregido para los tres
 * efectos de atmósfera: un fenómeno de sección pintado como una chispa. Se
 * reusan `sectionEmitZone` y `coverageQuantity` en vez de volver a inventar un
 * radio a ojo — y el emisor va en (0,0) porque la zona devuelve coordenadas de
 * MUNDO. Sin área (galería de partículas, tests) cae al burst puntual de antes.
 */
export const substancePhaseChangeEffect: EventDrivenEffect<"substance-phase-change"> = {
  kind: "substance-phase-change",
  trigger(scene, position: GridPosition, event, options): void {
    const { px, py } = toPixel(position);
    const area = options?.area;
    const rising = event.transition === "boil";
    const lifespan = rising ? EVAPORATION_LIFESPAN_MS : CONDENSATION_LIFESPAN_MS;
    const [originX, originY] = emitterOrigin(px, py, area);
    spawnBurst(
      scene,
      originX,
      originY,
      {
        lifespan,
        // La dirección es lo que separa los dos fenómenos, no el color: el vapor
        // ASCIENDE y la condensación cae. Dos estados que comparten paleta se
        // distinguen por la forma del movimiento (lección de 14a-4 ronda 3).
        speedY: rising ? { min: -34, max: -12 } : { min: 8, max: 22 },
        speedX: { min: -10, max: 10 },
        // Al evaporar la partícula CRECE mientras sube: una columna que se
        // expande se lee como vapor, una que se encoge como una chispa.
        scale: rising
          ? { start: textureScale(10), end: textureScale(26) }
          : { start: textureScale(14), end: 0 },
        alpha: { start: 0.8, end: 0 },
        quantity: area
          ? coverageQuantity(area.cells.length, severityFor(event.amount))
          : Math.max(4, Math.min(18, Math.round(event.amount * 0.6))),
        // Emisión sostenida mientras dura la transición, no un único disparo:
        // con `frequency` por defecto (-1) Phaser suelta todo en un frame y la
        // sala parpadea en vez de llenarse.
        frequency: 120,
        tint: chemicalSubstanceColor(event.substanceId),
        ...sectionCoverageSpread(area, 14),
      },
      lifespan,
      CIRCLE_TEXTURES,
      options?.onObjectCreated,
    );
  },
};

/**
 * El CONTENIDO de un reservorio se solidificó (o volvió a fundirse). Se pinta
 * sobre la pieza y no sobre la sala: el sujeto es el tanque, y su estado
 * persistente lo lleva además el glifo del copo (`component-state-visuals.ts`),
 * que no depende de que el jugador estuviera mirando en ese instante.
 *
 * Este burst es el AVISO del cruce; el glifo es la lectura permanente. Sin el
 * burst el cambio pasa desapercibido, sin el glifo desaparece a los dos
 * segundos y el jugador no sabe por qué los botones están grises.
 */
export const reservoirContentPhaseChangeEffect: EventDrivenEffect<"reservoir-content-phase-change"> =
  {
    kind: "reservoir-content-phase-change",
    trigger(scene, position: GridPosition, event, options): void {
      const { px, py } = toPixel(position);
      const freezing = event.transition === "freeze";
      spawnBurst(
        scene,
        px,
        py,
        {
          lifespan: 900,
          speed: { min: 4, max: freezing ? 16 : 30 },
          scale: freezing
            ? { start: textureScale(16), end: textureScale(4) }
            : { start: textureScale(6), end: textureScale(16) },
          alpha: { start: 0.9, end: 0 },
          // Al congelar, la ráfaga es más densa si además rompió el tanque: la
          // consecuencia mecánica tiene que verse más que el cambio de estado.
          quantity: event.destroyedContainer ? 20 : event.damagedContainer ? 14 : 8,
          tint: FROST_LAYER_COLOR,
          x: spreadRange(10),
          y: spreadRange(10),
        },
        900,
        CIRCLE_TEXTURES,
        options?.onObjectCreated,
      );
    },
  };
