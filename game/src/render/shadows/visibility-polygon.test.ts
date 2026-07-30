import { describe, expect, it } from "vitest";

import { castRay, computeVisibilityPolygon, raySegmentIntersection, type Segment } from "./visibility-polygon.js";

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

describe("raySegmentIntersection", () => {
  it("devuelve la distancia cuando el rayo cruza el segmento hacia adelante", () => {
    // Rayo desde el origen hacia +x, pared vertical en x=10.
    const t = raySegmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: -5 }, { x: 10, y: 5 });
    expect(t).toBeCloseTo(10, 5);
  });

  it("devuelve null cuando el segmento queda detrás del rayo", () => {
    const t = raySegmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -10, y: -5 }, { x: -10, y: 5 });
    expect(t).toBeNull();
  });

  it("devuelve null cuando el rayo pasa fuera de los extremos del segmento", () => {
    const t = raySegmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 8 });
    expect(t).toBeNull();
  });

  it("devuelve null para rayo paralelo al segmento", () => {
    const t = raySegmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 3 }, { x: 20, y: 3 });
    expect(t).toBeNull();
  });
});

describe("castRay", () => {
  const wall: Segment = { a: { x: 10, y: -5 }, b: { x: 10, y: 5 } };

  it("se corta contra el oclusor más cercano", () => {
    const p = castRay({ x: 0, y: 0 }, 0, [wall], 100);
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });

  it("se recorta al radio cuando nada se interpone", () => {
    const p = castRay({ x: 0, y: 0 }, Math.PI, [wall], 100); // dirección -x, la pared queda detrás
    expect(p.x).toBeCloseTo(-100, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });
});

describe("computeVisibilityPolygon", () => {
  it("ningún punto excede el radio de la luz", () => {
    const wall: Segment = { a: { x: 10, y: -5 }, b: { x: 10, y: 5 } };
    const poly = computeVisibilityPolygon({ light: { x: 0, y: 0 }, radius: 100, edges: [wall], angularSteps: 32 });
    for (const p of poly) {
      expect(dist(0, 0, p.x, p.y)).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it("un oclusor entre la luz y el fondo proyecta una cuña de sombra (puntos cortados a la distancia del oclusor)", () => {
    // Pared vertical cercana en x=10; el fondo estaría a radio 200.
    const wall: Segment = { a: { x: 10, y: -5 }, b: { x: 10, y: 5 } };
    const poly = computeVisibilityPolygon({ light: { x: 0, y: 0 }, radius: 200, edges: [wall], angularSteps: 64 });

    // Debe existir al menos un punto sobre la cara de la pared (~x=10), prueba
    // de que el rayo se detuvo en el oclusor y no siguió hasta el radio.
    const onWall = poly.some((p) => Math.abs(p.x - 10) < 1 && Math.abs(p.y) <= 5.5);
    expect(onWall).toBe(true);

    // Y hacia el lado opuesto (sin oclusor) sí debe llegar cerca del radio.
    const reachesFar = poly.some((p) => dist(0, 0, p.x, p.y) > 190);
    expect(reachesFar).toBe(true);
  });

  it("sin oclusores, todos los puntos caen sobre el círculo del radio", () => {
    const poly = computeVisibilityPolygon({ light: { x: 0, y: 0 }, radius: 50, edges: [], angularSteps: 24 });
    expect(poly.length).toBeGreaterThan(0);
    for (const p of poly) {
      expect(dist(0, 0, p.x, p.y)).toBeCloseTo(50, 4);
    }
  });
});
