import { describe, expect, it } from "vitest";
import { atmosphereRedrawKey, signalNodeRedrawKey, signalRedrawKey } from "./tooltip-redraw-key.js";
import type { SectionAtmosphereTooltip, SignalTooltipInfo } from "./widgets/mission-tooltip.js";

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

const signalBase: SignalTooltipInfo = {
  drives: { count: 2, load: 3, capacity: 6 },
  governedBy: { name: "Fotorreceptor", active: false },
  emitting: false,
  burnedWires: 0,
  logic: { kind: "counter", count: 0, threshold: 2, reached: false },
};

/** Una variante por campo de `SignalTooltipInfo`, con un cambio que el jugador SÍ vería. */
const SIGNAL_VARIANTS: { readonly [K in keyof SignalTooltipInfo]-?: SignalTooltipInfo[K] } = {
  drives: { count: 3, load: 5, capacity: 6 },
  governedBy: { name: "Fotorreceptor", active: true },
  emitting: true,
  burnedWires: 1,
  logic: { kind: "counter", count: 1, threshold: 2, reached: false },
};

describe("signalRedrawKey (Deuda #56)", () => {
  it("TODO campo del papel de señal mueve la firma, incluido el estado interno del chip", () => {
    for (const field of Object.keys(SIGNAL_VARIANTS) as Array<keyof SignalTooltipInfo>) {
      const changed = { ...signalBase, [field]: SIGNAL_VARIANTS[field] };
      expect(signalRedrawKey(changed), `el campo "${field}" no entra en la firma`).not.toBe(signalRedrawKey(signalBase));
    }
  });

  it("sin papel de señal la firma es vacía", () => {
    expect(signalRedrawKey(undefined)).toBe("");
  });

  it("el tiempo restante de un retardo sólo mueve la firma cuando cambia el segundo que se muestra", () => {
    const at = (remainingSeconds: number) =>
      signalRedrawKey({ logic: { kind: "delay", delaySeconds: 3, pending: true, remainingSeconds, output: false } });
    expect(at(1.9)).toBe(at(1.1));
    expect(at(1.1)).not.toBe(at(0.9));
  });
});

describe("signalNodeRedrawKey (Deuda #56)", () => {
  const node = { roleLabel: "entrada", ambiguous: false, logic: { kind: "latch", engaged: false } as const };
  it("cambia con el rótulo, la ambigüedad y el estado interno", () => {
    const base = signalNodeRedrawKey(node);
    expect(signalNodeRedrawKey({ ...node, roleLabel: "salida" })).not.toBe(base);
    expect(signalNodeRedrawKey({ ...node, ambiguous: true })).not.toBe(base);
    expect(signalNodeRedrawKey({ ...node, logic: { kind: "latch", engaged: true } })).not.toBe(base);
  });
});
