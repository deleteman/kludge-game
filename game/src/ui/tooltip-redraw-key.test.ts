import { describe, expect, it } from "vitest";
import { atmosphereRedrawKey } from "./tooltip-redraw-key.js";
import type { SectionAtmosphereTooltip } from "./widgets/mission-tooltip.js";

const base: SectionAtmosphereTooltip = {
  pressureKpa: 101,
  trend: "stable",
  vacuum: false,
  temperatureCelsius: 21,
  heating: false,
  selfIgniting: false,
  chemicalAlarm: false,
  oxygen: { percent: 21, bucket: "normal" },
  wiringHeatCelsiusPerSecond: 0,
  substanceStates: [{ name: "Amoníaco", state: "gas", percent: 5 }],
};

/** Una variante por campo, con un cambio que el jugador SÍ vería en el tooltip. */
const VARIANTS: { readonly [K in keyof SectionAtmosphereTooltip]-?: SectionAtmosphereTooltip[K] } = {
  pressureKpa: 90,
  trend: "draining",
  vacuum: true,
  temperatureCelsius: 40,
  heating: true,
  selfIgniting: true,
  chemicalAlarm: true,
  oxygen: { percent: 30, bucket: "rich" },
  wiringHeatCelsiusPerSecond: 2,
  substanceStates: [{ name: "Amoníaco", state: "gas", percent: 12 }],
};

describe("atmosphereRedrawKey", () => {
  it("TODO campo del contenido de atmósfera mueve la firma (el próximo campo vivo ya no puede olvidarse)", () => {
    // `VARIANTS` está tipado exhaustivo: agregar un campo a `SectionAtmosphereTooltip`
    // sin darle variante acá no compila.
    for (const field of Object.keys(VARIANTS) as Array<keyof SectionAtmosphereTooltip>) {
      const changed = { ...base, [field]: VARIANTS[field] };
      expect(atmosphereRedrawKey(changed), `el campo "${field}" no entra en la firma`).not.toBe(atmosphereRedrawKey(base));
    }
  });

  it("el ruido por debajo de lo que el jugador ve no reconstruye el tooltip", () => {
    expect(atmosphereRedrawKey({ ...base, pressureKpa: 101.2, temperatureCelsius: 21.3 })).toBe(atmosphereRedrawKey(base));
  });

  it("sin atmósfera la firma es vacía", () => {
    expect(atmosphereRedrawKey(undefined)).toBe("");
  });
});
