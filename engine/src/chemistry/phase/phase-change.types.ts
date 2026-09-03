import type { MatterState } from "../../properties/material.types.js";

/**
 * Puntos de transición de fase de una sustancia (Subfase 14a-3, GDD §5.6
 * "cambio de estado por temperatura").
 *
 * Hasta 14a-3 `ChemicalSubstanceData.state` era un dato ESTÁTICO de catálogo y
 * nadie lo cambiaba nunca: el nitrógeno líquido seguía siendo líquido a 500 °C
 * y el agua no se congelaba en una sala bajo cero. Estos dos números son lo que
 * lo vuelve un valor derivado del mundo.
 *
 * Se autoran en °C igual que el resto del eje térmico
 * (`atmosphere/thermal-parameters.ts`), y NO son física real: son números de
 * juego. El nitrógeno real hierve a -196 °C, fuera del clamp del motor
 * (`TEMPERATURE_FLOOR_CELSIUS` = -80), así que un valor real dejaría la
 * transición inalcanzable — que es exactamente el error de elegir un umbral sin
 * mirar los otros números del sistema.
 */
export interface PhaseChangePoints {
  /** Por DEBAJO de esta temperatura la sustancia es sólida. */
  readonly meltingPointCelsius: number;
  /** A partir de esta temperatura (inclusive) la sustancia es gaseosa. */
  readonly boilingPointCelsius: number;
}

/**
 * Transición observada entre el estado nominal de una sustancia y el que le
 * corresponde a la temperatura actual. Existe para que los consumidores no
 * comparen pares de `MatterState` a mano en cada sitio: la pregunta que se hace
 * el motor es "¿qué le pasó?", no "¿de qué letra a qué letra fue?".
 */
export type PhaseTransition = "freeze" | "melt" | "boil" | "condense";

/**
 * Datos de una sustancia **autorada en catálogo**: a diferencia de
 * `ChemicalSubstanceData` —que también describe productos sintetizados en
 * runtime (una combustión, una "Mezcla sin identificar")—, una entrada de
 * catálogo declara SIEMPRE su estado y sus dos puntos.
 *
 * Es la contrapartida de tipo del test de datos: el compilador exige los tres
 * campos en las 49 entradas y el test verifica que sean coherentes entre sí.
 * Los productos de runtime caen al perfil por estado de
 * `DEFAULT_PHASE_POINTS_BY_STATE`, resuelto en un único sitio (`phasePointsOf`).
 */
export interface AuthoredSubstanceData {
  readonly state: MatterState;
  readonly meltingPointCelsius: number;
  readonly boilingPointCelsius: number;
}
