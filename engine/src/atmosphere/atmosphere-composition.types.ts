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

/** Fracción de O2 de una atmósfera terrestre estándar, referencia de "normal". */
export const STANDARD_OXYGEN_FRACTION = 0.21;

export interface AtmosphereComposition {
  readonly gases: ReadonlyMap<GasKey, number>;
  readonly temperatureCelsius: number;
  readonly pressureKpa: number;
}
