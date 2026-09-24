import { describe, expect, it } from "vitest";
import { GRID_CELL_SIZE_PX } from "engine";
import type { SignalNode, SignalNodeId } from "engine";
import {
  layoutSignalNodes,
  signalNodeAtPoint,
  signalNodePresentationRole,
  signalNodeRoleDetailKey,
  signalNodeRoleKey,
  signalNodesAtPoint,
} from "./signal-node-layout.js";
import { SHARED_CELL_OFFSET_PX, SIGNAL_NODE_RADIUS_PX } from "./signal-node-layout.js";

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

describe("signalNodesAtPoint (14a-4 ronda 2)", () => {
  it("devuelve los DOS nodos de una celda compartida, del más cercano al más lejano", () => {
    // Es la señal de ambigüedad: con dos candidatos la UI deja de adivinar y
    // abre el menú. El operador reportó que acertarle a uno era muy difícil.
    const positioned = layoutSignalNodes([node("in", 1, 1), node("out", 1, 1, "emitter")]);
    expect(signalNodesAtPoint(positioned, centerOf(1), centerOf(1))).toHaveLength(2);
  });

  it("ordena por distancia: el primero es el mismo que elegiría el hit-test simple", () => {
    const positioned = layoutSignalNodes([node("in", 1, 1), node("out", 1, 1, "emitter")]);
    const segundo = positioned[1]!;
    const candidatos = signalNodesAtPoint(positioned, segundo.x, segundo.y);
    expect(candidatos[0]?.id).toBe(signalNodeAtPoint(positioned, segundo.x, segundo.y)?.id);
  });

  it("un nodo solo devuelve UN candidato: cablear normal no gana ningún paso", () => {
    const positioned = layoutSignalNodes([node("a", 0, 0)]);
    expect(signalNodesAtPoint(positioned, centerOf(0), centerOf(0))).toHaveLength(1);
  });

  it("lejos de todo no devuelve nada", () => {
    const positioned = layoutSignalNodes([node("a", 0, 0)]);
    expect(signalNodesAtPoint(positioned, centerOf(9), centerOf(9))).toEqual([]);
  });
});

/**
 * Ronda 1 de playtest de 14b-2. El operador reportó "no sé qué estoy cableando"
 * en una pieza con entrada y salida, y la causa era que `role` del grafo colapsa
 * al emisor de un sensor con la salida de un actuador: los dos son `"emitter"`,
 * así que compartían color y no había forma de distinguirlos.
 */
describe("signalNodePresentationRole (14b-2 ronda 1)", () => {
  it("separa la SALIDA de un actuador del emisor de un sensor", () => {
    // El sufijo `:out` es lo que `deriveSignalNodes` le pone a la salida de todo
    // `ACT` desde 14a-4; acá se verifica contra esa convención real.
    expect(signalNodePresentationRole({ id: "puerta:receptor:0:out" as SignalNodeId, role: "emitter" })).toBe(
      "actuator-output",
    );
    expect(signalNodePresentationRole({ id: "sensor:emitter:0" as SignalNodeId, role: "emitter" })).toBe("emitter");
  });

  it("los cuatro roles tienen etiqueta propia y ninguna se repite", () => {
    const keys = (
      [
        { id: "a:emitter:0" as SignalNodeId, role: "emitter" as const },
        { id: "b:receptor:0:out" as SignalNodeId, role: "emitter" as const },
        { id: "c:receptor:0" as SignalNodeId, role: "receptor" as const },
        { id: "d:conductor:0" as SignalNodeId, role: "conductor" as const },
      ]
    ).map((entry) => signalNodeRoleKey(entry));
    expect(new Set(keys).size).toBe(4);
  });
});

/**
 * El número que dejó al menú circular casi inalcanzable (14b-2 ronda 1).
 *
 * El menú de elección solo se abre con MÁS DE UN candidato. Con los nodos a
 * `SHARED_CELL_OFFSET_PX` del centro y un radio de click de `radiusPx`, la zona
 * donde ambos son candidatos es la lente de intersección de dos círculos — y si
 * el desplazamiento crece o el radio se achica, esa zona se cierra y el menú
 * deja de existir sin que nada falle.
 *
 * Este test fija la relación, que hasta ahora no la fijaba nadie: apuntar al
 * CENTRO (donde no hay ningún punto dibujado) tiene que ser ambiguo, y apuntar a
 * un punto tiene que resolver uno solo.
 */
describe("la zona ambigua que abre el menú existe (14b-2 ronda 1)", () => {
  const dos = layoutSignalNodes([node("entrada", 1, 1), node("salida", 1, 1, "emitter")]);

  it("el centro de la celda es ambiguo: los DOS nodos son candidatos", () => {
    expect(signalNodesAtPoint(dos, centerOf(1), centerOf(1))).toHaveLength(2);
  });

  it("apuntar a un punto resuelve UNO solo, sin abrir el menú", () => {
    for (const nodo of dos) {
      expect(signalNodesAtPoint(dos, nodo.x, nodo.y)).toHaveLength(1);
    }
  });

  it("el desplazamiento y el radio de click se solapan, o el menú sería inalcanzable", () => {
    // Si `SHARED_CELL_OFFSET_PX >= radio de click`, la lente se cierra y el
    // `candidates.length > 1` de `handleWireModeClick` nunca se cumple.
    expect(SHARED_CELL_OFFSET_PX).toBeLessThan(SIGNAL_NODE_RADIUS_PX + 3);
  });
});

/**
 * Ronda 2 de playtest de 14b-2: el rótulo corto ("emite"/"salida") no alcanza
 * para distinguir un sensor de la salida de un actuador — la aclaración vive
 * en una segunda clave, una por rol, sin tocar el rótulo.
 */
describe("signalNodeRoleDetailKey (14b-2 ronda 2)", () => {
  it("cada rol de presentación tiene su propia clave de detalle", () => {
    const keys = (
      [
        { id: "a:emitter:0" as SignalNodeId, role: "emitter" as const },
        { id: "b:receptor:0:out" as SignalNodeId, role: "emitter" as const },
        { id: "c:receptor:0" as SignalNodeId, role: "receptor" as const },
        { id: "d:conductor:0" as SignalNodeId, role: "conductor" as const },
      ]
    ).map((entry) => signalNodeRoleDetailKey(entry));
    expect(new Set(keys).size).toBe(4);
  });

  it("la clave de detalle cuelga del mismo namespace que la del rótulo corto", () => {
    const node = { id: "a:emitter:0" as SignalNodeId, role: "emitter" as const };
    expect(signalNodeRoleDetailKey(node)).toBe(`${signalNodeRoleKey(node)}-detail`);
  });
});
