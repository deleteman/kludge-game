import { describe, expect, it } from "vitest";

import { buildStaticOccluderEdges, rectEdges, worldBorderEdges, type OccluderGrid } from "./occluder-edges.js";
import type { Segment } from "./visibility-polygon.js";

/** Grilla de prueba a partir de una matriz de 0/1 (fila = y, columna = x). */
function gridOf(rows: number[][]): OccluderGrid {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  return {
    width,
    height,
    isOccluder: (x, y) => x >= 0 && y >= 0 && x < width && y < height && rows[y]?.[x] === 1,
  };
}

/** ¿Existe en `edges` un segmento (sin importar el sentido a→b) igual a este? */
function hasSegment(edges: Segment[], ax: number, ay: number, bx: number, by: number): boolean {
  return edges.some(
    (e) =>
      (e.a.x === ax && e.a.y === ay && e.b.x === bx && e.b.y === by) ||
      (e.a.x === bx && e.a.y === by && e.b.x === ax && e.b.y === ay),
  );
}

describe("buildStaticOccluderEdges", () => {
  it("una sola celda oclusora produce sus 4 lados", () => {
    const edges = buildStaticOccluderEdges(gridOf([[1]]), 10);
    expect(edges).toHaveLength(4);
    expect(hasSegment(edges, 0, 0, 10, 0)).toBe(true); // superior
    expect(hasSegment(edges, 0, 10, 10, 10)).toBe(true); // inferior
    expect(hasSegment(edges, 0, 0, 0, 10)).toBe(true); // izquierda
    expect(hasSegment(edges, 10, 0, 10, 10)).toBe(true); // derecha
  });

  it("fusiona tramos colineales contiguos en un solo segmento", () => {
    // Tres celdas oclusoras en fila: el lado superior debe ser UN segmento de 0..30, no tres.
    const edges = buildStaticOccluderEdges(gridOf([[1, 1, 1]]), 10);
    expect(hasSegment(edges, 0, 0, 30, 0)).toBe(true); // superior fusionado
    expect(hasSegment(edges, 0, 10, 30, 10)).toBe(true); // inferior fusionado
    // No hay aristas verticales internas (entre celdas oclusoras adyacentes).
    expect(hasSegment(edges, 10, 0, 10, 10)).toBe(false);
    expect(hasSegment(edges, 20, 0, 20, 10)).toBe(false);
  });

  it("no emite aristas internas entre dos celdas oclusoras adyacentes", () => {
    // Bloque 2x2 sólido: solo el contorno exterior, sin la cruz interna.
    const edges = buildStaticOccluderEdges(
      gridOf([
        [1, 1],
        [1, 1],
      ]),
      10,
    );
    // Contorno = 4 segmentos fusionados de largo 20.
    expect(edges).toHaveLength(4);
    expect(hasSegment(edges, 0, 0, 20, 0)).toBe(true);
    expect(hasSegment(edges, 0, 20, 20, 20)).toBe(true);
    expect(hasSegment(edges, 0, 0, 0, 20)).toBe(true);
    expect(hasSegment(edges, 20, 0, 20, 20)).toBe(true);
  });

  it("grilla vacía no produce aristas", () => {
    expect(buildStaticOccluderEdges(gridOf([[0, 0]]), 10)).toHaveLength(0);
  });
});

describe("rectEdges / worldBorderEdges", () => {
  it("rectEdges devuelve 4 lados cerrados", () => {
    const edges = rectEdges(5, 5, 15, 25);
    expect(edges).toHaveLength(4);
    expect(hasSegment(edges, 5, 5, 15, 5)).toBe(true);
    expect(hasSegment(edges, 15, 25, 5, 25)).toBe(true);
  });

  it("worldBorderEdges cierra el marco del mundo", () => {
    const edges = worldBorderEdges(100, 200);
    expect(edges).toHaveLength(4);
    expect(hasSegment(edges, 0, 0, 100, 0)).toBe(true);
    expect(hasSegment(edges, 100, 0, 100, 200)).toBe(true);
  });
});
