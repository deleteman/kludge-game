import { describe, expect, it } from "vitest";

import { actorLightLevel, MIN_ACTOR_LIGHT_LEVEL, NEUTRAL_TINT, shade } from "./light-shading.js";

describe("shade", () => {
  it("a nivel 1 devuelve el color intacto", () => {
    expect(shade(0xffd9a0, 1)).toBe(0xffd9a0);
    expect(shade(NEUTRAL_TINT, 1)).toBe(NEUTRAL_TINT);
  });

  it("a nivel 0 devuelve negro", () => {
    expect(shade(0xffd9a0, 0)).toBe(0x000000);
  });

  it("escala cada canal por separado", () => {
    expect(shade(0xff8000, 0.5)).toBe(0x804000);
  });

  it("conserva el matiz del color base (no lo tiñe de gris)", () => {
    const shaded = shade(0x00ff00, 0.5);
    expect((shaded >> 16) & 0xff).toBe(0);
    expect(shaded & 0xff).toBe(0);
    expect((shaded >> 8) & 0xff).toBeGreaterThan(0);
  });

  it("recorta niveles fuera de rango en vez de desbordar el color", () => {
    expect(shade(0xffffff, 2)).toBe(0xffffff);
    expect(shade(0xffffff, -1)).toBe(0x000000);
  });
});

describe("actorLightLevel", () => {
  it("nunca baja del piso legible, por oscura que esté la celda", () => {
    expect(actorLightLevel(0)).toBe(MIN_ACTOR_LIGHT_LEVEL);
    expect(actorLightLevel(0.1)).toBe(MIN_ACTOR_LIGHT_LEVEL);
  });

  it("respeta el nivel real cuando ya supera el piso", () => {
    expect(actorLightLevel(0.9)).toBe(0.9);
    expect(actorLightLevel(1)).toBe(1);
  });

  it("el piso deja al actor claramente visible (no es casi negro)", () => {
    expect(MIN_ACTOR_LIGHT_LEVEL).toBeGreaterThan(0.3);
  });
});
