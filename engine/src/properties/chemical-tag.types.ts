/**
 * Propiedades químicas (GDD 5.3), tercera capa, ortogonal a funcional y
 * material. Aplican a sustancias (5.4), no a objetos. Cada sustancia tiene
 * 1-3 tags químicos, no valores numéricos exactos.
 *
 * Los tags con nivel (`TOX(M)`, `CORR(A)` en la notación del GDD) se
 * representan como objetos discriminados por `name` con un campo `level`
 * tipado condicionalmente, en vez de una notación string libre — más seguro
 * (autocompletado/chequeo estático) y más fácil de (de)serializar que
 * parsear "TOX(M)" como texto, sin perder trazabilidad al nombre exacto del
 * GDD.
 */

export type SimpleChemicalTagName = "OXI" | "COMB" | "ACID" | "BASE" | "INERTE" | "VOLAT";
export type LeveledChemicalTagName = "TOX" | "CORR";

export type ChemicalTagLevel = "A" | "M" | "B";
/** TOX admite además "controlado" (GDD 5.4.3, ej. Anestésico médico). */
export type ToxicityLevel = ChemicalTagLevel | "controlado";

export interface SimpleChemicalTag {
  readonly name: SimpleChemicalTagName;
}

export interface ToxTag {
  readonly name: "TOX";
  readonly level?: ToxicityLevel;
}

export interface CorrTag {
  readonly name: "CORR";
  readonly level?: ChemicalTagLevel;
}

export type ChemicalTag = SimpleChemicalTag | ToxTag | CorrTag;

export type ChemicalProperties = ReadonlyArray<ChemicalTag>;

/** GDD 5.3: "Cada sustancia tiene 1-3 tags químicos". */
export const MIN_CHEMICAL_TAGS_PER_SUBSTANCE = 1;
export const MAX_CHEMICAL_TAGS_PER_SUBSTANCE = 3;

export function assertValidTagCount(data: { readonly tags: ChemicalProperties }): void {
  const count = data.tags.length;
  if (count < MIN_CHEMICAL_TAGS_PER_SUBSTANCE || count > MAX_CHEMICAL_TAGS_PER_SUBSTANCE) {
    throw new Error(
      `Chemical substance must have ${MIN_CHEMICAL_TAGS_PER_SUBSTANCE}-${MAX_CHEMICAL_TAGS_PER_SUBSTANCE} tags, got ${count}`,
    );
  }
}
