import { describe, expect, it } from "vitest";
import { CORROSIVE_ONSET_CONCENTRATION, sectionCorrosiveLevel } from "./corrosive-atmosphere.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { GAS } from "./atmosphere-composition.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionAtmosphere } from "./section.types.js";

const { registry } = buildChemicalCatalog();
const acidoBateria = "acido-de-bateria" as ChemicalSubstanceId;

function atmosphereWith(gases: Record<string, number>): SectionAtmosphere {
  return { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 };
}

describe("sectionCorrosiveLevel (Fase 11b, acople atmósfera → cicatriz estructural)", () => {
  it("returns null when there is no contaminant present", () => {
    const atmosphere = atmosphereWith({ [GAS.OXYGEN]: 0.21 });
    expect(sectionCorrosiveLevel(atmosphere, registry)).toBeNull();
  });

  it("returns null below the onset concentration (trace amounts don't corrode)", () => {
    const atmosphere = atmosphereWith({
      [GAS.OXYGEN]: 0.21,
      [acidoBateria]: CORROSIVE_ONSET_CONCENTRATION,
    });
    expect(sectionCorrosiveLevel(atmosphere, registry)).toBeNull();
  });

  it("returns the CORR level of a substance present above the onset threshold", () => {
    const atmosphere = atmosphereWith({
      [GAS.OXYGEN]: 0.21,
      [acidoBateria]: 0.3,
    });
    expect(sectionCorrosiveLevel(atmosphere, registry)).toBe("A");
  });

  it("ignores gases that don't resolve to a catalog substance (standard gases)", () => {
    const atmosphere = atmosphereWith({ [GAS.CO2]: 0.5 });
    expect(sectionCorrosiveLevel(atmosphere, registry)).toBeNull();
  });
});
