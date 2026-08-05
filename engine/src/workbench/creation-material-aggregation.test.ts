import { describe, expect, it } from "vitest";
import type { MaterialProperties } from "../properties/material.types.js";
import { aggregateCreationMaterial } from "./creation-material-aggregation.js";

describe("workbench: creation material aggregation (deuda #6)", () => {
  it("takes the WORST structural resistance of the parts (weakest link)", () => {
    const aggregated = aggregateCreationMaterial([{ RE: "A" }, { RE: "B" }, { RE: "M" }]);
    expect(aggregated?.RE).toBe("B");
  });

  it("keeps RE when every part shares the same level", () => {
    expect(aggregateCreationMaterial([{ RE: "M" }, { RE: "M" }])?.RE).toBe("M");
  });

  it("is ferromagnetic if ANY part is (caso 17: la creación sirve de proyectil)", () => {
    expect(aggregateCreationMaterial([{ MAG: false }, { MAG: true }])?.MAG).toBe(true);
  });

  it("omits MAG entirely when no part is ferromagnetic (ausente === no magnético)", () => {
    const aggregated = aggregateCreationMaterial([{ MAG: false }, { RE: "A" }]);
    expect(aggregated).not.toHaveProperty("MAG");
  });

  it("takes the HIGHEST electrical conductivity (conducir es propiedad de camino)", () => {
    expect(aggregateCreationMaterial([{ CE: "N" }, { CE: "A" }, { CE: "B" }])?.CE).toBe("A");
  });

  it("takes the HIGHEST thermal conductivity", () => {
    expect(aggregateCreationMaterial([{ CT: "B" }, { CT: "M" }])?.CT).toBe("M");
  });

  it("takes the majority matter state", () => {
    expect(aggregateCreationMaterial([{ ES: "S" }, { ES: "L" }, { ES: "S" }])?.ES).toBe("S");
  });

  it("breaks a matter-state tie deterministically, with the first part that declared one", () => {
    expect(aggregateCreationMaterial([{ ES: "L" }, { ES: "S" }])?.ES).toBe("L");
    expect(aggregateCreationMaterial([{ ES: "S" }, { ES: "L" }])?.ES).toBe("S");
  });

  it("aggregates each property independently (las 3 capas siguen siendo ortogonales)", () => {
    const parts: ReadonlyArray<MaterialProperties> = [
      { CE: "A", RE: "A", ES: "S" },
      { CE: "N", RE: "B", MAG: true, CT: "A", ES: "S" },
    ];
    expect(aggregateCreationMaterial(parts)).toEqual({
      CE: "A",
      CT: "A",
      MAG: true,
      RE: "B",
      ES: "S",
    });
  });

  it("ignores parts without material properties instead of collapsing the result", () => {
    expect(aggregateCreationMaterial([undefined, { RE: "M" }, undefined])?.RE).toBe("M");
  });

  it("returns undefined when NO part declares material properties (no puebla un objeto vacío)", () => {
    expect(aggregateCreationMaterial([undefined, undefined])).toBeUndefined();
    expect(aggregateCreationMaterial([])).toBeUndefined();
    expect(aggregateCreationMaterial([{}])).toBeUndefined();
  });
});
