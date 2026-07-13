import { describe, expect, it } from "vitest";
import type { MaterialProperties } from "./material.types.js";

describe("properties: material (GDD 5.2)", () => {
  it("allows a partial bag with only the properties the catalog actually documents", () => {
    const copperWire: MaterialProperties = { CE: "A" };
    expect(copperWire).toEqual({ CE: "A" });
    expect(copperWire.CT).toBeUndefined();
  });

  it("accepts the full CE range including the N (none) level unique to CE", () => {
    const levels: MaterialProperties["CE"][] = ["A", "M", "B", "N"];
    expect(levels).toHaveLength(4);
  });

  it("does not let CT/RE take the CE-only N level (compile-time check)", () => {
    // @ts-expect-error CT only accepts A/M/B, not the CE-exclusive "N" level.
    const invalid: MaterialProperties = { CT: "N" };
    expect(invalid).toBeDefined();
  });

  it("represents MAG as an explicit boolean (Sí/No in the GDD)", () => {
    const permanentMagnet: MaterialProperties = { MAG: true };
    expect(permanentMagnet.MAG).toBe(true);
  });

  it("represents ES as a solid/liquid/gas state", () => {
    const sealGasket: MaterialProperties = { ES: "S" };
    expect(sealGasket.ES).toBe("S");
  });
});
