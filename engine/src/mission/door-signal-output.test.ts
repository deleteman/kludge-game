import { describe, expect, it } from "vitest";
import { doorSignalOutput } from "./door-signal-output.js";
import type { DoorRuntime, DoorId } from "../doors/door.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const DOOR_INSTANCE = "puerta-1" as PlacedComponentInstanceId;
const DOOR_NODE = "puerta-1:act" as SignalNodeId;
const SENSOR_NODE = "sensor:em" as SignalNodeId;

function door(): DoorRuntime {
  return {
    id: "door-1" as DoorId,
    instanceId: DOOR_INSTANCE,
    a: "pasillo" as SectionId,
    b: "hibernacion" as SectionId,
    cells: [{ x: 1, y: 0 }],
    mode: "auto",
    state: "closed",
    transitionElapsedSeconds: 0,
    hp: 300,
    maxHp: 300,
  };
}

function graph(options: { node?: boolean; wired?: boolean } = {}): SignalGraph<PlacedComponentInstanceId> {
  const node = options.node ?? true;
  return {
    nodes: node
      ? [{ id: DOOR_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: DOOR_INSTANCE }]
      : [],
    edges: options.wired ? [{ id: "cable" as SignalEdgeId, from: SENSOR_NODE, to: DOOR_NODE }] : [],
  };
}

const POWERED = (): boolean => true;
const UNPOWERED = (): boolean => false;

describe("doorSignalOutput (13h, ronda 2 de playtest)", () => {
  it("con cable y motor, devuelve lo que dice la señal", () => {
    expect(doorSignalOutput(door(), graph({ wired: true }), POWERED, () => true)).toBe(true);
    expect(doorSignalOutput(door(), graph({ wired: true }), POWERED, () => false)).toBe(false);
  });

  it("sin cable devuelve `undefined`, no `false`", () => {
    // `false` significaría "el cable ordena cerrar" y dejaría toda puerta recién
    // instalada cerrada en override para siempre.
    expect(doorSignalOutput(door(), graph({ wired: false }), POWERED, () => true)).toBeUndefined();
  });

  it("sin nodo receptor (pieza que no es actuador) devuelve `undefined`", () => {
    expect(doorSignalOutput(door(), graph({ node: false }), POWERED, () => true)).toBeUndefined();
  });

  it("SIN MOTOR devuelve `undefined` aunque haya cable: un motor muerto no oye el cable", () => {
    // Este es el corte que rompía el reporte #3. `outputOf` fuerza la salida a
    // `false` cuando la instancia dueña del nodo no está alimentada —correcto
    // para un LED— pero el dueño del nodo de una puerta ES la puerta, así que
    // la falta de energía llegaba disfrazada de orden de cerrar: override,
    // cerrada, y bloqueando el pathfinding sin decir por qué.
    expect(doorSignalOutput(door(), graph({ wired: true }), UNPOWERED, () => true)).toBeUndefined();
    // Y en particular NO devuelve `false`, que es la forma en que se rompía.
    expect(doorSignalOutput(door(), graph({ wired: true }), UNPOWERED, () => false)).toBeUndefined();
  });
});
