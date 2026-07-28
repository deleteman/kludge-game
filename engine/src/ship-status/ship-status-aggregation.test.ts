import { describe, expect, it } from "vitest";

import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { GAS, STANDARD_OXYGEN_FRACTION } from "../atmosphere/atmosphere-composition.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import {
  aggregateAtmosphere,
  aggregateEnergy,
  aggregateHullIntegrity,
  aggregateLifeSupport,
  fractionToLevel,
} from "./ship-status-aggregation.js";

const { registry: chemicalRegistry } = buildChemicalCatalog();
const { registry: componentRegistry } = buildComponentCatalog();
const cloro = "cloro" as ChemicalSubstanceId;
const planchaMetalica = "plancha-metalica" as ComponentId; // material.RE = "M"

function atmosphereWith(gases: Record<string, number>): SectionAtmosphere {
  return { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 };
}

function placedInstance(
  overrides: Partial<PlacedComponentInstance> & { readonly componentDefinitionId: ComponentId },
): PlacedComponentInstance {
  return {
    instanceId: "instance-1" as PlacedComponentInstanceId,
    placement: { position: { x: 0, y: 0 }, rotation: 0 } as PlacedComponentInstance["placement"],
    condition: "ok",
    ...overrides,
  };
}

describe("fractionToLevel (Subfase 11g)", () => {
  it("mirrors the 3-tier cut used by hpBarColor: >0.5 nominal, >0.25 warning, resto critical", () => {
    expect(fractionToLevel(1)).toBe("nominal");
    expect(fractionToLevel(0.51)).toBe("nominal");
    expect(fractionToLevel(0.5)).toBe("warning");
    expect(fractionToLevel(0.26)).toBe("warning");
    expect(fractionToLevel(0.25)).toBe("critical");
    expect(fractionToLevel(0)).toBe("critical");
  });
});

describe("aggregateAtmosphere (peor sección gana)", () => {
  it("returns nominal (fraction 1) with no sections", () => {
    expect(aggregateAtmosphere([], chemicalRegistry)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("returns nominal when no toxic gas is present anywhere", () => {
    const result = aggregateAtmosphere(
      [{ atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) }],
      chemicalRegistry,
    );
    expect(result.level).toBe("nominal");
  });

  it("a single critically-toxic section drags the ship-wide aggregate down even if others are clean", () => {
    const clean = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) };
    const poisoned = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: 0.1, [cloro]: 0.6 }) };
    const result = aggregateAtmosphere([clean, poisoned], chemicalRegistry);
    expect(result.level).toBe("critical");
  });

  it("Subfase 11h: una fuga de presión sin gas tóxico también degrada el indicador", () => {
    const leaking = {
      atmosphere: { ...atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }), pressureKpa: 40 },
    };
    const result = aggregateAtmosphere([leaking], chemicalRegistry);
    // 40/101 ≈ 0.396 → "warning", no "critical": el piso real de la fuga
    // (`PRESSURE_SINK_FLOOR_KPA`, `mission-atmosphere-runtime.ts`) es
    // justamente 40 kPa — "fuga menor" por diseño, nunca llega a crítico.
    expect(result.level).toBe("warning");
    expect(result.fraction).toBeCloseTo(40 / 101, 5);
  });

  it("Subfase 11h: una fuga en una sección degrada el agregado aunque otra esté a presión estándar", () => {
    const clean = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) };
    const leaking = {
      atmosphere: { ...atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }), pressureKpa: 35 },
    };
    const result = aggregateAtmosphere([clean, leaking], chemicalRegistry);
    expect(result.level).toBe("warning");
  });
});

describe("aggregateLifeSupport (respirabilidad, peor sección gana)", () => {
  it("returns nominal with standard oxygen", () => {
    const result = aggregateLifeSupport([{ atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) }]);
    expect(result.level).toBe("nominal");
  });

  it("returns critical when a section has no breathable oxygen", () => {
    const result = aggregateLifeSupport([{ atmosphere: atmosphereWith({ [GAS.OXYGEN]: 0 }) }]);
    expect(result).toEqual({ level: "critical", fraction: 0 });
  });
});

describe("aggregateHullIntegrity (peor RE gana, destroyed fuerza crítico)", () => {
  it("returns nominal (fraction 1) with no structural components", () => {
    expect(aggregateHullIntegrity([], componentRegistry)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("orders A > M > B: an M-level instance is worse than default nominal", () => {
    const result = aggregateHullIntegrity(
      [placedInstance({ componentDefinitionId: planchaMetalica })],
      componentRegistry,
    );
    expect(result.level).toBe("warning");
  });

  it("a destroyed instance forces critical regardless of its RE level", () => {
    const result = aggregateHullIntegrity(
      [placedInstance({ componentDefinitionId: planchaMetalica, condition: "destroyed" })],
      componentRegistry,
    );
    expect(result).toEqual({ level: "critical", fraction: 0 });
  });
});

describe("aggregateEnergy (fracción de secciones con suministro)", () => {
  it("returns nominal with no unpowered sections", () => {
    expect(aggregateEnergy(0, 4)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("returns critical when every section is unpowered", () => {
    expect(aggregateEnergy(4, 4)).toEqual({ level: "critical", fraction: 0 });
  });

  it("returns a partial fraction for a partial outage", () => {
    const result = aggregateEnergy(1, 4);
    expect(result.fraction).toBeCloseTo(0.75);
    expect(result.level).toBe("nominal");
  });

  it("returns nominal (fraction 1) for a ship with no sections (edge case)", () => {
    expect(aggregateEnergy(0, 0)).toEqual({ level: "nominal", fraction: 1 });
  });
});
