import { describe, expect, it } from "vitest";
import type { SectionId } from "engine";
import { formatLcdValue } from "./lcd-format.js";

const sectionId = "sala" as SectionId;

describe("formatLcdValue", () => {
  it("cada variante lleva su valor con un decimal y su unidad", () => {
    expect(formatLcdValue({ kind: "pressure", sectionId, pressureKpa: 87 })).toMatch(/^87\.0 \S+/);
    expect(formatLcdValue({ kind: "temperature", sectionId, temperatureCelsius: 73.26 })).toMatch(/^73\.3 \S+/);
    expect(formatLcdValue({ kind: "chemical", sectionId, concentration: 0.125 })).toMatch(/^12\.5 \S+/);
  });

  it("las unidades no son claves sin traducir", () => {
    for (const text of [
      formatLcdValue({ kind: "pressure", sectionId, pressureKpa: 1 }),
      formatLcdValue({ kind: "temperature", sectionId, temperatureCelsius: 1 }),
      formatLcdValue({ kind: "chemical", sectionId, concentration: 0.01 }),
    ]) {
      expect(text).not.toContain("ui.floorplan");
    }
  });
});
