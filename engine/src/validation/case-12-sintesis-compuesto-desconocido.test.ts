// GDD 9, caso 12 — "Síntesis de un Compuesto Desconocido": elementos base combinados en una proporción sin receta nombrada → fallback "Mezcla sin identificar" (unión de tags, GDD 5.3 paso 3).
import { describe, expect, it } from "vitest";
import {
  ReactionResolver,
  buildChemicalCatalog,
  type ChemicalSubstanceId,
  type ReactantSubstance,
  type ReactionContext,
} from "../index.js";

describe("case 12 — Síntesis de un Compuesto Desconocido", () => {
  it("elements combined outside any named recipe fall back to an unidentified mixture with the union of tags", () => {
    const { registry } = buildChemicalCatalog();

    // Elementos base (GDD 5.4.1) del catálogo real.
    const carbonoEntity = registry.get("carbono" as ChemicalSubstanceId)!;
    const nitrogeniEntity = registry.get("nitrogeno" as ChemicalSubstanceId)!;

    const carbono: ReactantSubstance = {
      id: carbonoEntity.id,
      name: carbonoEntity.name,
      tags: carbonoEntity.data.tags,
    };
    const nitrogeno: ReactantSubstance = {
      id: nitrogeniEntity.id,
      name: nitrogeniEntity.name,
      tags: nitrogeniEntity.data.tags,
    };

    const resolver = new ReactionResolver();
    const context: ReactionContext = {
      reactants: [carbono, nitrogeno],
      oxygen: "normal",
      ignitionPresent: false,
      thermalRegulatorOverloaded: false,
      elapsedSeconds: 0,
    };
    const outcome = resolver.resolve(context);

    // Ninguna receta nombrada, ninguna regla de tags aplica -> fallback garantizado.
    expect(outcome.result?.name).toMatch(/^Mezcla sin identificar/);
    expect(outcome.result?.tags).toEqual([{ name: "COMB" }, { name: "INERTE" }]);
    // El jugador puede usarla igual aunque no tenga nombre (pilar de diseño 4):
    // sus tags siguen siendo consultables como los de cualquier otra sustancia.
    expect(outcome.result?.id).toBeDefined();
  });
});
