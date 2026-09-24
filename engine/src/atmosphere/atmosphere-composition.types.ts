/**
 * Composición atmosférica de una sección (GDD 5.5): fracción de cada gas
 * respecto al volumen, más temperatura y presión. La fracción de un gas es un
 * número en [0, 1]; la suma puede ser < 1 (sección parcialmente despresurizada)
 * — el "hueco" es vacío, no un gas implícito.
 *
 * Los gases se identifican por clave string: los tres respirables/estándar
 * tienen clave fija (`GAS`), y cualquier contaminante usa el id de su sustancia
 * (GDD 5.4) como clave, de modo que un mismo tóxico se comporta igual esté en
 * un reservorio o difundido en el aire.
 */
export const GAS = {
  OXYGEN: "O2",
  NITROGEN: "N2",
  CO2: "CO2",
} as const;

export type GasKey = string;

/**
 * Qué SUSTANCIA del catálogo químico nombra cada clave basal (Subfase 14b-2).
 *
 * Esto no es una excepción para el oxígeno: es la mitad que le faltaba a `GAS`.
 * El docblock de arriba dice desde siempre que los tres estándar tienen clave
 * fija y que los contaminantes usan su id de sustancia — pero nunca dijo **qué
 * sustancia es cada clave fija**, así que los mismos tres gases tenían dos
 * nombres y nada los unía. `oxigeno` y `"O2"` convivían como si fueran cosas
 * distintas.
 *
 * La consecuencia era un bug silencioso: verter un generador de oxígeno metía
 * una entrada `oxigeno` NUEVA que desplazaba proporcionalmente al `"O2"` real,
 * o sea que oxigenar una sala la volvía menos respirable mientras el tooltip
 * informaba que había entrado oxígeno. Lo mismo habría pasado con el nitrógeno
 * de un extintor.
 *
 * La regla, y vale para cualquier sustancia que entre al aire: **una sustancia
 * que ES uno de los gases basales se escribe en su clave basal, no al lado**.
 * Se aplica en el único escritor que cruza de sustancia a atmósfera
 * (`TransientGasInjection.inject`), así que no hay dos lugares que puedan
 * discrepar.
 *
 * Vive acá y no en el catálogo químico a propósito: es la codificación de
 * ESTE modelo de atmósfera, y `/engine/chemistry` no tiene por qué conocerla.
 */
const GAS_KEY_BY_SUBSTANCE_ID: ReadonlyMap<string, GasKey> = new Map([
  ["oxigeno", GAS.OXYGEN],
  ["nitrogeno", GAS.NITROGEN],
  ["dioxido-de-carbono", GAS.CO2],
]);

/**
 * Bajo qué clave entra esta sustancia a la atmósfera. Devuelve la clave basal
 * si la sustancia ES uno de los tres gases estándar, y el propio id en
 * cualquier otro caso (la convención que ya regía para los contaminantes).
 */
export function atmosphericGasKeyOf(substanceId: string): GasKey {
  return GAS_KEY_BY_SUBSTANCE_ID.get(substanceId) ?? substanceId;
}

/** ¿Esta clave de gas es uno de los tres de fondo? */
export function isBaselineGasKey(gasKey: GasKey): boolean {
  return gasKey === GAS.OXYGEN || gasKey === GAS.NITROGEN || gasKey === GAS.CO2;
}

/** Fracción de O2 de una atmósfera terrestre estándar, referencia de "normal". */
export const STANDARD_OXYGEN_FRACTION = 0.21;

export interface AtmosphereComposition {
  readonly gases: ReadonlyMap<GasKey, number>;
  readonly temperatureCelsius: number;
  readonly pressureKpa: number;
}
