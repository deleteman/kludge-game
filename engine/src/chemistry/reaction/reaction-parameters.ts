import type {
  CombustionIntensity,
  CombustionRadius,
  CrewDamageSeverity,
} from "./reaction-events.types.js";
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

/**
 * Radio de propagación de la combustión/explosión según el bucket de O2
 * (Espec. §1, caso de validación 11): "1 sección completa si O2 alto; media
 * sección si normal; sin efecto si O2 < 5%". El bucket `low` no aparece
 * literal en la tabla (que solo cubre alto/normal/<5%) — se extiende con el
 * mismo criterio de "sin efecto" que el extremo bajo de la tabla.
 */
export const COMBUSTION_RADIUS_BY_OXYGEN: Record<
  Exclude<CombustionAtmosphere, "none">,
  CombustionRadius
> = {
  low: "none",
  normal: "half-section",
  high: "full-section",
};

/**
 * Daño a tripulante en el radio de la explosión según el bucket de O2 (Espec.
 * §1, caso 11): "alto (letal posible) en atmósfera enriquecida; medio en
 * normal; nulo en baja/vacío". Mismo criterio de extensión que el radio.
 */
export const COMBUSTION_CREW_DAMAGE_BY_OXYGEN: Record<
  Exclude<CombustionAtmosphere, "none">,
  CrewDamageSeverity
> = {
  low: "none",
  normal: "medium",
  high: "high",
};
