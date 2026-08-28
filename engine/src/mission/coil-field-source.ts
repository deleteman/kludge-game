import type { ActiveCoil } from "../kinetics/projectile.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import { activeCoilFieldIntensity, intensityAtDistance } from "../kinetics/magnetic-field.js";
import type { MagneticFieldIntensity } from "../kinetics/magnetic-field.js";

const INTENSITY_ORDER: readonly MagneticFieldIntensity[] = ["N", "B", "M", "A"];

/**
 * Campo magnético resultante en una celda cualquiera del plano (Subfase 13h).
 *
 * `activeCoilFieldIntensity`/`intensityAtDistance` existen desde 11a.3 pero son
 * puras y agnósticas del grid: el llamador tiene que componerlas. Hasta ahora el
 * único consumidor era la aceleración de proyectiles, que trabaja bobina por
 * bobina; la regla de trabado de puertas necesita la pregunta al revés —
 * "cuánto campo hay AQUÍ" — y esta es esa composición.
 *
 * Las bobinas CONTIGUAS cuentan como un solo electroimán: es lo que hace que
 * apilar bobinas sea una estrategia real (documento §1, umbral de
 * `multipleCoilsThreshold`) en vez de un detalle sin efecto. Se toma el máximo
 * sobre los grupos y no la suma: el campo no se acumula entre electroimanes
 * separados por media nave.
 */
export function coilFieldIntensityAt(
  coils: ReadonlyArray<ActiveCoil>,
  cell: GridPosition,
): MagneticFieldIntensity {
  let strongest: MagneticFieldIntensity = "N";
  for (const coil of coils) {
    const clustered = coils.filter((other) => manhattan(other.position, coil.position) <= 1).length;
    const intensity = intensityAtDistance(
      activeCoilFieldIntensity(clustered, coil.current),
      manhattan(coil.position, cell),
    );
    if (INTENSITY_ORDER.indexOf(intensity) > INTENSITY_ORDER.indexOf(strongest)) {
      strongest = intensity;
    }
  }
  return strongest;
}

function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
