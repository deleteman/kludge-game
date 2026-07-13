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
  readonly state?: MatterState;
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
