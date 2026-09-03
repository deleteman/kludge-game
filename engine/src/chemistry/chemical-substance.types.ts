import type { Brand } from "../shared/brand.types.js";
import type { ChemicalProperties } from "../properties/chemical-tag.types.js";
import type { MatterState } from "../properties/material.types.js";
import type { ComposableEntity } from "../composition/composable-entity.types.js";

export type ChemicalSubstanceId = Brand<string, "ChemicalSubstanceId">;

/**
 * Nivel 0 (elemento base, GDD 5.4.1) y Nivel 1 (compuesto derivado, GDD
 * 5.4.2) comparten esta forma de datos: ambos son, en el fondo, una
 * sustancia con tags químicos y un estado de materia.
 */
export interface ChemicalSubstanceData {
  readonly tags: ChemicalProperties;
  /**
   * Estado **dentro de un contenedor sellado**, que es donde el catálogo
   * describe a la sustancia. Desde 14a-3 NO es la autoridad de runtime: para
   * una sustancia suelta en una sección manda `effectiveMatterState()`
   * (`chemistry/phase/matter-state.ts`), que la deriva de la temperatura.
   */
  readonly state?: MatterState;
  /**
   * Puntos de transición (14a-3). **Obligatorios en las entradas de catálogo**
   * vía `AuthoredSubstanceData`; opcionales acá porque este mismo tipo describe
   * los productos que las reglas de reacción sintetizan en runtime, que no salen
   * de ningún catálogo autorado y caen al perfil de
   * `DEFAULT_PHASE_POINTS_BY_STATE`.
   */
  readonly meltingPointCelsius?: number;
  readonly boilingPointCelsius?: number;
}

/**
 * TRef = ChemicalSubstanceId (no un "ElementId" separado): permite que un
 * futuro compuesto derivado referencie otro compuesto además de elementos,
 * sin rediseñar el tipo, aunque el catálogo real de Fase 4 probablemente
 * solo use recetas elemento→compuesto de un nivel.
 */
export type ChemicalSubstanceDefinition = ComposableEntity<
  ChemicalSubstanceId,
  ChemicalSubstanceData,
  ChemicalSubstanceData,
  ChemicalSubstanceId
>;
