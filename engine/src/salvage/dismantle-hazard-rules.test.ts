import { describe, expect, it } from "vitest";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { standardSectionAtmosphere } from "../atmosphere/section.types.js";
import type { DismantleHazardContext } from "./dismantle-hazard-rules.js";
import {
  HazardousAtmosphereHazardRule,
  PoweredInstanceHazardRule,
  ReservoirContentHazardRule,
} from "./dismantle-hazard-rules.js";
import { assessDismantleHazards, dismantleHazardKinds } from "./dismantle-hazard-assessment.js";
import { SALVAGE_HAZARD_PARAMETERS } from "./salvage-parameters.js";

const INSTANCE_ID = "bateria-1" as PlacedComponentInstanceId;
const SECTION_ID = "pasillo-central" as SectionId;

const INSTANCE: PlacedComponentInstance = {
  instanceId: INSTANCE_ID,
  componentDefinitionId: "bateria-pequena" as ComponentId,
  placement: { position: { x: 3, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
  condition: "ok",
  wear: "nuevo",
};

function contextOf(overrides: Partial<DismantleHazardContext> = {}): DismantleHazardContext {
  return {
    instance: INSTANCE,
    sectionId: SECTION_ID,
    powered: false,
    reservoirContents: [],
    atmosphere: standardSectionAtmosphere(),
    elapsedSeconds: 42,
    ...overrides,
  };
}

function atmosphereWith(overrides: Partial<SectionAtmosphere>): SectionAtmosphere {
  return { ...standardSectionAtmosphere(), ...overrides };
}

describe("PoweredInstanceHazardRule (13d)", () => {
  it("does not apply to an unpowered instance", () => {
    expect(PoweredInstanceHazardRule.appliesTo(contextOf({ powered: false }))).toBe(false);
  });

  it("emits a spark anchored to the instance cell and section", () => {
    const ctx = contextOf({ powered: true });
    expect(PoweredInstanceHazardRule.appliesTo(ctx)).toBe(true);
    expect(PoweredInstanceHazardRule.build(ctx)).toEqual({
      kind: "dismantle-spark",
      instanceId: INSTANCE_ID,
      position: { x: 3, y: 5 },
      sectionId: SECTION_ID,
      elapsedSeconds: 42,
    });
  });
});

describe("ReservoirContentHazardRule (13d)", () => {
  it("does not apply to an empty reservoir", () => {
    const ctx = contextOf({
      reservoirContents: [
        { componentInstanceId: INSTANCE_ID, substanceId: "agua" as ChemicalSubstanceId, amount: 0 },
      ],
    });
    expect(ReservoirContentHazardRule.appliesTo(ctx)).toBe(false);
  });

  it("spills the substance with the largest amount when several coexist", () => {
    const ctx = contextOf({
      reservoirContents: [
        { componentInstanceId: INSTANCE_ID, substanceId: "agua" as ChemicalSubstanceId, amount: 5 },
        { componentInstanceId: INSTANCE_ID, substanceId: "acido" as ChemicalSubstanceId, amount: 12 },
      ],
    });
    expect(ReservoirContentHazardRule.appliesTo(ctx)).toBe(true);
    expect(ReservoirContentHazardRule.build(ctx)).toMatchObject({
      kind: "dismantle-spill",
      substanceId: "acido",
      amount: 12,
    });
  });
});

describe("HazardousAtmosphereHazardRule (13d)", () => {
  it("does not apply to a standard, sealed atmosphere", () => {
    expect(HazardousAtmosphereHazardRule.appliesTo(contextOf())).toBe(false);
  });

  it("applies when the section is already losing pressure", () => {
    const ctx = contextOf({
      atmosphere: atmosphereWith({
        pressureKpa: SALVAGE_HAZARD_PARAMETERS.hazardousPressureKpa - 1,
      }),
    });
    expect(HazardousAtmosphereHazardRule.appliesTo(ctx)).toBe(true);
    expect(HazardousAtmosphereHazardRule.build(ctx)).toMatchObject({
      kind: "dismantle-leak",
      drainRateKpaPerSecond: SALVAGE_HAZARD_PARAMETERS.leakDrainRateKpaPerSecond,
      durationSeconds: SALVAGE_HAZARD_PARAMETERS.leakDurationSeconds,
    });
  });

  it("applies when a contaminant is above the onset concentration", () => {
    const ctx = contextOf({
      atmosphere: atmosphereWith({
        gases: new Map([
          [GAS.OXYGEN, 0.21],
          ["amoniaco", SALVAGE_HAZARD_PARAMETERS.hazardousContaminantConcentration + 0.05],
        ]),
      }),
    });
    expect(HazardousAtmosphereHazardRule.appliesTo(ctx)).toBe(true);
  });

  it("ignores the three standard gases no matter their fraction", () => {
    const ctx = contextOf({
      atmosphere: atmosphereWith({
        gases: new Map([
          [GAS.OXYGEN, 0.5],
          [GAS.NITROGEN, 0.4],
          [GAS.CO2, 0.1],
        ]),
      }),
    });
    expect(HazardousAtmosphereHazardRule.appliesTo(ctx)).toBe(false);
  });

  it("does not apply without a live atmosphere for the section", () => {
    expect(HazardousAtmosphereHazardRule.appliesTo(contextOf({ atmosphere: undefined }))).toBe(false);
  });
});

describe("assessDismantleHazards (13d)", () => {
  it("returns nothing for a dead, empty piece in a healthy section", () => {
    expect(assessDismantleHazards(contextOf())).toEqual([]);
  });

  it("stacks the three hazards: they are orthogonal, not exclusive", () => {
    const kinds = dismantleHazardKinds(
      contextOf({
        powered: true,
        reservoirContents: [
          { componentInstanceId: INSTANCE_ID, substanceId: "acido" as ChemicalSubstanceId, amount: 3 },
        ],
        atmosphere: atmosphereWith({ pressureKpa: 50 }),
      }),
    );
    expect(kinds).toEqual(["dismantle-spark", "dismantle-spill", "dismantle-leak"]);
  });
});
