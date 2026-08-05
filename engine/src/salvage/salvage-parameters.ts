import { HP_LOSS_FRACTION } from "../crew/hp-resolution.js";
import { OXYGEN_COMBUSTION_THRESHOLDS } from "../atmosphere/combustion-atmosphere.js";
import { PRESSURE_RECOVERY_CEILING_KPA } from "../mission/mission-atmosphere-runtime.js";

/**
 * Parámetros del riesgo de canibalización (Subfase 13d). Data-driven
 * (CLAUDE.md): la lógica de `dismantle-hazard-rules.ts` no contiene ni un
 * literal numérico. Mismo criterio que `KINETIC_IMPACT_PARAMETERS` /
 * `REACTION_PARAMETERS`.
 */
export const SALVAGE_HAZARD_PARAMETERS = {
  /**
   * Daño al tripulante que ejecuta el desmontaje, como fracción de su `maxHp`.
   * Ninguno es letal por sí solo: son accidentes de mantenimiento, no una
   * explosión — el electrocutado se lleva la peor parte (GDD 6.8 lista
   * "electrocución" entre las muertes gráficas, pero acá el chispazo hiere).
   * La consecuencia grave llega, si llega, por la combustión que la chispa
   * pueda encender (§5.5), no por el chispazo en sí.
   */
  crewDamageFraction: {
    "dismantle-spark": HP_LOSS_FRACTION.low,
    "dismantle-spill": HP_LOSS_FRACTION.low,
    /** La fuga daña la sección, no directamente a quien empuña la llave. */
    "dismantle-leak": 0,
  },
  /**
   * HP mínimo en el que se detiene el daño de un hazard de desmontaje: nunca
   * mata por sí solo (mismo mecanismo `minHp` que ya usa `applyCrewDamage`
   * para el capítulo 2).
   */
  crewDamageMinHp: 1,
  /**
   * Concentración de un contaminante (cualquier gas que no sea uno de los tres
   * estándar) a partir de la cual la sección se considera comprometida. Mismo
   * umbral que la exposición corrosiva (`CORROSIVE_ONSET_CONCENTRATION`) y que
   * el piso de combustión, para no inventar una tercera escala.
   */
  hazardousContaminantConcentration: OXYGEN_COMBUSTION_THRESHOLDS.none,
  /**
   * Presión por debajo de la cual la sección ya está perdiendo atmósfera y
   * abrir un hueco más la agrava. Fracción de la presión estándar.
   */
  hazardousPressureKpa: PRESSURE_RECOVERY_CEILING_KPA * 0.9,
  /** Caudal de la fuga que abre el desmontaje (kPa/s) y cuánto dura. */
  leakDrainRateKpaPerSecond: 1.5,
  leakDurationSeconds: 20,
} as const;
