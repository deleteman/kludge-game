import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { MatterState } from "../../properties/material.types.js";

/**
 * Vista mínima de una sustancia como reactivo: identidad + tags + estado. Se
 * extrae de una `ChemicalSubstanceDefinition` (atómica o compuesta) con
 * `toReactant`, de modo que las reglas de reacción no dependen del árbol de
 * composición, solo de las propiedades químicas observables (GDD 5.3).
 */
export interface ReactantSubstance {
  readonly id: ChemicalSubstanceId;
  readonly name: string;
  readonly tags: ChemicalProperties;
  readonly state?: MatterState;
}

/**
 * Nivel de oxígeno de la sección donde ocurre la reacción, en los cuatro
 * buckets de la tabla de combustión del GDD 5.5. Lo produce el Bloque 3
 * (atmósfera) a partir de la fracción real de O2; la regla de combustión lo
 * consume para modular su resultado.
 */
export type CombustionAtmosphere = "none" | "low" | "normal" | "high";

/**
 * Contexto de una resolución de reacción: qué sustancias están en contacto y
 * en qué entorno. Los flags de entorno son los que las reglas de tags de GDD
 * 5.3 necesitan más allá de las propias sustancias (fuente de ignición,
 * regulador térmico sobrecargado, etc.). Es un dato inmutable de entrada; la
 * resolución no lo muta.
 */
export interface ReactionContext {
  readonly reactants: ReadonlyArray<ReactantSubstance>;
  /** O2 de la sección (Bloque 3) — modula la combustión (GDD 5.5). */
  readonly oxygen: CombustionAtmosphere;
  /** Hay chispa/calor suficiente para iniciar combustión. */
  readonly ignitionPresent: boolean;
  /** Regulador térmico en sobrecarga: habilita ignición espontánea de volátiles (GDD 5.3). */
  readonly thermalRegulatorOverloaded: boolean;
  /** Tiempo simulado transcurrido, para sellar el evento emitido. */
  readonly elapsedSeconds: number;
}
