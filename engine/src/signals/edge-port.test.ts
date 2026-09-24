import { describe, expect, it } from "vitest";
import { effectiveInputPort, inputPortsOf, setEdgePort } from "./edge-port.js";
import { setNodeBehavior } from "./set-node-behavior.js";
import { SignalEvaluator } from "./signal-evaluator.js";
import type { SignalEdgeId } from "./signal-edge.types.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNode, SignalNodeId } from "./signal-node.types.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;
const edgeId = (value: string): SignalEdgeId => value as SignalEdgeId;
const node = (raw: string, role: SignalNode["role"], behavior?: SignalNode["behavior"]): SignalNode => ({
  id: id(raw),
  role,
  position: { x: 0, y: 0 },
  ownerRef: raw,
  behavior,
});

const latchGraph = (): SignalGraph => ({
  nodes: [node("boton-set", "emitter"), node("boton-reset", "emitter"), node("mem", "receptor", { kind: "latch" })],
  edges: [
    { id: edgeId("e1"), from: id("boton-set"), to: id("mem") },
    { id: edgeId("e2"), from: id("boton-reset"), to: id("mem") },
  ],
});

describe("signals: puertos de entrada por cable", () => {
  it("sólo latch y contador tienen puertos; el primero es el default", () => {
    expect(inputPortsOf({ kind: "latch" })).toEqual(["set", "reset"]);
    expect(inputPortsOf({ kind: "counter", threshold: 2 })).toEqual(["count", "reset"]);
    expect(inputPortsOf({ kind: "gate", mode: "AND" })).toEqual([]);
    expect(inputPortsOf(undefined)).toEqual([]);
    expect(effectiveInputPort({ kind: "latch" }, undefined)).toBe("set");
    expect(effectiveInputPort({ kind: "latch" }, "reset")).toBe("reset");
  });

  it("fija el puerto de un cable y rechaza uno que el destino no lee", () => {
    const result = setEdgePort(latchGraph(), edgeId("e2"), "reset");
    expect(result.ok && result.graph.edges.find((e) => e.id === edgeId("e2"))?.toPort).toBe("reset");
    expect(setEdgePort(latchGraph(), edgeId("nada"), "reset")).toEqual({ ok: false, issue: "unknown-edge" });
    expect(setEdgePort(latchGraph(), edgeId("e1"), "count")).toEqual({ ok: false, issue: "port-not-supported" });
    const andGraph = setNodeBehavior(latchGraph(), id("mem"), { kind: "gate", mode: "AND" });
    if (!andGraph.ok) throw new Error("setNodeBehavior falló");
    expect(setEdgePort(andGraph.graph, edgeId("e1"), "reset")).toEqual({ ok: false, issue: "port-not-supported" });
  });

  it("un latch armado con puertos se enciende con set y se apaga con reset (extremo a extremo)", () => {
    const ported = setEdgePort(latchGraph(), edgeId("e2"), "reset");
    if (!ported.ok) throw new Error("setEdgePort falló");
    const evaluator = new SignalEvaluator(ported.graph);
    const state = evaluator.createState();
    const tick = (set: boolean, reset: boolean, t: number): boolean => {
      evaluator.tick(state, new Map([[id("boton-set"), set], [id("boton-reset"), reset]]), { dtSeconds: 1, elapsedSeconds: t });
      evaluator.tick(state, new Map([[id("boton-set"), set], [id("boton-reset"), reset]]), { dtSeconds: 1, elapsedSeconds: t + 0.5 });
      return state.get(id("mem"))?.output ?? false;
    };
    expect(tick(true, false, 1)).toBe(true);
    expect(tick(false, false, 2)).toBe(true);
    expect(tick(false, true, 3)).toBe(false);
  });

  it("al reconfigurar el nodo, los puertos que el behavior nuevo no lee vuelven al default", () => {
    const counter = setNodeBehavior(latchGraph(), id("mem"), { kind: "counter", threshold: 2 });
    if (!counter.ok) throw new Error("setNodeBehavior falló");
    const marked = setEdgePort(counter.graph, edgeId("e1"), "count");
    if (!marked.ok) throw new Error("setEdgePort falló");
    const back = setNodeBehavior(marked.graph, id("mem"), { kind: "latch" });
    if (!back.ok) throw new Error("setNodeBehavior falló");
    expect(back.graph.edges.find((e) => e.id === edgeId("e1"))?.toPort).toBeUndefined();
    // "reset" existe en ambos: sobrevive al cambio.
    const reset = setEdgePort(counter.graph, edgeId("e2"), "reset");
    if (!reset.ok) throw new Error("setEdgePort falló");
    const kept = setNodeBehavior(reset.graph, id("mem"), { kind: "latch" });
    expect(kept.ok && kept.graph.edges.find((e) => e.id === edgeId("e2"))?.toPort).toBe("reset");
  });
});
