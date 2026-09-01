import { describe, expect, it } from "vitest";

import { coverageQuantity, sectionEmitZone, thresholdSeverity } from "./atmosphere-effect-coverage.js";
import { CELL } from "../particle-utils.js";

/**
 * Ronda 1 de playtest de 14a-2. Es lógica PURA (no toca Phaser), así que se
 * testea aunque viva en `/game`: lo que estaba mal era aritmética de cobertura,
 * no pixeles, y un smoke test visual no lo habría atrapado.
 */
describe("sectionEmitZone (cobertura de sección)", () => {
  const cells = [
    { x: 3, y: 4 },
    { x: 4, y: 4 },
    { x: 3, y: 5 },
  ];

  it("todos los puntos caen DENTRO de alguna celda real de la sección", () => {
    const zone = sectionEmitZone({ cells });
    const point = { x: 0, y: 0 };

    for (let i = 0; i < 400; i += 1) {
      zone.source.getRandomPoint(point);
      const cell = { x: Math.floor(point.x / CELL), y: Math.floor(point.y / CELL) };
      expect(cells).toContainEqual(cell);
    }
  });

  /**
   * El motivo por el que la zona son CELDAS y no el bounding box. En la sección
   * de arriba (una L) el box incluye (4,5), que no pertenece a la sala — pintar
   * escarcha ahí sería la UI mintiendo sobre el motor.
   */
  it("nunca emite en un hueco del bounding box que no es de la sección", () => {
    const zone = sectionEmitZone({ cells });
    const point = { x: 0, y: 0 };

    for (let i = 0; i < 400; i += 1) {
      zone.source.getRandomPoint(point);
      const cell = { x: Math.floor(point.x / CELL), y: Math.floor(point.y / CELL) };
      expect(cell).not.toEqual({ x: 4, y: 5 });
    }
  });

  it("cubre la sección entera, no una celda: con suficientes muestras aparecen todas", () => {
    // El defecto exacto que reportó el operador ("congela una celda"): el emisor
    // vivía en el centroide con ±10 px, o sea que jamás alcanzaba el resto.
    const zone = sectionEmitZone({ cells });
    const point = { x: 0, y: 0 };
    const seen = new Set<string>();

    for (let i = 0; i < 500; i += 1) {
      zone.source.getRandomPoint(point);
      seen.add(`${Math.floor(point.x / CELL)},${Math.floor(point.y / CELL)}`);
    }
    expect(seen.size).toBe(cells.length);
  });

  it("una sección sin celdas no revienta", () => {
    const point = { x: 0, y: 0 };
    expect(() => sectionEmitZone({ cells: [] }).source.getRandomPoint(point)).not.toThrow();
  });
});

describe("coverageQuantity (densidad por área y severidad)", () => {
  it("una sala grande recibe más partículas que una chica a la misma severidad", () => {
    // Densidad percibida = partículas / superficie. Con un número fijo, la
    // misma severidad se leía densa en un armario y vacía en el hangar.
    expect(coverageQuantity(60, 0.5)).toBeGreaterThan(coverageQuantity(8, 0.5));
  });

  it("a mayor severidad, más partículas en la misma sala", () => {
    expect(coverageQuantity(40, 1)).toBeGreaterThan(coverageQuantity(40, 0.1));
  });

  it("en el umbral exacto el fenómeno SE VE igual: nunca cae a cero", () => {
    // Es el momento en que la sala empieza a matar — justo cuando el aviso
    // tiene que estar. Lo que la severidad agrega es cuánto peor se puso, no si
    // se ve.
    for (const cellCount of [1, 8, 40, 200]) {
      expect(coverageQuantity(cellCount, 0)).toBeGreaterThanOrEqual(1);
    }
  });

  it("tiene techo: una sala enorme no se vuelve una pantalla opaca", () => {
    // Por encima de cierta densidad deja de leerse lo que hay DEBAJO, que es
    // justamente lo que el jugador tiene que diagnosticar.
    expect(coverageQuantity(2000, 1)).toBeLessThanOrEqual(20);
  });

  it("severidades fuera de rango no rompen el techo ni el piso", () => {
    expect(coverageQuantity(40, 5)).toBe(coverageQuantity(40, 1));
    expect(coverageQuantity(40, -3)).toBe(coverageQuantity(40, 0));
  });
});

describe("thresholdSeverity (los dos lados del eje)", () => {
  it("es 0 en el umbral y 1 en el extremo, del lado FRÍO (umbral > extremo)", () => {
    expect(thresholdSeverity(-10, -10, -80)).toBe(0);
    expect(thresholdSeverity(-80, -10, -80)).toBe(1);
    expect(thresholdSeverity(-45, -10, -80)).toBeCloseTo(0.5, 2);
  });

  it("es 0 en el umbral y 1 en el extremo, del lado CALIENTE (umbral < extremo)", () => {
    expect(thresholdSeverity(60, 60, 900)).toBe(0);
    expect(thresholdSeverity(900, 60, 900)).toBe(1);
  });

  it("satura en los dos sentidos en vez de pasarse de rango", () => {
    expect(thresholdSeverity(-200, -10, -80)).toBe(1);
    expect(thresholdSeverity(20, -10, -80)).toBe(0);
    expect(thresholdSeverity(5000, 60, 900)).toBe(1);
  });
});
