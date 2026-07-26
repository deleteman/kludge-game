import { describe, expect, it } from "vitest";
import { fromSectionAtmosphereSnapshot, toSectionAtmosphereSnapshot } from "./atmosphere-snapshot.types.js";
import { GAS } from "./atmosphere-composition.types.js";
import type { SectionId } from "./section.types.js";
import type { SectionAtmosphere } from "./section.types.js";

const sectionId = "bahia-carga" as SectionId;

describe("atmosphere snapshot (Fase 11b, guardado dinámico)", () => {
  it("round-trips gases/temperatura/presión through the serializable snapshot", () => {
    const atmosphere: SectionAtmosphere = {
      gases: new Map([
        [GAS.OXYGEN, 0.21],
        [GAS.CO2, 0.04],
      ]),
      temperatureCelsius: 18,
      pressureKpa: 99,
    };

    const snapshot = toSectionAtmosphereSnapshot(sectionId, atmosphere);
    expect(snapshot.sectionId).toBe(sectionId);
    expect(snapshot.gases).toEqual([
      [GAS.OXYGEN, 0.21],
      [GAS.CO2, 0.04],
    ]);

    const restored = fromSectionAtmosphereSnapshot(snapshot);
    expect(restored.temperatureCelsius).toBe(18);
    expect(restored.pressureKpa).toBe(99);
    expect(restored.gases).toBeInstanceOf(Map);
    expect(restored.gases.get(GAS.OXYGEN)).toBe(0.21);
    expect(restored.gases.get(GAS.CO2)).toBe(0.04);
  });

  it("survives a JSON.stringify/parse cycle (the actual save path)", () => {
    const atmosphere: SectionAtmosphere = {
      gases: new Map([[GAS.OXYGEN, 0.21]]),
      temperatureCelsius: 21,
      pressureKpa: 101,
    };
    const snapshot = toSectionAtmosphereSnapshot(sectionId, atmosphere);
    const revived = JSON.parse(JSON.stringify(snapshot));
    const restored = fromSectionAtmosphereSnapshot(revived);
    expect(restored.gases.get(GAS.OXYGEN)).toBe(0.21);
  });
});
