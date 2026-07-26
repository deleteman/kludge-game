import { describe, expect, it } from "vitest";
import { synthesizeSubstance, SynthesisError } from "./synthesize-substance.js";
import { ReactionResolver } from "../reaction/reaction-resolver.js";
import { buildChemicalCatalog } from "../catalog/build-chemical-catalog.js";
import type { ChemicalSubstanceId } from "../chemical-substance.types.js";

const id = (raw: string): ChemicalSubstanceId => raw as ChemicalSubstanceId;

describe("chemistry production — synthesizeSubstance (Fase 11c.3)", () => {
  it("cablea el catálogo real: hidrógeno×2 + oxígeno → Agua (receta nombrada)", () => {
    const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
    const resolver = new ReactionResolver({ namedRecipeIndex });

    const outcome = synthesizeSubstance(resolver, registry, factory, [
      id("hidrogeno"),
      id("hidrogeno"),
      id("oxigeno"),
    ]);

    expect(outcome.result?.name).toBe("Agua");
  });

  it("la misma pareja de elementos en otra proporción da un compuesto distinto: hidrógeno×2 + oxígeno×2 → Peróxido", () => {
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

  it("sin receta ni regla: fallback a Mezcla sin identificar, y el resultado queda registrado y resoluble por id", () => {
    const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
    const resolver = new ReactionResolver({ namedRecipeIndex });

    const outcome = synthesizeSubstance(resolver, registry, factory, [
      id("carbono"),
      id("nitrogeno"),
    ]);

    expect(outcome.result?.name).toMatch(/^Mezcla sin identificar/);
    const resultId = outcome.result!.id;
    expect(registry.has(resultId)).toBe(true);
    expect(registry.get(resultId)?.name).toBe(outcome.result!.name);
  });

  it("una receta nombrada ya presente en el catálogo (agua) no se reinscribe", () => {
    const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
    const resolver = new ReactionResolver({ namedRecipeIndex });
    const before = registry.get(id("agua"));

    synthesizeSubstance(resolver, registry, factory, [id("hidrogeno"), id("hidrogeno"), id("oxigeno")]);

    expect(registry.get(id("agua"))).toBe(before);
  });

  it("rechaza sintetizar con menos de 2 sustancias seleccionadas", () => {
    const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
    const resolver = new ReactionResolver({ namedRecipeIndex });

    expect(() => synthesizeSubstance(resolver, registry, factory, [id("hidrogeno")])).toThrow(
      SynthesisError,
    );
  });

  it("rechaza un id de sustancia desconocido", () => {
    const { registry, factory, namedRecipeIndex } = buildChemicalCatalog();
    const resolver = new ReactionResolver({ namedRecipeIndex });

    expect(() =>
      synthesizeSubstance(resolver, registry, factory, [id("hidrogeno"), id("no-existe")]),
    ).toThrow(SynthesisError);
  });
});
