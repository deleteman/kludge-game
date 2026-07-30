import { describe, expect, it } from "vitest";

import {
  AUTHORED_LIGHT_DEFAULT_COLOR,
  AUTHORED_LIGHT_DEFAULT_INTENSITY,
  AUTHORED_LIGHT_DEFAULT_RADIUS_PX,
  toAuthoredLightSpec,
} from "./authored-lights.js";

describe("toAuthoredLightSpec", () => {
  it("aplica todos los defaults cuando el objeto no trae propiedades", () => {
    const spec = toAuthoredLightSpec({ x: 100, y: 200 });
    expect(spec).toEqual({
      x: 100,
      y: 200,
      color: AUTHORED_LIGHT_DEFAULT_COLOR,
      radius: AUTHORED_LIGHT_DEFAULT_RADIUS_PX,
      intensity: AUTHORED_LIGHT_DEFAULT_INTENSITY,
    });
  });

  it("respeta color/radius/intensity autorados", () => {
    const spec = toAuthoredLightSpec({
      x: 10,
      y: 20,
      properties: [
        { name: "color", value: "#3366ff" },
        { name: "radius", value: 90 },
        { name: "intensity", value: 0.4 },
      ],
    });
    expect(spec.color).toBe(0x3366ff);
    expect(spec.radius).toBe(90);
    expect(spec.intensity).toBe(0.4);
  });

  it("acepta color como 0x…, sin # y como número", () => {
    expect(toAuthoredLightSpec({ x: 0, y: 0, properties: [{ name: "color", value: "0xff0000" }] }).color).toBe(0xff0000);
    expect(toAuthoredLightSpec({ x: 0, y: 0, properties: [{ name: "color", value: "00ff00" }] }).color).toBe(0x00ff00);
    expect(toAuthoredLightSpec({ x: 0, y: 0, properties: [{ name: "color", value: 0x0000ff }] }).color).toBe(0x0000ff);
  });

  it("cae al default con color inválido o tipos equivocados", () => {
    expect(toAuthoredLightSpec({ x: 0, y: 0, properties: [{ name: "color", value: "nope" }] }).color).toBe(
      AUTHORED_LIGHT_DEFAULT_COLOR,
    );
    expect(toAuthoredLightSpec({ x: 0, y: 0, properties: [{ name: "radius", value: "big" }] }).radius).toBe(
      AUTHORED_LIGHT_DEFAULT_RADIUS_PX,
    );
  });
});
