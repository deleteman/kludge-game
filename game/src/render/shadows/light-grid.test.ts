import { describe, expect, it } from "vitest";

import { computeLightLevelGrid, LIGHT_CLEAR_ALPHA_FLOOR, type LightSample } from "./light-grid.js";
import { rectEdges } from "./occluder-edges.js";
import type { Segment } from "./visibility-polygon.js";

const CELL = 10;
const AMBIENT = 0.5;

/** Grilla de 10×10 celdas de 10px, con las luces/aristas dadas. */
function gridOf(lights: LightSample[], edges: Segment[] = []) {
  return computeLightLevelGrid({
    lights,
    edges,
    gridWidth: 10,
    gridHeight: 10,
    cellSize: CELL,
    ambient: AMBIENT,
  });
}

/** Luz centrada en la celda (cx, cy). */
function lightAtCell(cx: number, cy: number, radius: number, intensity = 1): LightSample {
  return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL, radius, intensity };
}

describe("computeLightLevelGrid", () => {
  it("sin luces, toda la grilla queda en el nivel ambiente", () => {
    const grid = gridOf([]);
    expect(grid.levelAt(0, 0)).toBe(AMBIENT);
    expect(grid.levelAt(5, 5)).toBe(AMBIENT);
  });

  it("la celda de la propia luz llega a brillo pleno", () => {
    const grid = gridOf([lightAtCell(5, 5, 30)]);
    expect(grid.levelAt(5, 5)).toBeCloseTo(1, 5);
  });

  it("una celda fuera del radio se queda en ambiente", () => {
    const grid = gridOf([lightAtCell(5, 5, 15)]);
    // (9,5) está a 40px del centro de la luz, muy por fuera de un radio de 15.
    expect(grid.levelAt(9, 5)).toBe(AMBIENT);
  });

  it("el nivel decae con la distancia dentro del radio", () => {
    const grid = gridOf([lightAtCell(0, 0, 100)]);
    const near = grid.levelAt(1, 0);
    const far = grid.levelAt(8, 0);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(AMBIENT);
  });

  it("una pared entre la luz y la celda la deja en sombra (misma oclusión que el polígono)", () => {
    // Pared vertical ocupando la celda (5,5); luz a la izquierda, celda a la derecha.
    const wall = rectEdges(5 * CELL, 0, 6 * CELL, 10 * CELL);
    const grid = gridOf([lightAtCell(2, 5, 100)], wall);

    expect(grid.levelAt(3, 5)).toBeGreaterThan(AMBIENT); // delante de la pared: iluminada
    expect(grid.levelAt(8, 5)).toBe(AMBIENT); // detrás de la pared: sombra plena
  });

  it("sin la pared, esa misma celda de atrás sí se ilumina (control del test anterior)", () => {
    const grid = gridOf([lightAtCell(2, 5, 100)]);
    expect(grid.levelAt(8, 5)).toBeGreaterThan(AMBIENT);
  });

  it("dos luces solapadas se combinan con max, no se suman a blanco", () => {
    const dim = 0.4;
    const grid = gridOf([lightAtCell(5, 5, 30, dim), lightAtCell(5, 5, 30, dim)]);
    const single = gridOf([lightAtCell(5, 5, 30, dim)]);
    expect(grid.levelAt(5, 5)).toBeCloseTo(single.levelAt(5, 5), 5);
    expect(grid.levelAt(5, 5)).toBeLessThan(1);
  });

  it("una luz muy tenue igual despeja algo de oscuridad (piso de aclarado)", () => {
    const grid = gridOf([lightAtCell(5, 5, 30, 0.01)]);
    expect(grid.levelAt(5, 5)).toBeCloseTo(AMBIENT + (1 - AMBIENT) * LIGHT_CLEAR_ALPHA_FLOOR, 5);
  });

  it("una luz de intensidad 0 o radio 0 no aporta nada", () => {
    expect(gridOf([lightAtCell(5, 5, 30, 0)]).levelAt(5, 5)).toBe(AMBIENT);
    expect(gridOf([lightAtCell(5, 5, 0)]).levelAt(5, 5)).toBe(AMBIENT);
  });

  it("fuera de los límites de la grilla devuelve el ambiente en vez de romper", () => {
    const grid = gridOf([lightAtCell(5, 5, 100)]);
    expect(grid.levelAt(-1, 0)).toBe(AMBIENT);
    expect(grid.levelAt(0, 99)).toBe(AMBIENT);
  });

  it("levelAtPixel mapea píxeles de mundo a la celda correcta", () => {
    const grid = gridOf([lightAtCell(5, 5, 30)]);
    expect(grid.levelAtPixel(55, 55)).toBe(grid.levelAt(5, 5));
    expect(grid.levelAtPixel(5, 5)).toBe(grid.levelAt(0, 0));
  });

  it("un ambiente 1 (sombras apagadas) deja todo a brillo pleno", () => {
    const grid = computeLightLevelGrid({
      lights: [],
      edges: [],
      gridWidth: 4,
      gridHeight: 4,
      cellSize: CELL,
      ambient: 1,
    });
    expect(grid.levelAt(0, 0)).toBe(1);
  });
});
