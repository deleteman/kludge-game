import { describe, expect, it } from "vitest";
import { NeutralizationRule } from "./rules/neutralization.js";
import { CombustionRule } from "./rules/combustion.js";
import { CorrosiveSubstanceRule } from "./rules/corrosive-substance.js";
import { SpontaneousIgnitionRule } from "./rules/spontaneous-ignition.js";
import type { ChemicalSubstanceId } from "../chemical-substance.types.js";
import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { ReactantSubstance, ReactionContext } from "./reaction-context.types.js";

function sub(id: string, tags: ChemicalProperties): ReactantSubstance {
  return { id: id as ChemicalSubstanceId, name: id, tags };
}

function context(
  reactants: ReactantSubstance[],
  overrides: Partial<ReactionContext> = {},
): ReactionContext {
  return {
    reactants,
    oxygen: "normal",
    ignitionPresent: false,
    thermalRegulatorOverloaded: false,
    elapsedSeconds: 0,
    ...overrides,
  };
}

describe("chemistry: NeutralizationRule (GDD 5.3 ácido+base)", () => {
  const rule = new NeutralizationRule();

  it("applies to an acid + a base and yields 'Solución neutralizada' inert", () => {
    const ctx = context([sub("acid", [{ name: "ACID" }]), sub("base", [{ name: "BASE" }])]);
    expect(rule.appliesTo(ctx)).toBe(true);
    const result = rule.apply(ctx);
    expect(result.product?.name).toBe("Solución neutralizada");
    expect(result.product?.tags).toEqual([{ name: "INERTE" }]);
    expect(result.events[0]).toMatchObject({ kind: "neutralization", heatReleasedCelsius: 15 });
  });

  it("does not apply without both an acid and a base", () => {
    expect(rule.appliesTo(context([sub("acid", [{ name: "ACID" }])]))).toBe(false);
  });
});

describe("chemistry: CombustionRule (GDD 5.3 + 5.5 modulada por O2)", () => {
  const rule = new CombustionRule();
  const fuel = sub("fuel", [{ name: "COMB" }]);

  it("is impossible in vacuum with no oxidizer substance", () => {
    expect(rule.appliesTo(context([fuel], { ignitionPresent: true, oxygen: "none" }))).toBe(false);
  });

  it("scales intensity with section O2", () => {
    const low = rule.apply(context([fuel], { ignitionPresent: true, oxygen: "low" }));
    const high = rule.apply(context([fuel], { ignitionPresent: true, oxygen: "high" }));
    expect(low.events[0]).toMatchObject({ kind: "combustion", intensity: "weak" });
    expect(high.events[0]).toMatchObject({ kind: "combustion", intensity: "violent" });
  });

  it("an OXI substance enables violent combustion even in vacuum (caso 11)", () => {
    const ctx = context([fuel, sub("ox", [{ name: "OXI" }])], {
      ignitionPresent: true,
      oxygen: "none",
    });
    expect(rule.appliesTo(ctx)).toBe(true);
    expect(rule.apply(ctx).events[0]).toMatchObject({ intensity: "violent" });
  });
});

describe("chemistry: CorrosiveSubstanceRule (GDD 5.3 corrosivo+sustancia)", () => {
  const rule = new CorrosiveSubstanceRule();

  it("yields 'Gas tóxico derivado' from a corrosive plus another substance", () => {
    const ctx = context([
      sub("corr", [{ name: "CORR", level: "M" }]),
      sub("other", [{ name: "INERTE" }]),
    ]);
    expect(rule.appliesTo(ctx)).toBe(true);
    expect(rule.apply(ctx).product?.name).toBe("Gas tóxico derivado");
  });

  it("does not apply to a lone corrosive", () => {
    expect(rule.appliesTo(context([sub("corr", [{ name: "CORR", level: "M" }])]))).toBe(false);
  });
});

describe("chemistry: SpontaneousIgnitionRule (GDD 5.3 volátil+regulador)", () => {
  const rule = new SpontaneousIgnitionRule();

  it("fires only when a volatile meets an overloaded thermal regulator", () => {
    const volatile = [sub("vol", [{ name: "VOLAT" }])];
    expect(rule.appliesTo(context(volatile, { thermalRegulatorOverloaded: true }))).toBe(true);
    expect(rule.appliesTo(context(volatile, { thermalRegulatorOverloaded: false }))).toBe(false);
    const result = rule.apply(context(volatile, { thermalRegulatorOverloaded: true }));
    expect(result.product).toBeUndefined();
    expect(result.events[0]).toMatchObject({ kind: "spontaneous-ignition" });
  });
});
