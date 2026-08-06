/**
 * ¿De qué elementos está hecha una sustancia? (Subfase 13e, extracción — GDD 5.4.1)
 *
 * Tres caminos, en este orden:
 *  1. La receta del catálogo de compuestos (`COMPOUND_CATALOG[...].recipe`) —
 *     agua = 2 hidrógeno + 1 oxígeno. Es el caso normal.
 *  2. La PROCEDENCIA registrada al sintetizar. Una "Mezcla sin identificar"
 *     (resolución de identidad paso 3, GDD 5.3) no tiene receta en el catálogo
 *     y sin este dato sería indescomponible para siempre; como
 *     `queueSynthesis` conoce los elementos elegidos, se guardan al crearla.
 *  3. Nada: no se puede extraer, solo purgar. Es un callejón sin salida
 *     deliberado para una mezcla que nadie sabe de dónde salió (una sembrada
 *     por el mapa sin receta), no un error del jugador.
 *
 * En los tres casos hay una PRECONDICIÓN antes: la sustancia debe estar
 * analizada. El motor conoce la composición desde siempre; la ficción no, hasta
 * que un Médico la analice (`analyze-substance`, Fase 11e). Eso convierte esa
 * tarea en una puerta real y no en flavor.
 *
 * Un elemento puro se descompone en sí mismo (no tiene receta y no hace falta
 * procedencia): extraer hidrógeno de un tanque de hidrógeno devuelve hidrógeno.
 */

import type { ChemicalSubstanceId, ChemicalSubstanceDefinition } from "../chemistry/chemical-substance.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import { isCompositeEntity } from "../composition/composable-entity.types.js";

export class SubstanceCompositionError extends Error {}

/** La sustancia no está analizada todavía: el jugador no sabe de qué está hecha. */
export class UnanalyzedSubstanceError extends SubstanceCompositionError {
  constructor(readonly substanceId: ChemicalSubstanceId) {
    super(`La sustancia "${substanceId}" no fue analizada: no se puede descomponer todavía.`);
  }
}

/** Sin receta de catálogo ni procedencia registrada: indescomponible. */
export class UnknownCompositionError extends SubstanceCompositionError {
  constructor(readonly substanceId: ChemicalSubstanceId) {
    super(`No se conoce la composición de "${substanceId}": no se puede extraer, solo purgar.`);
  }
}

export interface SubstanceCompositionContext {
  readonly registry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
  /** `substanceId → elementos elegidos al sintetizarla` (`CampaignSaveState.substanceProvenance`). */
  readonly provenance: Readonly<Record<string, ReadonlyArray<ChemicalSubstanceId>>>;
  readonly analyzedSubstanceIds: ReadonlyArray<ChemicalSubstanceId>;
}

/**
 * Lista de elementos POR UNIDAD de sustancia, con repetidos según la
 * proporción de la receta (agua → `[hidrogeno, hidrogeno, oxigeno]`). Misma
 * representación que la selección de la mesa, así que `creditElementList` la
 * consume sin conversión.
 *
 * Lanza si no está analizada o si no hay composición conocida — extraer a
 * ciegas no es un caso silencioso.
 */
export function elementsPerUnit(
  substanceId: ChemicalSubstanceId,
  context: SubstanceCompositionContext,
): ReadonlyArray<ChemicalSubstanceId> {
  if (!context.analyzedSubstanceIds.includes(substanceId)) {
    throw new UnanalyzedSubstanceError(substanceId);
  }

  const definition = context.registry.get(substanceId);
  if (definition && isCompositeEntity(definition)) {
    // Camino 1: receta de catálogo, expandida por cantidad.
    return definition.recipe.ingredients.flatMap((ingredient) =>
      Array.from({ length: Math.max(1, Math.round(ingredient.quantity)) }, () => ingredient.ref),
    );
  }

  const provenance = context.provenance[substanceId];
  if (provenance && provenance.length > 0) {
    // Camino 2: de qué se hizo cuando la sintetizó el jugador.
    return provenance;
  }

  if (definition) {
    // Un elemento puro del catálogo se descompone en sí mismo.
    return [substanceId];
  }

  throw new UnknownCompositionError(substanceId);
}

/** Elementos que rinde extraer `amount` unidades, con su multiplicidad total. */
export function elementsFromAmount(
  substanceId: ChemicalSubstanceId,
  amount: number,
  context: SubstanceCompositionContext,
): ReadonlyArray<ChemicalSubstanceId> {
  const perUnit = elementsPerUnit(substanceId, context);
  const units = Math.max(0, Math.floor(amount));
  return Array.from({ length: units }, () => perUnit).flat();
}

/** Versión no-lanzadora, para que la UI deshabilite el botón con un motivo. */
export function extractionBlockedReason(
  substanceId: ChemicalSubstanceId,
  context: SubstanceCompositionContext,
): "unanalyzed" | "unknown-composition" | undefined {
  try {
    elementsPerUnit(substanceId, context);
    return undefined;
  } catch (error) {
    if (error instanceof UnanalyzedSubstanceError) return "unanalyzed";
    if (error instanceof UnknownCompositionError) return "unknown-composition";
    throw error;
  }
}
