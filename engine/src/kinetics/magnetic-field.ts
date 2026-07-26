import type { CurrentLevel } from "./current-level.types.js";

/**
 * Intensidad de un campo magnético activo (extensión GDD 5.2, documento
 * §1). NO es la propiedad de material `MAG` (GDD 7.0, "ferromagnético
 * Sí/No", estática) — es una cantidad calculada en runtime del electroimán
 * ensamblado y activo en este tick, misma naturaleza que `CombustionIntensity`
 * (resultado de regla). `N` = sin campo efectivo / fuera de alcance.
 */
export type MagneticFieldIntensity = "N" | "B" | "M" | "A";

const INTENSITY_ORDER: ReadonlyArray<MagneticFieldIntensity> = ["N", "B", "M", "A"];

/**
 * Parámetros de referencia (sin tabla numérica en ningún documento — ni el
 * GDD ni la Especificación cubren esta extensión; valores ajustables,
 * documentados como tales, mismo criterio que THERMAL_CONDUCTIVITY_PARAMETERS).
 */
export const MAGNETIC_FIELD_PARAMETERS = {
  /** Bobinas activas simultáneas/en secuencia a partir de las cuales se consideran "múltiples" (documento §1). */
  multipleCoilsThreshold: 4,
  /** Distancia (unidades de riel) dentro de la cual el campo no se degrada. */
  effectiveRangeUnits: 3,
  /** Unidades de distancia por encima del rango efectivo que degradan un nivel de intensidad. */
  degradeStepUnits: 2,
} as const;

/**
 * Tabla de intensidad por bobinas activas + corriente (documento §1, citas
 * literales entre comillas; el resto son extrapolaciones monótonas
 * documentadas, mismo criterio que el caso de validación 11 con el bucket
 * "low" de oxígeno):
 *  - 1 bobina + corriente baja → "Baja" (B) — literal.
 *  - 1 bobina + corriente alta → "Media" (M) — literal ("una bobina con
 *    corriente alta").
 *  - 1 bobina + corriente media → B — extrapolación: el documento exige
 *    explícitamente "alta" para que una sola bobina llegue a Media.
 *  - 2-3 bobinas + corriente baja/media → "Media" (M) — literal.
 *  - 2-3 bobinas + corriente alta → M — el documento reserva "Alta" para
 *    "múltiples bobinas con corriente alta", y enumera 2-3 como el tramo que
 *    llega a Media: dos bobinas no son "múltiples". Sigue siendo monótono (no
 *    vale menos que 2-3 con corriente más baja, que ya es M). Hasta la Fase
 *    11a.1 esta rama devolvía A, lo que hacía que `multipleCoilsThreshold`
 *    fuera código muerto: 3 y 40 bobinas daban idéntico resultado.
 *  - ≥4 bobinas ("múltiples") + corriente alta → "Alta" (A) — literal.
 *  - ≥4 bobinas + corriente baja/media → M — extrapolación: piso, no baja
 *    de lo que ya logran 2-3 bobinas al mismo nivel de corriente.
 */
export function activeCoilFieldIntensity(
  activeCoilCount: number,
  current: CurrentLevel,
): MagneticFieldIntensity {
  if (activeCoilCount <= 0) {
    return "N";
  }
  if (activeCoilCount === 1) {
    return current === "A" ? "M" : "B";
  }
  if (activeCoilCount < MAGNETIC_FIELD_PARAMETERS.multipleCoilsThreshold) {
    return "M";
  }
  return current === "A" ? "A" : "M";
}

/**
 * Decaimiento del campo con la distancia (documento §2): dentro del rango
 * efectivo la intensidad no cambia; más allá, degrada un nivel por cada
 * `degradeStepUnits` de exceso, hasta saturar en "N" (sin efecto).
 *
 * `distanceUnits` sigue siendo un escalar que aporta el llamador — esta
 * función no conoce el grid. Resuelto en Fase 11a (2026-07-17): ya existe el
 * primer llamador con un proyectil posicionado sobre el plano
 * (`projectile-simulation.ts`), y la métrica que quedaba por fijar es
 * Manhattan (`geometry/grid-distance.ts`, con la razón documentada allí).
 * Los llamadores componen `intensityAtDistance(base, manhattanDistance(a, b))`.
 */
export function intensityAtDistance(
  base: MagneticFieldIntensity,
  distanceUnits: number,
): MagneticFieldIntensity {
  const excess = Math.max(0, distanceUnits - MAGNETIC_FIELD_PARAMETERS.effectiveRangeUnits);
  if (excess <= 0) {
    return base;
  }
  const degradeSteps = Math.ceil(excess / MAGNETIC_FIELD_PARAMETERS.degradeStepUnits);
  const baseIndex = INTENSITY_ORDER.indexOf(base);
  const newIndex = Math.max(0, baseIndex - degradeSteps);
  return INTENSITY_ORDER[newIndex] as MagneticFieldIntensity;
}
