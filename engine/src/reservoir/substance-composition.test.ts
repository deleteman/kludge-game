import { describe, expect, it } from "vitest";
import {
  elementsFromAmount,
  elementsPerUnit,
  extractionBlockedReason,
  UnanalyzedSubstanceError,
  UnknownCompositionError,
  type SubstanceCompositionContext,
} from "./substance-composition.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";

const { registry } = buildChemicalCatalog();

const AGUA = "agua" as ChemicalSubstanceId;
const HIDROGENO = "hidrogeno" as ChemicalSubstanceId;
const OXIGENO = "oxigeno" as ChemicalSubstanceId;
const CLORO = "cloro" as ChemicalSubstanceId;
const MEZCLA = "mezcla-sin-identificar-1" as ChemicalSubstanceId;

function context(overrides: Partial<SubstanceCompositionContext> = {}): SubstanceCompositionContext {
  return {
    registry,
    provenance: {},
    analyzedSubstanceIds: [AGUA, HIDROGENO, MEZCLA],
    ...overrides,
  };
}

describe("elementsPerUnit — precondición de análisis", () => {
  it("una sustancia sin analizar NO se puede descomponer (Fase 11e es la puerta)", () => {
    const ctx = context({ analyzedSubstanceIds: [] });
    expect(() => elementsPerUnit(AGUA, ctx)).toThrow(UnanalyzedSubstanceError);
    expect(extractionBlockedReason(AGUA, ctx)).toBe("unanalyzed");
  });

  it("analizada, sí", () => {
    expect(extractionBlockedReason(AGUA, context())).toBeUndefined();
  });
});

describe("elementsPerUnit — camino 1: receta de catálogo", () => {
  it("expande la receta respetando la proporción (agua = 2 H + 1 O)", () => {
    expect(elementsPerUnit(AGUA, context())).toEqual([HIDROGENO, HIDROGENO, OXIGENO]);
  });

  it("un elemento puro se descompone en sí mismo", () => {
    expect(elementsPerUnit(HIDROGENO, context())).toEqual([HIDROGENO]);
  });

  it("la receta gana sobre la procedencia registrada", () => {
    const ctx = context({ provenance: { [AGUA]: [CLORO, CLORO] } });
    expect(elementsPerUnit(AGUA, ctx)).toEqual([HIDROGENO, HIDROGENO, OXIGENO]);
  });
});

describe("elementsPerUnit — camino 2: procedencia de la síntesis", () => {
  it("una mezcla sin identificar rinde los elementos con que se sintetizó", () => {
    const ctx = context({ provenance: { [MEZCLA]: [HIDROGENO, HIDROGENO, CLORO] } });
    expect(elementsPerUnit(MEZCLA, ctx)).toEqual([HIDROGENO, HIDROGENO, CLORO]);
  });

  it("sin receta NI procedencia es indescomponible: solo se puede purgar", () => {
    const ctx = context();
    expect(() => elementsPerUnit(MEZCLA, ctx)).toThrow(UnknownCompositionError);
    expect(extractionBlockedReason(MEZCLA, ctx)).toBe("unknown-composition");
  });

  it("una procedencia vacía cuenta como ausente", () => {
    const ctx = context({ provenance: { [MEZCLA]: [] } });
    expect(() => elementsPerUnit(MEZCLA, ctx)).toThrow(UnknownCompositionError);
  });
});

describe("elementsFromAmount", () => {
  it("escala por unidades enteras", () => {
    expect(elementsFromAmount(AGUA, 2, context())).toEqual([
      HIDROGENO,
      HIDROGENO,
      OXIGENO,
      HIDROGENO,
      HIDROGENO,
      OXIGENO,
    ]);
  });

  it("una cantidad fraccionaria trunca hacia abajo (no se extrae media molécula)", () => {
    expect(elementsFromAmount(AGUA, 1.9, context())).toEqual([HIDROGENO, HIDROGENO, OXIGENO]);
  });

  it("cantidad cero o negativa no rinde nada", () => {
    expect(elementsFromAmount(AGUA, 0, context())).toEqual([]);
    expect(elementsFromAmount(AGUA, -3, context())).toEqual([]);
  });

  it("sigue exigiendo análisis aunque la cantidad sea cero", () => {
    expect(() => elementsFromAmount(AGUA, 0, context({ analyzedSubstanceIds: [] }))).toThrow(
      UnanalyzedSubstanceError,
    );
  });
});
