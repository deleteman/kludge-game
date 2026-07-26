import { describe, expect, it } from "vitest";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import { REACTION_PARAMETERS } from "./reaction-parameters.js";
import { deriveMixtureHazardPreview } from "./mixture-hazard-preview.js";

describe("deriveMixtureHazardPreview (Fase 11e)", () => {
  it("no combustible ni corrosiva sin los tags relevantes", () => {
    const tags: ChemicalProperties = [{ name: "INERTE" }];

    const preview = deriveMixtureHazardPreview(tags, "normal");

    expect(preview).toEqual({ combustible: false, corrosive: false });
  });

  it("combustible con COMB revela el bucket de radio según el O2 de la sección", () => {
    const tags: ChemicalProperties = [{ name: "COMB" }];

    expect(deriveMixtureHazardPreview(tags, "normal").combustionRadius).toBe("half-section");
    expect(deriveMixtureHazardPreview(tags, "high").combustionRadius).toBe("full-section");
    expect(deriveMixtureHazardPreview(tags, "low").combustionRadius).toBe("none");
  });

  it("sin O2 en la sección (vacío), no hay radio aunque la mezcla sea combustible y no tenga OXI propio", () => {
    const tags: ChemicalProperties = [{ name: "VOLAT" }];

    expect(deriveMixtureHazardPreview(tags, "none").combustionRadius).toBeUndefined();
  });

  it("el tag OXI de la propia mezcla fuerza O2 efectivo alto, igual que CombustionRule.effectiveOxygen", () => {
    const tags: ChemicalProperties = [{ name: "COMB" }, { name: "OXI" }];

    expect(deriveMixtureHazardPreview(tags, "low").combustionRadius).toBe("full-section");
    expect(deriveMixtureHazardPreview(tags, "none").combustionRadius).toBe("full-section");
  });

  it("corrosiva con CORR expone los segundos por nivel leídos de REACTION_PARAMETERS, no un literal duplicado", () => {
    const tags: ChemicalProperties = [{ name: "CORR", level: "M" }];

    const preview = deriveMixtureHazardPreview(tags, "normal");

    expect(preview.corrosive).toBe(true);
    expect(preview.corrosionSecondsPerLevel).toEqual({
      medium: REACTION_PARAMETERS.corrosion.structuralLevelSecondsMedium,
      high: REACTION_PARAMETERS.corrosion.structuralLevelSecondsHigh,
    });
  });

  it("es pura: la misma entrada produce siempre la misma salida", () => {
    const tags: ChemicalProperties = [{ name: "COMB" }, { name: "CORR", level: "A" }];

    const first = deriveMixtureHazardPreview(tags, "normal");
    const second = deriveMixtureHazardPreview(tags, "normal");

    expect(first).toEqual(second);
  });
});
