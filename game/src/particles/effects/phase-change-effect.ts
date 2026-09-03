import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
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

/** Cuántas partículas ve el jugador por unidad vertida, con techo para que no tape la sala. */
function quantityFor(amount: number): number {
  return Math.max(4, Math.min(18, Math.round(amount * 0.6)));
}

/**
 * Una sustancia SUELTA cambió de estado en la sección: el charco se evaporó (o
 * el gas condensó). El color sale de `substanceColor`, la misma función que
 * pinta el charco del derrame — el jugador ve subir el mismo color que acababa
 * de volcar, que es lo que conecta las dos mitades del fenómeno.
 */
export const substancePhaseChangeEffect: EventDrivenEffect<"substance-phase-change"> = {
  kind: "substance-phase-change",
  trigger(scene, position: GridPosition, event, options): void {
    const { px, py } = toPixel(position);
    const rising = event.transition === "boil";
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: rising ? 1100 : 700,
        // Hacia arriba al evaporar; hacia abajo al condensar/solidificar.
        speedY: rising ? { min: -34, max: -12 } : { min: 8, max: 22 },
        speedX: { min: -8, max: 8 },
        scale: rising
          ? { start: textureScale(8), end: textureScale(20) }
          : { start: textureScale(14), end: 0 },
        alpha: { start: 0.75, end: 0 },
        quantity: quantityFor(event.amount),
        tint: chemicalSubstanceColor(event.substanceId),
        x: spreadRange(14),
        y: spreadRange(10),
      },
      rising ? 1100 : 700,
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
