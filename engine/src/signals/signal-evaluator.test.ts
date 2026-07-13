import { describe, expect, it, vi } from "vitest";
import { SignalEvaluator } from "./signal-evaluator.js";
import type { SignalEmitterInputs } from "./signal-evaluator.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNode, SignalNodeId, SignalNodeRole } from "./signal-node.types.js";
import type { SignalEdge, SignalEdgeId } from "./signal-edge.types.js";
import type { SignalBehavior } from "./signal-behavior.types.js";
import type { SignalDomainEvent } from "./signal-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;

function node(raw: string, role: SignalNodeRole, behavior?: SignalBehavior): SignalNode {
  return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: raw, behavior };
}

function edge(from: string, to: string, toPort?: string): SignalEdge {
  return {
    id: `${from}->${to}${toPort ? `:${toPort}` : ""}` as SignalEdgeId,
    from: id(from),
    to: id(to),
    toPort,
  };
}

const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

function run(
  evaluator: SignalEvaluator,
  state: ReturnType<SignalEvaluator["createState"]>,
  inputs: Record<string, boolean>,
  elapsed: number,
): void {
  const map: SignalEmitterInputs = new Map(Object.entries(inputs).map(([k, v]) => [id(k), v]));
  evaluator.tick(state, map, tickOf(elapsed));
}

describe("signals: SignalEvaluator (integración temporal, GDD 5.6)", () => {
  it("propagates two emitters through an AND gate (síncrono, un hop por tick)", () => {
    const graph: SignalGraph = {
      nodes: [
        node("a", "emitter"),
        node("b", "emitter"),
        node("gate", "receptor", { kind: "gate", mode: "AND" }),
      ],
      edges: [edge("a", "gate"), edge("b", "gate")],
    };
    const evaluator = new SignalEvaluator(graph);
    const state = evaluator.createState();

    // Tick 1 fija los emisores; el gate lee sus valores del tick previo -> aún false.
    run(evaluator, state, { a: true, b: true }, 0);
    // Tick 2: el gate ya ve ambos emisores en true.
    run(evaluator, state, { a: true, b: true }, 1);
    expect(state.get(id("gate"))?.output).toBe(true);

    run(evaluator, state, { a: true, b: false }, 2); // b drops; gate still sees prev tick
    run(evaluator, state, { a: true, b: false }, 3); // change reaches the gate one hop later
    expect(state.get(id("gate"))?.output).toBe(false);
  });

  it("holds a latch and honors reset priority across ticks (Piano, caso 4)", () => {
    const graph: SignalGraph = {
      nodes: [
        node("set", "emitter"),
        node("reset", "emitter"),
        node("latch", "receptor", { kind: "latch" }),
      ],
      edges: [edge("set", "latch", "set"), edge("reset", "latch", "reset")],
    };
    const emitter = new EventEmitter<SignalDomainEvent>();
    const latched = vi.fn();
    emitter.on("signal-latched", latched);
    const evaluator = new SignalEvaluator(graph, emitter);
    const state = evaluator.createState();

    run(evaluator, state, { set: true, reset: false }, 0); // set arrives
    run(evaluator, state, { set: true, reset: false }, 1); // latch sees set -> engaged
    expect(state.get(id("latch"))?.output).toBe(true);

    run(evaluator, state, { set: false, reset: false }, 2); // trigger gone
    expect(state.get(id("latch"))?.output).toBe(true); // memory held

    run(evaluator, state, { set: true, reset: true }, 3); // both -> reset wins
    run(evaluator, state, { set: false, reset: false }, 4);
    expect(state.get(id("latch"))?.output).toBe(false);

    expect(latched).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "signal-latched", engaged: true }),
    );
    expect(latched).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "signal-latched", engaged: false }),
    );
  });

  it("emits counter-threshold-reached exactly once when the count is reached (Cañón, caso 5)", () => {
    const graph: SignalGraph = {
      nodes: [
        node("trigger", "emitter"),
        node("counter", "receptor", { kind: "counter", threshold: 3 }),
      ],
      edges: [edge("trigger", "counter")],
    };
    const emitter = new EventEmitter<SignalDomainEvent>();
    const reached = vi.fn();
    emitter.on("counter-threshold-reached", reached);
    const evaluator = new SignalEvaluator(graph, emitter);
    const state = evaluator.createState();

    // Cada nivel lógico se sostiene dos ticks para superar el hop de propagación
    // (mismo patrón que el gate AND arriba): 3 flancos de subida -> 1 evento.
    const triggerSequence = [true, true, false, false, true, true, false, false, true, true];
    triggerSequence.forEach((value, t) => run(evaluator, state, { trigger: value }, t));

    expect(state.get(id("counter"))?.output).toBe(true);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(reached).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "counter-threshold-reached", count: 3 }),
    );
  });

  it("runs a free oscillator as a clock (temporización, caso 6)", () => {
    // El oscilador va en un nodo no-emisor para que el evaluador lo procese por
    // su regla (los emisores toman su valor del mundo, no de un behavior).
    const clockGraph: SignalGraph = {
      nodes: [node("clock", "conductor", { kind: "oscillator", periodSeconds: 2 })],
      edges: [],
    };
    const evaluator = new SignalEvaluator(clockGraph);
    const state = evaluator.createState();

    const outputs: boolean[] = [];
    for (let t = 0; t < 6; t++) {
      run(evaluator, state, {}, t);
      outputs.push(state.get(id("clock"))?.output ?? false);
    }
    // periodo 2s, dt 1s: false, flip@2, ... -> f,t,t,f,f,t
    expect(outputs).toEqual([false, true, true, false, false, true]);
  });
});
