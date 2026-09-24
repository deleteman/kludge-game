import { describe, expect, it } from "vitest";
import {
  NODE_BEHAVIOR_OPTIONS,
  behaviorForOption,
  optionOf,
  parameterOf,
  stepBehaviorParameter,
} from "./node-behavior-options.js";

describe("node-behavior-options", () => {
  it("un nodo sin behavior o passthrough se muestra como OR", () => {
    expect(optionOf(undefined)).toBe("OR");
    expect(optionOf({ kind: "passthrough" })).toBe("OR");
    expect(optionOf({ kind: "gate", mode: "NOT" })).toBe("NOT");
    expect(optionOf({ kind: "counter", threshold: 2 })).toBe("counter");
  });

  it("cada opción ofrecida produce un behavior cuya opción vuelve a ser ella misma", () => {
    for (const option of NODE_BEHAVIOR_OPTIONS) {
      expect(optionOf(behaviorForOption(option))).toBe(option);
    }
  });

  it("sólo delay, oscillator y counter tienen parámetro editable", () => {
    expect(parameterOf(behaviorForOption("AND"))).toBeUndefined();
    expect(parameterOf(behaviorForOption("latch"))).toBeUndefined();
    expect(parameterOf(behaviorForOption("delay"))?.unit).toBe("seconds");
    expect(parameterOf(behaviorForOption("counter"))?.unit).toBe("count");
  });

  it("el paso sube y baja el parámetro sin bajar del mínimo ni acumular ruido decimal", () => {
    let behavior = behaviorForOption("delay");
    for (let i = 0; i < 3; i++) behavior = stepBehaviorParameter(behavior, 1);
    expect(behavior).toEqual({ kind: "delay", delaySeconds: 2.5 });
    for (let i = 0; i < 10; i++) behavior = stepBehaviorParameter(behavior, -1);
    expect(behavior).toEqual({ kind: "delay", delaySeconds: 0.5 });
    expect(stepBehaviorParameter({ kind: "counter", threshold: 1 }, -1)).toEqual({ kind: "counter", threshold: 1 });
    expect(stepBehaviorParameter({ kind: "latch" }, 1)).toEqual({ kind: "latch" });
  });
});
