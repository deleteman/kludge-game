import { describe, expect, it } from "vitest";
import { summarizeNodeLogic, tallyNodeInputs } from "./node-logic-summary.js";
import { SignalEvaluator } from "./signal-evaluator.js";
import { createSignalNodeState } from "./signal-state.types.js";
import type { SignalBehavior } from "./signal-behavior.types.js";
import type { SignalEdge, SignalEdgeId } from "./signal-edge.types.js";
import type { SignalNode, SignalNodeId } from "./signal-node.types.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;
const node = (raw: string, role: SignalNode["role"], behavior?: SignalBehavior): SignalNode => ({
  id: id(raw),
  role,
  position: { x: 0, y: 0 },
  ownerRef: raw,
  behavior,
});
const edge = (raw: string, from: string, to: string, toPort?: string): SignalEdge => ({
  id: raw as SignalEdgeId,
  from: id(from),
  to: id(to),
  toPort,
});
const NO_INPUTS = { active: 0, total: 0 };

describe("signals: tallyNodeInputs", () => {
  it("cuenta cuántas entradas hay y cuántas están activas, ignorando las salientes", () => {
    const edges = [edge("e1", "a", "chip"), edge("e2", "b", "chip"), edge("e3", "chip", "led")];
    const active = new Set([id("a")]);
    expect(tallyNodeInputs(edges, id("chip"), (source) => active.has(source))).toEqual({ active: 1, total: 2 });
    expect(tallyNodeInputs(edges, id("a"), () => true)).toEqual({ active: 0, total: 0 });
  });
});

describe("signals: summarizeNodeLogic", () => {
  it("un nodo sin lógica propia (passthrough o sin behavior) no tiene resumen", () => {
    expect(summarizeNodeLogic(undefined, undefined, NO_INPUTS)).toBeUndefined();
    expect(summarizeNodeLogic({ kind: "passthrough" }, createSignalNodeState(), NO_INPUTS)).toBeUndefined();
  });

  it("compuerta: lleva el modo, cuántas entradas están activas y la salida", () => {
    const state = createSignalNodeState();
    expect(summarizeNodeLogic({ kind: "gate", mode: "AND" }, state, { active: 1, total: 2 })).toEqual({
      kind: "gate",
      mode: "AND",
      inputs: { active: 1, total: 2 },
      output: false,
    });
  });

  it("memoria: enganchada o libre según latchMemory", () => {
    const state = createSignalNodeState();
    expect(summarizeNodeLogic({ kind: "latch" }, state, NO_INPUTS)).toEqual({ kind: "latch", engaged: false });
    state.latchMemory = true;
    expect(summarizeNodeLogic({ kind: "latch" }, state, NO_INPUTS)).toEqual({ kind: "latch", engaged: true });
  });

  it("contador: cuenta, umbral y si ya lo alcanzó", () => {
    const state = createSignalNodeState();
    state.counterValue = 1;
    expect(summarizeNodeLogic({ kind: "counter", threshold: 2 }, state, NO_INPUTS)).toEqual({
      kind: "counter",
      count: 1,
      threshold: 2,
      reached: false,
    });
    state.counterValue = 2;
    expect(summarizeNodeLogic({ kind: "counter", threshold: 2 }, state, NO_INPUTS)).toMatchObject({ reached: true });
  });

  it("reloj: sin entradas corre libre; con entradas sólo mientras alguna esté activa", () => {
    const state = createSignalNodeState();
    const oscillator: SignalBehavior = { kind: "oscillator", periodSeconds: 1 };
    expect(summarizeNodeLogic(oscillator, state, NO_INPUTS)).toMatchObject({ running: true });
    expect(summarizeNodeLogic(oscillator, state, { active: 0, total: 1 })).toMatchObject({ running: false });
    expect(summarizeNodeLogic(oscillator, state, { active: 1, total: 1 })).toMatchObject({ running: true });
  });

  it("retardo: 'en curso' mientras la entrada ya cambió y la salida todavía no", () => {
    const state = createSignalNodeState();
    const delay: SignalBehavior = { kind: "delay", delaySeconds: 2 };
    expect(summarizeNodeLogic(delay, state, NO_INPUTS)).toMatchObject({ pending: false });
    state.delayTarget = true;
    state.delayRemainingSeconds = 1.5;
    expect(summarizeNodeLogic(delay, state, NO_INPUTS)).toMatchObject({ pending: true, remainingSeconds: 1.5 });
  });
});

describe("signals: el resumen refleja al evaluador real, tick a tick", () => {
  it("un contador cableado a un emisor sube su cuenta con cada flanco y llega a 'alcanzado'", () => {
    const nodes = [node("sensor", "emitter"), node("cont", "receptor", { kind: "counter", threshold: 2 })];
    const edges = [edge("e1", "sensor", "cont")];
    const evaluator = new SignalEvaluator({ nodes, edges });
    const state = evaluator.createState();
    const summary = () =>
      summarizeNodeLogic(nodes[1]!.behavior, state.get(id("cont")), tallyNodeInputs(edges, id("cont"), (s) => state.get(s)?.output ?? false));
    let t = 0;
    const tick = (sensorOn: boolean) => {
      t += 1;
      evaluator.tick(state, new Map([[id("sensor"), sensorOn]]), { dtSeconds: 1, elapsedSeconds: t });
    };

    expect(summary()).toMatchObject({ count: 0, reached: false });
    tick(true);
    tick(true);
    expect(summary()).toMatchObject({ count: 1, reached: false });
    tick(false);
    tick(false);
    tick(true);
    tick(true);
    expect(summary()).toMatchObject({ count: 2, reached: true });
  });
});
