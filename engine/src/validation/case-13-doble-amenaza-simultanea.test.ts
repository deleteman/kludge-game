// GDD 9, caso 13 — "Doble Amenaza Simultánea": una fuga CORR+TOX junto a un oxidante cercano dispara combustión y corrosivo a la vez → valida prioridad y stacking entre reglas (Espec. §2).
import { describe, expect, it } from "vitest";
import {
  ReactionResolver,
  type ChemicalProperties,
  type ChemicalSubstanceId,
  type ReactantSubstance,
  type ReactionContext,
} from "../index.js";

const id = (raw: string): ChemicalSubstanceId => raw as ChemicalSubstanceId;
const sub = (name: string, tags: ChemicalProperties): ReactantSubstance => ({
  id: id(name),
  name,
  tags,
});

describe("case 13 — Doble Amenaza Simultánea", () => {
  it("combustion (higher priority) consumes first, then corrosive re-evaluates over the residue, not the original reactants", () => {
    const fugaCorrTox = sub("fuga corrosiva y tóxica", [
      { name: "CORR", level: "M" },
      { name: "TOX", level: "M" },
    ]);
    const oxidanteCercano = sub("oxidante cercano", [{ name: "OXI" }]);
    const combustible = sub("combustible", [{ name: "COMB" }]);

    const resolver = new ReactionResolver();
    const context: ReactionContext = {
      reactants: [fugaCorrTox, oxidanteCercano, combustible],
      oxygen: "normal",
      ignitionPresent: true,
      thermalRegulatorOverloaded: false,
      elapsedSeconds: 0,
    };
    const outcome = resolver.resolve(context);

    // Orden de prioridad (Espec. §2): neutralización > combustión > ... El
    // oxidante+combustible+ignición dispara combustión primero, consumiendo
    // esos dos reactivos; el corrosivo (que quedó fuera de la combustión) se
    // re-evalúa DESPUÉS, sobre el residuo de combustión — no sobre los
    // reactivos originales.
    expect(outcome.appliedRuleIds).toEqual(["combustion", "corrosive-substance"]);
    expect(outcome.events.some((e) => e.kind === "combustion")).toBe(true);
    expect(outcome.result?.name).toBe("Gas tóxico derivado");
  });
});
