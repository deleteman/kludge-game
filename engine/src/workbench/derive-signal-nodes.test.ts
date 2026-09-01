import { describe, expect, it } from "vitest";
import { deriveSignalNodes, isActuatorOutputNode } from "./derive-signal-nodes.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";

const OWNER = "inst-1" as PlacedComponentInstanceId;
const AT_6_4: PlacedFootprint = {
  position: { x: 6, y: 4 },
  footprint: { width: 1, height: 1 },
  rotation: 0,
};

describe("deriveSignalNodes", () => {
  it("returns nothing for a piece without functional properties", () => {
    expect(deriveSignalNodes(undefined, OWNER, AT_6_4)).toEqual([]);
    expect(deriveSignalNodes([], OWNER, AT_6_4)).toEqual([]);
  });

  it("maps EM/REC/COND to emitter/receptor/conductor at the piece cell", () => {
    const em = deriveSignalNodes(
      [{ tag: "EM", range: 10, triggerType: "optical", frequency: 1 }],
      OWNER,
      AT_6_4,
    );
    expect(em).toEqual([
      { id: "inst-1:emitter:0", role: "emitter", position: { x: 6, y: 4 }, ownerRef: OWNER },
    ]);

    const rec = deriveSignalNodes([{ tag: "REC", threshold: 0.5, responseDelayMs: 100 }], OWNER, AT_6_4);
    expect(rec[0]?.role).toBe("receptor");

    const cond = deriveSignalNodes([{ tag: "COND", resourceType: "E", maxCapacity: 100 }], OWNER, AT_6_4);
    expect(cond[0]?.role).toBe("conductor");
  });

  it("ignores RES/EST — they are physical properties, not graph roles", () => {
    const nodes = deriveSignalNodes(
      [
        { tag: "RES", resourceType: "L", capacity: 100, dischargeRate: 5 },
        { tag: "EST", damageResistance: 50 },
      ],
      OWNER,
      AT_6_4,
    );
    expect(nodes).toEqual([]);
  });

  // Subfase 13h: un actuador gobernado por una señal ES un receptor de señales.
  // Antes `ACT` no generaba nodo y por eso una compuerta instalada por el
  // jugador no se podía cablear a nada.
  it("derives a receptor node from ACT so any actuator can be wired", () => {
    const nodes = deriveSignalNodes(
      [{ tag: "ACT", power: 20, cadence: 10, directional: true }],
      OWNER,
      AT_6_4,
    );
    // 14a-4 ronda 1: además del receptor que lo gobierna, un `ACT` expone una
    // SALIDA para poder encadenar ("cuando esta puerta se abrió → hacé aquello").
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.role).toBe("receptor");
    expect(nodes[0]?.ownerRef).toBe(OWNER);
  });

  // Ronda 1 de playtest de 14a-4 — pedido del operador: "cada vez que un ACT se
  // activa, debería emitir señal".
  describe("salida de actuador (14a-4 ronda 1)", () => {
    const ACT = { tag: "ACT", power: 20, cadence: 10, directional: true } as const;

    it("la salida es un EMISOR: su valor lo fija el mundo, no sus entradas", () => {
      const [, output] = deriveSignalNodes([ACT], OWNER, AT_6_4);
      expect(output?.role).toBe("emitter");
      expect(isActuatorOutputNode(output!.id)).toBe(true);
    });

    it("comparte celda con su receptor: son las dos caras de la misma pieza", () => {
      // Separarlas por celdas dejaría la salida de una puerta de 1 celda FUERA
      // de la puerta. Que dos nodos compartan celda lo resuelve la UI.
      const [receptor, output] = deriveSignalNodes([ACT], OWNER, AT_6_4);
      expect(output?.position).toEqual(receptor?.position);
    });

    it("su id se deriva del receptor, sin consumir un índice más", () => {
      // Si la salida consumiera un índice, agregarla habría CORRIDO los ids de
      // los nodos posteriores de la misma pieza — y toda arista guardada que
      // apuntara a uno de ellos habría quedado huérfana al cargar la partida.
      const conEmisorDespues = deriveSignalNodes(
        [ACT, { tag: "EM", range: 10, triggerType: "optical", frequency: 1 }],
        OWNER,
        { position: { x: 0, y: 0 }, footprint: { width: 3, height: 1 }, rotation: 0 },
      );
      const emisorDeSensor = conEmisorDespues.find(
        (node) => node.role === "emitter" && !isActuatorOutputNode(node.id),
      );
      expect(emisorDeSensor?.id).toBe(`${OWNER}:emitter:1`);
    });

    it("una pieza sin ACT no gana ninguna salida", () => {
      const nodes = deriveSignalNodes(
        [{ tag: "REC", threshold: 0.5, responseDelayMs: 100 }],
        OWNER,
        AT_6_4,
      );
      expect(nodes.some((node) => isActuatorOutputNode(node.id))).toBe(false);
    });
  });

  it("spreads multiple signal roles over distinct cells so wire-mode find-by-position never collides", () => {
    const placement: PlacedFootprint = {
      position: { x: 0, y: 0 },
      footprint: { width: 2, height: 1 },
      rotation: 0,
    };
    const nodes = deriveSignalNodes(
      [
        { tag: "REC", threshold: 0.5, responseDelayMs: 100 },
        { tag: "EM", range: 10, triggerType: "optical", frequency: 1 },
      ],
      OWNER,
      placement,
    );
    const positions = nodes.map((node) => `${node.position.x},${node.position.y}`);
    expect(new Set(positions).size).toBe(2);
  });
});
