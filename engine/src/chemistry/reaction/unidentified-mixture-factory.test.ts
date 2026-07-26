import { describe, expect, it } from "vitest";
import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ReactantSubstance } from "./reaction-context.types.js";
import { createUnidentifiedMixture } from "./unidentified-mixture-factory.js";

function reactant(id: string, tags: ReactantSubstance["tags"]): ReactantSubstance {
  return { id: id as ChemicalSubstanceId, name: id, tags };
}

describe("createUnidentifiedMixture", () => {
  it("nombra la mezcla por sus tags dominantes, unidos sin cancelarse", () => {
    const mixture = createUnidentifiedMixture([
      reactant("a", [{ name: "VOLAT" }]),
      reactant("b", [{ name: "CORR", level: "M" }]),
    ]);

    expect(mixture.name).toBe("Mezcla sin identificar (Volátil, Corrosiva)");
  });

  it("da ids distintos a mezclas con conjuntos de tags distintos (regresión: antes colisionaban en un id fijo)", () => {
    const volatil = createUnidentifiedMixture([reactant("a", [{ name: "VOLAT" }])]);
    const corrosiva = createUnidentifiedMixture([reactant("b", [{ name: "CORR", level: "M" }])]);

    expect(volatil.id).not.toBe(corrosiva.id);
  });

  it("da el mismo id a mezclas con el mismo conjunto de tags (misma sustancia, GDD 5.3)", () => {
    const first = createUnidentifiedMixture([reactant("a", [{ name: "VOLAT" }, { name: "CORR", level: "M" }])]);
    const second = createUnidentifiedMixture([
      reactant("x", [{ name: "VOLAT" }]),
      reactant("y", [{ name: "CORR", level: "M" }]),
    ]);

    expect(first.id).toBe(second.id);
  });

  it("distingue el nivel de un tag con nivel al derivar el id", () => {
    const medio = createUnidentifiedMixture([reactant("a", [{ name: "CORR", level: "M" }])]);
    const alto = createUnidentifiedMixture([reactant("a", [{ name: "CORR", level: "A" }])]);

    expect(medio.id).not.toBe(alto.id);
  });
});
