import { describe, expect, it } from "vitest";
import { isValidSignalBehavior, setNodeBehavior, signalBehaviorsEqual } from "./set-node-behavior.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNode, SignalNodeId } from "./signal-node.types.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;

function node(raw: string, role: SignalNode["role"], behavior?: SignalNode["behavior"]): SignalNode {
  return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: raw, behavior };
}

const graph: SignalGraph = {
  nodes: [node("sensor", "emitter"), node("chip", "receptor"), node("cable", "conductor")],
  edges: [],
};

describe("signals: setNodeBehavior", () => {
  it("fija el behavior de un nodo sin tocar los demás ni mutar el grafo original", () => {
    const result = setNodeBehavior(graph, id("chip"), { kind: "gate", mode: "AND" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes.find((n) => n.id === id("chip"))?.behavior).toEqual({ kind: "gate", mode: "AND" });
    expect(result.graph.nodes.find((n) => n.id === id("cable"))?.behavior).toBeUndefined();
    expect(graph.nodes.find((n) => n.id === id("chip"))?.behavior).toBeUndefined();
  });

  it("devuelve la MISMA referencia si el behavior no cambia (no fuerza reconstruir el evaluador)", () => {
    const result = setNodeBehavior(graph, id("chip"), { kind: "passthrough" });
    expect(result.ok && result.graph === graph).toBe(true);
  });

  it("rechaza nodo inexistente y emisores (su salida la fija el mundo)", () => {
    expect(setNodeBehavior(graph, id("nada"), { kind: "latch" })).toEqual({ ok: false, issue: "unknown-node" });
    expect(setNodeBehavior(graph, id("sensor"), { kind: "latch" })).toEqual({
      ok: false,
      issue: "emitter-not-configurable",
    });
  });

  it("rechaza parámetros sin sentido físico", () => {
    for (const behavior of [
      { kind: "delay", delaySeconds: 0 },
      { kind: "delay", delaySeconds: Number.NaN },
      { kind: "oscillator", periodSeconds: -1 },
      { kind: "counter", threshold: 0 },
      { kind: "counter", threshold: 2.5 },
    ] as const) {
      expect(isValidSignalBehavior(behavior)).toBe(false);
      expect(setNodeBehavior(graph, id("chip"), behavior)).toEqual({ ok: false, issue: "invalid-parameter" });
    }
    expect(isValidSignalBehavior({ kind: "counter", threshold: 3 })).toBe(true);
  });

  it("compara behaviors por valor y trata `undefined` como passthrough", () => {
    expect(signalBehaviorsEqual(undefined, { kind: "passthrough" })).toBe(true);
    expect(signalBehaviorsEqual({ kind: "delay", delaySeconds: 2 }, { kind: "delay", delaySeconds: 2 })).toBe(true);
    expect(signalBehaviorsEqual({ kind: "delay", delaySeconds: 2 }, { kind: "delay", delaySeconds: 3 })).toBe(false);
  });
});
