import { describe, expect, it } from "vitest";
import { findOverlappingPairs, fitTextToWidth, rectsOverlap } from "./button-fit.js";

/** Medida lineal: 0.6 × tamaño de fuente por carácter. */
const measure = (text: string, fontPx: number): number => text.length * fontPx * 0.6;

describe("button-fit: fitTextToWidth", () => {
  it("no toca un texto que ya entra", () => {
    expect(fitTextToWidth("Reset", 11, 100, measure)).toEqual({ fontPx: 11, wrap: false });
  });

  it("achica la fuente hasta que el texto entra en una línea", () => {
    const fitted = fitTextToWidth("Reiniciar (reset)", 11, 100, measure);
    expect(fitted.wrap).toBe(false);
    expect(fitted.fontPx).toBeLessThan(11);
    expect(measure("Reiniciar (reset)", fitted.fontPx)).toBeLessThanOrEqual(100);
  });

  it("si ni con la fuente mínima entra, pide partir en líneas y nunca recorta", () => {
    const fitted = fitTextToWidth("Una etiqueta larguísima de botón", 11, 60, measure);
    expect(fitted).toEqual({ fontPx: 9, wrap: true });
  });
});

describe("button-fit: solapes", () => {
  const box = (x: number, y: number, width = 50, height = 26) => ({ x, y, width, height });

  it("detecta el solape horizontal de dos botones de una misma fila", () => {
    expect(rectsOverlap(box(0, 0), box(40, 0))).toBe(true);
  });

  it("botones contiguos o con diferencia de redondeo no cuentan", () => {
    expect(rectsOverlap(box(0, 0), box(50, 0))).toBe(false);
    expect(rectsOverlap(box(0, 0), box(49.5, 0))).toBe(false);
    expect(rectsOverlap(box(0, 0), box(0, 26))).toBe(false);
  });

  it("devuelve todos los pares que se pisan", () => {
    const pairs = findOverlappingPairs([box(0, 0), box(40, 0), box(0, 100), box(45, 10)]);
    expect(pairs).toEqual([
      [0, 1],
      [0, 3],
      [1, 3],
    ]);
  });
});
