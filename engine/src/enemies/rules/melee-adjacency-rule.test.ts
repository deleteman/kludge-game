import { describe, expect, it } from "vitest";
import { MeleeAdjacencyRule } from "./melee-adjacency-rule.js";
import type { CombatEvalContext } from "../combat-rule.js";

const actuator = { tag: "ACT" as const, power: 50, cadence: 4, directional: true };
const emitter = { tag: "EM" as const, range: 18, triggerType: "motion", frequency: 2 };

describe("melee-adjacency-rule: MeleeAdjacencyRule (Fase 11d)", () => {
  it("aplica a distancia 1 con un arma solo ACT (sin EM)", () => {
    const ctx: CombatEvalContext = { distance: 1, actuator };
    expect(MeleeAdjacencyRule.appliesTo(ctx)).toBe(true);
  });

  it("no aplica a distancia 2, aunque el arma sea solo ACT", () => {
    const ctx: CombatEvalContext = { distance: 2, actuator };
    expect(MeleeAdjacencyRule.appliesTo(ctx)).toBe(false);
  });

  it("no aplica si el arma tiene EM (es un arma a distancia, no cuerpo a cuerpo)", () => {
    const ctx: CombatEvalContext = { distance: 1, actuator, emitter };
    expect(MeleeAdjacencyRule.appliesTo(ctx)).toBe(false);
  });

  it("no aplica sin un ACT resuelto (el componente no porta arma)", () => {
    const ctx: CombatEvalContext = { distance: 1 };
    expect(MeleeAdjacencyRule.appliesTo(ctx)).toBe(false);
  });
});
