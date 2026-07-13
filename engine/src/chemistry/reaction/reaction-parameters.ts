import type { CombustionIntensity } from "./reaction-events.types.js";
import type { CombustionAtmosphere } from "./reaction-context.types.js";

/**
 * Parámetros numéricos de las reglas de reacción (Especificación de datos
 * técnicos §1). Data-driven (CLAUDE.md): valores de referencia para
 * playtesting, ajustables sin tocar la lógica de las reglas. Cada regla y cada
 * subsistema (Bloques 3/4) importa lo que necesita de aquí.
 */
export const REACTION_PARAMETERS = {
  neutralization: {
    /** Eleva la temperatura local +15°C (Espec. §1). */
    heatReleasedCelsius: 15,
    /** Durante 3 segundos de simulación (Espec. §1). */
    heatDurationSeconds: 3,
  },
  toxicity: {
    /** Concentración > 30% del volumen durante > 5s → incapacitación (Espec. §1). */
    incapacitationConcentration: 0.3,
    incapacitationSeconds: 5,
    /** Concentración > 60% → letal (Espec. §1). */
    lethalConcentration: 0.6,
  },
  corrosion: {
    /** Reduce un nivel de RE cada ~15s de exposición a corrosivo medio (Espec. §1). */
    structuralLevelSecondsMedium: 15,
    /** El doble de rápido a nivel alto (Espec. §1). */
    structuralLevelSecondsHigh: 7.5,
    /** Letal para tripulante tras ~10s de exposición directa sin protección (Espec. §1). */
    crewLethalSeconds: 10,
  },
} as const;

/**
 * Mapea el bucket de O2 de la sección a la intensidad de combustión (GDD 5.5).
 * `none` no aparece: en vacío la combustión es imposible (la regla no aplica).
 */
export const COMBUSTION_INTENSITY_BY_OXYGEN: Record<
  Exclude<CombustionAtmosphere, "none">,
  CombustionIntensity
> = {
  low: "weak",
  normal: "standard",
  high: "violent",
};
