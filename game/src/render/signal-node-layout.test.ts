import { describe, expect, it } from "vitest";
import { GRID_CELL_SIZE_PX } from "engine";
import type { SignalNode, SignalNodeId } from "engine";
import { layoutSignalNodes, signalNodeAtPoint } from "./signal-node-layout.js";

/**
 * Ronda 1 de playtest de 14a-4. Lógica pura, así que lleva test propio aunque
 * viva en `/game`: lo que estaba mal era aritmética de posiciones (dos nodos
 * dibujados en el mismo píxel y solo uno clickeable), no pixeles — un smoke
 * test visual no lo habría atrapado.
 */

const node = (id: string, x: number, y: number, role: SignalNode["role"] = "receptor"): SignalNode<unknown> => ({
  id: id as SignalNodeId,
  role,
  position: { x, y },
  ownerRef: "owner",
});

const centerOf = (cell: number): number => cell * GRID_CELL_SIZE_PX + GRID_CELL_SIZE_PX / 2;

describe("layoutSignalNodes", () => {
  it("un nodo solo en su celda queda en el centro exacto", () => {
    // Una nave sin actuadores cableables tiene que verse igual que antes de
    // 14a-4: el reparto no puede mover lo que ya estaba bien.
    const [positioned] = layoutSignalNodes([node("a", 2, 3)]);
    expect(positioned?.x).toBe(centerOf(2));
    expect(positioned?.y).toBe(centerOf(3));
  });

  it("dos nodos en la misma celda se separan", () => {
    const positioned = layoutSignalNodes([node("in", 1, 1), node("out", 1, 1, "emitter")]);
    expect(positioned).toHaveLength(2);
    const [a, b] = positioned;
    expect(a!.x).not.toBe(b!.x);
  });

  it("los nodos separados siguen cayendo DENTRO de su celda", () => {
    // Si se salieran, el jugador vería el punto de una puerta sobre la celda
    // vecina y clickearía la pieza equivocada.
    for (const positioned of layoutSignalNodes([node("in", 4, 4), node("out", 4, 4, "emitter")])) {
      expect(positioned.x).toBeGreaterThan(4 * GRID_CELL_SIZE_PX);
      expect(positioned.x).toBeLessThan(5 * GRID_CELL_SIZE_PX);
      expect(positioned.y).toBeGreaterThan(4 * GRID_CELL_SIZE_PX);
      expect(positioned.y).toBeLessThan(5 * GRID_CELL_SIZE_PX);
    }
  });

  it("nodos en celdas distintas no se afectan entre sí", () => {
    const positioned = layoutSignalNodes([node("a", 0, 0), node("b", 1, 0)]);
    expect(positioned.map((entry) => entry.x)).toEqual([centerOf(0), centerOf(1)]);
  });
});

describe("signalNodeAtPoint", () => {
  it("los DOS nodos de una celda compartida son alcanzables", () => {
    // Es el agujero que este archivo existe para tapar: buscando por celda, el
    // segundo nodo de una puerta de 1×1 era inclickeable.
    const positioned = layoutSignalNodes([node("in", 1, 1), node("out", 1, 1, "emitter")]);
    const alcanzados = new Set(
      positioned.map((entry) => signalNodeAtPoint(positioned, entry.x, entry.y)?.id),
    );
    expect(alcanzados).toEqual(new Set(["in", "out"]));
  });

  it("elige el más cercano, no el primero de la lista", () => {
    const positioned = layoutSignalNodes([node("in", 1, 1), node("out", 1, 1, "emitter")]);
    const segundo = positioned[1]!;
    expect(signalNodeAtPoint(positioned, segundo.x, segundo.y)?.id).toBe(segundo.id);
  });

  it("un click lejos de todo no devuelve nada", () => {
    const positioned = layoutSignalNodes([node("a", 0, 0)]);
    expect(signalNodeAtPoint(positioned, centerOf(9), centerOf(9))).toBeUndefined();
  });

  it("tolera algo de imprecisión alrededor del punto", () => {
    // Exigir precisión de píxel sobre un círculo de 7px haría el cableado
    // frustrante con el mapa alejado.
    const positioned = layoutSignalNodes([node("a", 0, 0)]);
    expect(signalNodeAtPoint(positioned, centerOf(0) + 5, centerOf(0))?.id).toBe("a");
  });
});
