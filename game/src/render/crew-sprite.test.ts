import { describe, expect, it } from "vitest";

import { faceX } from "./crew-sprite.js";

/**
 * `faceX` gobierna el "mira hacia donde camina" del token de tripulante. El
 * sprite mira a la IZQUIERDA por defecto → moverse a la derecha exige voltear.
 */
describe("faceX", () => {
  it("voltea (flipX true) al moverse hacia la derecha", () => {
    expect(faceX(100, 140, false)).toBe(true);
  });

  it("no voltea (flipX false) al moverse hacia la izquierda", () => {
    expect(faceX(100, 60, true)).toBe(false);
  });

  it("conserva la cara actual en un desplazamiento vertical puro (mismo x)", () => {
    expect(faceX(100, 100, true)).toBe(true);
    expect(faceX(100, 100, false)).toBe(false);
  });
});
