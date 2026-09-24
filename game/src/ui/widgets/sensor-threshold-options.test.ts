import { describe, expect, it } from "vitest";
import { defaultSensorThreshold } from "engine";
import {
  canStepSensorThreshold,
  isDefaultSensorThreshold,
  stepSensorThreshold,
} from "./sensor-threshold-options.js";

describe("sensor-threshold-options", () => {
  it("el paso usa el de cada sensor y no acumula ruido decimal (química: 0.01)", () => {
    let config = defaultSensorThreshold("chemical");
    for (let i = 0; i < 3; i++) config = stepSensorThreshold("chemical", config, 1);
    expect(config.value).toBe(0.08);
    expect(stepSensorThreshold("thermal", defaultSensorThreshold("thermal"), 1).value).toBe(65);
    expect(stepSensorThreshold("pressure", defaultSensorThreshold("pressure"), -1).value).toBe(100);
  });

  it("no sale del rango que declara el motor", () => {
    const low = { kind: "sensor-threshold", comparator: ">", value: 0.01 } as const;
    expect(stepSensorThreshold("chemical", low, -1).value).toBe(0.01);
    expect(canStepSensorThreshold("chemical", low, -1)).toBe(false);
    expect(canStepSensorThreshold("chemical", low, 1)).toBe(true);
    const high = { kind: "sensor-threshold", comparator: "<", value: 200 } as const;
    expect(canStepSensorThreshold("pressure", high, 1)).toBe(false);
  });

  it("reconoce el valor de fábrica para deshabilitar 'Restaurar'", () => {
    expect(isDefaultSensorThreshold("thermal", defaultSensorThreshold("thermal"))).toBe(true);
    expect(isDefaultSensorThreshold("thermal", { kind: "sensor-threshold", comparator: "<", value: 60 })).toBe(false);
  });
});
