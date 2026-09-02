import { describe, expect, it } from "vitest";
import { GRID_CELL_SIZE_PX } from "engine";
import type { GridPosition } from "engine";

import {
  arcTargetsNear,
  dashedPolyline,
  polylineMidpoint,
  signalWireBodyCells,
  signalWireCells,
} from "./conduit-path.js";
import type { PixelPoint } from "./conduit-path.js";
import type { WalkableGrid } from "./walkable-grid.js";

/**
 * Geometría de ruta de cable (14a-4, ronda 3 de playtest). Estas cuatro
 * funciones son puras y su modo de fallo es INVISIBLE —una cicatriz sobre la
 * pieza equivocada, un arco que sale al aire, un cable que no se dibuja—, así
 * que llevan test propio aunque vivan en `/game`, donde el estándar es smoke
 * test visual.
 */

const CELL = GRID_CELL_SIZE_PX;
const center = (cell: number): number => cell * CELL + CELL / 2;
const px = (cellX: number, cellY: number): PixelPoint => ({ x: center(cellX), y: center(cellY) });

describe("signalWireBodyCells", () => {
  it("excluye las celdas de los DOS extremos de una ruta larga", () => {
    // El bug del reporte: la cicatriz caía sobre el chip y el fotorreceptor, y
    // el operador vio "el chip brillando como si estuviera roto". La pieza
    // estaba sana — era la arista la que se había quemado.
    const route = [px(0, 0), px(5, 0)];
    const all = signalWireCells(route);
    const body = signalWireBodyCells(route);
    expect(body).not.toContainEqual(all[0]);
    expect(body).not.toContainEqual(all[all.length - 1]);
    expect(body).toEqual(all.slice(1, -1));
  });

  it("un cable corto sin cuerpo cae al punto medio y NO devuelve vacío", () => {
    // Dos piezas adyacentes no dejan ninguna celda intermedia. Sin este caso el
    // corte sería completamente invisible, que es peor que atribuirlo mal.
    const body = signalWireBodyCells([px(0, 0), px(1, 0)]);
    expect(body).toHaveLength(1);
  });

  it("una ruta de un solo punto sigue teniendo celda", () => {
    expect(signalWireBodyCells([px(3, 3)])).toEqual([{ x: 3, y: 3 }]);
  });

  it("una ruta vacía no inventa una celda", () => {
    expect(signalWireBodyCells([])).toEqual([]);
  });
});

describe("polylineMidpoint", () => {
  it("parte la longitud al medio, no la lista de vértices", () => {
    // Un vértice del medio caería sobre la esquina; lo que hace falta es el
    // punto a mitad de RECORRIDO, que es donde se ancla el fogonazo del corte.
    const midpoint = polylineMidpoint([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(midpoint).toEqual({ x: 100, y: 0 });
  });

  it("en un tramo recto cae exactamente en el centro", () => {
    expect(polylineMidpoint([{ x: 0, y: 0 }, { x: 40, y: 0 }])).toEqual({ x: 20, y: 0 });
  });

  it("sin ruta no devuelve punto", () => {
    expect(polylineMidpoint([])).toBeUndefined();
  });
});

describe("dashedPolyline", () => {
  it("alterna trazo y hueco a lo largo del recorrido", () => {
    const segments = dashedPolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, 10);
    expect(segments.length).toBeGreaterThan(2);
    // Cada guion mide lo pedido (salvo el último, que puede quedar cortado).
    const [start, end] = segments[0]!;
    expect(end.x - start.x).toBeCloseTo(10);
    // Y entre un guion y el siguiente hay un hueco real.
    expect(segments[1]![0].x - segments[0]![1].x).toBeCloseTo(10);
  });

  it("los guiones SIGUEN las esquinas en vez de cortar en recto sobre ellas", () => {
    // Es la razón de que el patrón se acumule entre tramos: si cada tramo
    // reiniciara, cada esquina tendría dos guiones pegados y se leería como un
    // engrosamiento del cable, no como un patrón.
    const segments = dashedPolyline(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 30 },
      ],
      10,
      10,
    );
    // Ningún segmento cruza en diagonal: todos son horizontales o verticales,
    // porque cada uno vive dentro de UN tramo de la polilínea original.
    for (const [a, b] of segments) {
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });

  it("una ruta más corta que un guion devuelve un solo segmento entero", () => {
    const segments = dashedPolyline([{ x: 0, y: 0 }, { x: 4, y: 0 }], 10, 10);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
  });

  it("una ruta degenerada no revienta ni devuelve basura", () => {
    expect(dashedPolyline([{ x: 5, y: 5 }], 10, 10)).toEqual([]);
    expect(dashedPolyline([{ x: 5, y: 5 }, { x: 5, y: 5 }], 10, 10)).toEqual([]);
  });
});

describe("arcTargetsNear", () => {
  /** Grilla 10×10 transitable salvo las celdas listadas como pared. */
  const gridWithWalls = (walls: ReadonlyArray<GridPosition>): WalkableGrid => ({
    width: 10,
    height: 10,
    isWalkable: (x, y) => !walls.some((wall) => wall.x === x && wall.y === y),
  });

  it("encuentra una pared vecina", () => {
    const targets = arcTargetsNear({ x: 5, y: 5 }, 2, gridWithWalls([{ x: 6, y: 5 }]), new Set());
    expect(targets).toContainEqual({ x: 6, y: 5 });
  });

  it("encuentra una pieza ocupando una celda vecina", () => {
    const targets = arcTargetsNear({ x: 5, y: 5 }, 2, gridWithWalls([]), new Set(["4,5"]));
    expect(targets).toContainEqual({ x: 4, y: 5 });
  });

  it("en medio de una sala abierta no devuelve NADA", () => {
    // El caso que decide si el efecto dispara al vacío. Sin blanco, ese latido
    // simplemente no dibuja: no se inventa un destino.
    expect(arcTargetsNear({ x: 5, y: 5 }, 2, gridWithWalls([]), new Set())).toEqual([]);
  });

  it("respeta el radio", () => {
    const lejos = [{ x: 9, y: 9 }];
    expect(arcTargetsNear({ x: 5, y: 5 }, 2, gridWithWalls(lejos), new Set())).toEqual([]);
    expect(arcTargetsNear({ x: 5, y: 5 }, 6, gridWithWalls(lejos), new Set())).toContainEqual(lejos[0]!);
  });

  it("nunca devuelve la propia celda de origen", () => {
    // Un arco de una celda a sí misma no se vería como nada.
    const targets = arcTargetsNear({ x: 5, y: 5 }, 2, gridWithWalls([]), new Set(["5,5"]));
    expect(targets).not.toContainEqual({ x: 5, y: 5 });
  });

  it("lo que está fuera de la grilla no es pared", () => {
    // Sin este guard, todo cable pegado al borde del mapa arcaría contra el
    // vacío exterior — un destino que el jugador no ve.
    const targets = arcTargetsNear({ x: 0, y: 0 }, 2, gridWithWalls([]), new Set());
    expect(targets).toEqual([]);
  });
});
