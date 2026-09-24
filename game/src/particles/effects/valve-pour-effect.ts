import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, textureScale, toPixel } from "../particle-utils.js";
import { CIRCLE_TEXTURES } from "../particle-texture-registry.js";
import { chemicalSubstanceColor } from "../../render/palette.js";

/**
 * Una válvula automática está vertiendo (Subfase 14b-2).
 *
 * Efecto PROPIO y no reusar el del derrame o el de la evaporación, por el
 * principio 6: son tres fenómenos distintos y no pueden verse igual. El
 * discriminante es el mismo que usó 14a-3 para separar vapor de condensación —
 * la forma del movimiento, no el tono, porque los tres comparten la paleta de
 * la sustancia:
 *
 *  - un DERRAME cae y se queda (mancha en el piso),
 *  - una EVAPORACIÓN sube y se expande por toda la sala,
 *  - una PURGA sale a presión de un punto: chorro corto, rápido, horizontal y
 *    anclado a la pieza. Es maquinaria haciendo su trabajo, no un accidente.
 *
 * Va sobre la CELDA DE LA VÁLVULA y no sobre el centroide de la sección: el
 * sujeto del fenómeno es la pieza que vierte, y el jugador tiene que poder
 * mirar el plano y saber CUÁL de sus válvulas se abrió. Pintar sobre la sala
 * sería contar el efecto en vez de la causa (patrón 66: la causa donde el
 * jugador la va a buscar).
 */

/**
 * Corto a propósito: el runtime emite un evento POR TICK mientras la válvula
 * esté abierta, así que el chorro se sostiene solo encadenando bursts. Uno
 * largo se acumularía sobre sí mismo y saturaría la celda en dos segundos.
 * Esa es también la razón de que no haya `frequency`: acá cada evento ES el
 * pulso.
 */
const POUR_LIFESPAN_MS = 420;

export const valvePourEffect: EventDrivenEffect<"valve-pour"> = {
  kind: "valve-pour",
  trigger(scene, position: GridPosition, event, options): void {
    const { px, py } = toPixel(position);
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: POUR_LIFESPAN_MS,
        // Chorro a presión: rápido y con más recorrido horizontal que vertical.
        // Es lo que lo separa de un derrame, que cae, y de un vapor, que sube.
        speedX: { min: -46, max: 46 },
        speedY: { min: -18, max: 6 },
        // Se ENCOGE al alejarse: el gas se dispersa en la sala en vez de
        // acumularse, al revés que la columna creciente del vapor.
        scale: { start: textureScale(12), end: textureScale(3) },
        alpha: { start: 0.75, end: 0 },
        // Poca cantidad por evento porque hay uno por tick: la densidad la da
        // la repetición, no el burst.
        quantity: 3,
        // El mismo color con el que se pinta esa sustancia en cualquier otro
        // lado: el jugador ve salir el color del tanque que cableó.
        tint: chemicalSubstanceColor(event.substanceId),
      },
      POUR_LIFESPAN_MS,
      CIRCLE_TEXTURES,
      options?.onObjectCreated,
    );
  },
};
