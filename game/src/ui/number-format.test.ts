import { describe, expect, it } from "vitest";
import { formatMeasure } from "./number-format.js";

/**
 * Ronda 2 de playtest de 14b-2: `formatMeasure` ya existía (nació en 14a-3
 * ronda 1) pero nunca tuvo test propio, y un segundo consumidor —el panel de
 * reservorio de 13e— seguía usando `String(value)` sin pasar por acá. Este
 * test ancla el único punto de choque que le queda a esa clase de bug.
 */
describe("formatMeasure", () => {
  it("un entero se lee como entero, sin .0 sobrante", () => {
    expect(formatMeasure(120)).toBe("120");
    expect(formatMeasure(0)).toBe("0");
  });

  it("un float se corta a 1 decimal", () => {
    // El caso real reportado por el operador: resta de floats acumulada
    // tick a tick en el ledger del reservorio.
    expect(formatMeasure(24.273279999999)).toBe("24.3");
  });

  it("un float negativo también se corta a 1 decimal", () => {
    expect(formatMeasure(-10.9483472938279)).toBe("-10.9");
  });
});
