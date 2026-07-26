import { describe, expect, it } from "vitest";
import { RangedProximityRule } from "./ranged-proximity-rule.js";
import type { CombatEvalContext } from "../combat-rule.js";

const actuator = { tag: "ACT" as const, power: 80, cadence: 5, directional: true };
const longRangeEmitter = { tag: "EM" as const, range: 18, triggerType: "motion", frequency: 2 };
const shortRangeEmitter = { tag: "EM" as const, range: 2, triggerType: "motion", frequency: 2 };

describe("ranged-proximity-rule: RangedProximityRule (Fase 11d)", () => {
  it("aplica a distancia 2 y 3 con un arma EM+ACT de alcance suficiente", () => {
    expect(RangedProximityRule.appliesTo({ distance: 2, actuator, emitter: longRangeEmitter })).toBe(true);
    expect(RangedProximityRule.appliesTo({ distance: 3, actuator, emitter: longRangeEmitter })).toBe(true);
  });

  it("no aplica a distancia 1 (le corresponde a la regla de melee, no a esta)", () => {
    expect(RangedProximityRule.appliesTo({ distance: 1, actuator, emitter: longRangeEmitter })).toBe(false);
  });

  it("no aplica a distancia 4 (fuera de la ventana 2-3)", () => {
    expect(RangedProximityRule.appliesTo({ distance: 4, actuator, emitter: longRangeEmitter })).toBe(false);
  });

  it("no aplica si el EM.range del arma es menor a la distancia real", () => {
    const ctx: CombatEvalContext = { distance: 3, actuator, emitter: shortRangeEmitter };
    expect(RangedProximityRule.appliesTo(ctx)).toBe(false);
  });

  it("no aplica sin un EM resuelto (arma cuerpo a cuerpo, sin alcance)", () => {
    expect(RangedProximityRule.appliesTo({ distance: 2, actuator })).toBe(false);
  });
});
