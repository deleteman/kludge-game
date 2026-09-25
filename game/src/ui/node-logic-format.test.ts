import { describe, expect, it } from "vitest";
import type { NodeLogicSummary } from "engine";
import { formatNodeLogic } from "./node-logic-format.js";

const SAMPLES: ReadonlyArray<NodeLogicSummary> = [
  { kind: "gate", mode: "AND", inputs: { active: 1, total: 2 }, output: false },
  { kind: "gate", mode: "NOT", inputs: { active: 0, total: 1 }, output: true },
  { kind: "latch", engaged: true },
  { kind: "latch", engaged: false },
  { kind: "counter", count: 1, threshold: 2, reached: false },
  { kind: "counter", count: 2, threshold: 2, reached: true },
  { kind: "oscillator", periodSeconds: 1, running: true, output: true },
  { kind: "oscillator", periodSeconds: 1, running: false, output: false },
  { kind: "delay", delaySeconds: 3, pending: true, remainingSeconds: 1.2, output: false },
  { kind: "delay", delaySeconds: 3, pending: false, remainingSeconds: 0, output: true },
];

describe("formatNodeLogic", () => {
  it("cada variante produce texto sin claves de i18n sin traducir ni marcadores sin reemplazar", () => {
    for (const sample of SAMPLES) {
      const text = formatNodeLogic(sample);
      expect(text, JSON.stringify(sample)).not.toContain("ui.floorplan");
      expect(text, JSON.stringify(sample)).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("lleva los números que el jugador necesita para depurar", () => {
    expect(formatNodeLogic(SAMPLES[0]!)).toContain("1 de 2");
    expect(formatNodeLogic(SAMPLES[4]!)).toContain("1/2");
    expect(formatNodeLogic(SAMPLES[5]!)).toContain("2/2");
  });

  it("un retardo en curso redondea el tiempo restante hacia arriba: no cambia el texto (ni la firma) entre ticks", () => {
    const at = (remainingSeconds: number): string =>
      formatNodeLogic({ kind: "delay", delaySeconds: 3, pending: true, remainingSeconds, output: false });
    expect(at(1.9)).toBe(at(1.1));
    expect(at(1.1)).not.toBe(at(0.9));
  });
});
