import { describe, expect, it } from "vitest";
import { defaultLedTrigger, ledTriggerKindsFor } from "./led-trigger.js";
import { isOutputIndicatorShape, isValidOutputIndicator } from "./instance-config-validation.js";
import { LED_INDICATOR_COMPONENT_ID, hasConfigurableLogic, isConfigurableIndicator } from "./configurable-of.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { OutputIndicatorConfig } from "./instance-config.types.js";
import type { ComponentId } from "../components/physical-component.types.js";

const cfg = (trigger: OutputIndicatorConfig["trigger"]): OutputIndicatorConfig => ({
  kind: "output-indicator",
  color: "green",
  trigger,
});

describe("instance-config: qué triggers ofrece un LED según lo cableado", () => {
  it("sin sensor sólo señal; con sensor continuo suma comparación; con escáner suma sustancia", () => {
    expect(ledTriggerKindsFor(undefined)).toEqual(["level"]);
    expect(ledTriggerKindsFor("pressure")).toEqual(["level", "compare"]);
    expect(ledTriggerKindsFor("thermal")).toEqual(["level", "compare"]);
    expect(ledTriggerKindsFor("chemical")).toEqual(["level", "compare", "substance"]);
  });

  it("un trigger nuevo arranca con un valor jugable para el sensor cableado", () => {
    expect(defaultLedTrigger("compare", "pressure")).toEqual({ kind: "compare", comparator: "<", value: 101 });
    expect(defaultLedTrigger("compare", "thermal")).toEqual({ kind: "compare", comparator: ">", value: 60 });
    expect(defaultLedTrigger("substance", "chemical")).toEqual({ kind: "substance", tag: "TOX" });
  });
});

describe("instance-config: validación del indicador", () => {
  it("rechaza formas rotas (color, comparador, tag, número)", () => {
    expect(isOutputIndicatorShape({ ...cfg({ kind: "level", high: true }), color: "rosa" })).toBe(false);
    expect(isOutputIndicatorShape(cfg({ kind: "compare", comparator: "!=" as never, value: 1 }))).toBe(false);
    expect(isOutputIndicatorShape(cfg({ kind: "compare", comparator: ">", value: Number.NaN }))).toBe(false);
    expect(isOutputIndicatorShape(cfg({ kind: "substance", tag: "OXIGENO" as never }))).toBe(false);
    expect(isOutputIndicatorShape(cfg({ kind: "level", high: false }))).toBe(true);
  });

  it("compare exige un sensor continuo y el valor dentro de SU rango; substance sólo con escáner", () => {
    const compare = (value: number) => cfg({ kind: "compare", comparator: ">", value });
    expect(isValidOutputIndicator(compare(60), "thermal")).toBe(true);
    expect(isValidOutputIndicator(compare(60), undefined)).toBe(false);
    expect(isValidOutputIndicator(compare(5000), "thermal")).toBe(false);
    expect(isValidOutputIndicator(cfg({ kind: "substance", tag: "TOX" }), "chemical")).toBe(true);
    expect(isValidOutputIndicator(cfg({ kind: "substance", tag: "TOX" }), "thermal")).toBe(false);
    expect(isValidOutputIndicator(cfg({ kind: "level", high: true }), undefined)).toBe(true);
  });

  it("sólo el indicador LED es configurable como salida (la LCD tiene las mismas propiedades y no)", () => {
    expect(isConfigurableIndicator(LED_INDICATOR_COMPONENT_ID)).toBe(true);
    expect(isConfigurableIndicator("pantalla-lcd" as ComponentId)).toBe(false);
  });
});

describe("instance-config: qué piezas tienen lógica configurable desde su panel", () => {
  const registry = buildComponentCatalog().registry;
  const has = (id: string) => hasConfigurableLogic(id as ComponentId, registry);

  it("el chip sí: un REC sin ACT ni EM sólo procesa señal", () => {
    expect(has("chip-circuito-generico")).toBe(true);
  });

  it("el LED y la LCD no (tienen las mismas propiedades pero su propio panel), ni lo que actúa o mide", () => {
    expect(has("indicador-led")).toBe(false);
    expect(has("pantalla-lcd")).toBe(false);
    expect(has("compuerta-blindada")).toBe(false); // ACT
    expect(has("fotorreceptor")).toBe(false); // EM
    expect(has("sensor-presion")).toBe(false); // EM
    expect(has("no-existe")).toBe(false);
  });
});
