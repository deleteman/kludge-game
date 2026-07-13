// GDD 9, caso 4 — "El Piano de Emergencia": 3 sensores + nodo combinador (AND) + latch con reset de prioridad absoluta.
import { describe, expect, it, vi } from "vitest";
import {
  EventEmitter,
  SignalEvaluator,
  type SignalDomainEvent,
  type SignalEdge,
  type SignalEdgeId,
  type SignalEmitterInputs,
  type SignalGraph,
  type SignalNode,
  type SignalNodeId,
  type SignalNodeRole,
  type TickContext,
} from "../index.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;

function node(raw: string, role: SignalNodeRole, behavior?: SignalNode["behavior"]): SignalNode {
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

describe("case 4 — El Piano de Emergencia", () => {
  it("three sensors combined through AND, latched with absolute-priority reset", () => {
    // 3 sensores -> AND -> set del latch; un botón de reset separado.
    const graph: SignalGraph = {
      nodes: [
        node("sensor-1", "emitter"),
        node("sensor-2", "emitter"),
        node("sensor-3", "emitter"),
        node("reset-button", "emitter"),
        node("combinador", "conductor", { kind: "gate", mode: "AND" }),
        node("piano", "receptor", { kind: "latch" }),
      ],
      edges: [
        edge("sensor-1", "combinador"),
        edge("sensor-2", "combinador"),
        edge("sensor-3", "combinador"),
        edge("combinador", "piano", "set"),
        edge("reset-button", "piano", "reset"),
      ],
    };
    const emitter = new EventEmitter<SignalDomainEvent>();
    const latched = vi.fn();
    emitter.on("signal-latched", latched);
    const evaluator = new SignalEvaluator(graph, emitter);
    const state = evaluator.createState();

    let elapsed = 0;
    const run = (inputs: Record<string, boolean>): void => {
      const map: SignalEmitterInputs = new Map(Object.entries(inputs).map(([k, v]) => [id(k), v]));
      evaluator.tick(state, map, tickOf(elapsed));
      elapsed += 1;
    };
    // Sostiene un nivel lógico varios ticks para que se propague por la
    // cadena de 2 hops (sensor -> combinador -> latch, un hop de circuito por
    // tick cada uno).
    const sustain = (inputs: Record<string, boolean>, ticks = 4): void => {
      for (let i = 0; i < ticks; i++) run(inputs);
    };

    // Solo 2 de 3 sensores activos: el AND no dispara, el piano no se activa.
    sustain({ "sensor-1": true, "sensor-2": true, "sensor-3": false, "reset-button": false });
    expect(state.get(id("piano"))?.output).toBe(false);

    // Los 3 sensores a la vez: AND dispara -> set -> latch engancha.
    sustain({ "sensor-1": true, "sensor-2": true, "sensor-3": true, "reset-button": false });
    expect(state.get(id("piano"))?.output).toBe(true);

    // Los sensores cesan: la memoria del latch retiene el estado (GDD 5.6).
    run({ "sensor-1": false, "sensor-2": false, "sensor-3": false, "reset-button": false });
    expect(state.get(id("piano"))?.output).toBe(true);

    // Reset y set simultáneos: reset tiene prioridad absoluta.
    sustain({ "sensor-1": true, "sensor-2": true, "sensor-3": true, "reset-button": true });
    expect(state.get(id("piano"))?.output).toBe(false);

    expect(latched).toHaveBeenCalledWith(expect.objectContaining({ engaged: true }));
    expect(latched).toHaveBeenCalledWith(expect.objectContaining({ engaged: false }));
  });
});
