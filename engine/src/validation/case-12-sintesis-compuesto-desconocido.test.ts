// GDD 9, caso 12 — "Síntesis de un Compuesto Desconocido": elementos base combinados en una proporción sin receta nombrada → fallback "Mezcla sin identificar" (unión de tags, GDD 5.3 paso 3).
import { describe, expect, it } from "vitest";
import {
  ReactionResolver,
  buildChemicalCatalog,
  synthesizeSubstance,
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

  // Fase 11c.3 — extiende el caso 12 más allá del fallback: el mismo catálogo real,
  // pero a través del punto de entrada de producción (`synthesizeSubstance`), que es
  // lo que el jugador dispara desde la mesa de creación. Antes de esta fase, nada en
  // la suite construía un `NamedRecipeIndex` desde el catálogo real ni pasaba por
  // este flujo — solo se probaba el `ReactionResolver` pelado.
  describe("extensión: síntesis vía producción con el catálogo real (paso 1 y 2)", () => {
    const id = (raw: string): ChemicalSubstanceId => raw as ChemicalSubstanceId;

    it("receta nombrada: hidrógeno×2 + oxígeno → Agua", () => {
      const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
      const resolver = new ReactionResolver({ namedRecipeIndex });

      const outcome = synthesizeSubstance(resolver, registry, factory, [
        id("hidrogeno"),
        id("hidrogeno"),
        id("oxigeno"),
      ]);

      expect(outcome.result?.name).toBe("Agua");
    });

    it("la misma pareja de elementos en otra proporción sintetiza un compuesto distinto (GDD 5.4.2: Agua 2:1 vs Peróxido 2:2)", () => {
      const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
      const resolver = new ReactionResolver({ namedRecipeIndex });

      const outcome = synthesizeSubstance(resolver, registry, factory, [
        id("hidrogeno"),
        id("hidrogeno"),
        id("oxigeno"),
        id("oxigeno"),
      ]);

      expect(outcome.result?.name).toBe("Peróxido");
    });

    it("sin receta nombrada pero con regla por tags aplicable: ácido + base de laboratorio → Solución neutralizada", () => {
      const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
      const resolver = new ReactionResolver({ namedRecipeIndex });

      const outcome = synthesizeSubstance(resolver, registry, factory, [
        id("acido-de-laboratorio"),
        id("base-de-laboratorio"),
      ]);

      expect(outcome.result?.name).toMatch(/^Solución neutralizada/);
    });

    it("el fallback de esta misma síntesis, a través de producción, queda registrado y resoluble por id", () => {
      const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
      const resolver = new ReactionResolver({ namedRecipeIndex });

      const outcome = synthesizeSubstance(resolver, registry, factory, [
        id("carbono"),
        id("nitrogeno"),
      ]);

      expect(outcome.result?.name).toMatch(/^Mezcla sin identificar/);
      expect(registry.has(outcome.result!.id)).toBe(true);
    });
  });
});
