// GDD 9, caso 5 — "El Cañón que Aprende": verificación cruzada amigo/enemigo (NOT) + contador incremental (memoria).
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

describe("case 5 — El Cañón que Aprende", () => {
  it("only counts confirmed-hostile detections (NOT friend), and learns after 3 of them", () => {
    const graph: SignalGraph = {
      nodes: [
        node("enemigo-detectado", "emitter"),
        node("iff-amigo", "emitter"), // Identify Friend/Foe: activo = es amigo.
        node("no-es-amigo", "conductor", { kind: "gate", mode: "NOT" }),
        node("impacto-confirmado", "conductor", { kind: "gate", mode: "AND" }),
        node("canon-aprendido", "receptor", { kind: "counter", threshold: 3 }),
      ],
      edges: [
        edge("iff-amigo", "no-es-amigo"),
        edge("enemigo-detectado", "impacto-confirmado"),
        edge("no-es-amigo", "impacto-confirmado"),
        edge("impacto-confirmado", "canon-aprendido"),
      ],
    };
    const emitter = new EventEmitter<SignalDomainEvent>();
    const learned = vi.fn();
    emitter.on("counter-threshold-reached", learned);
    const evaluator = new SignalEvaluator(graph, emitter);
    const state = evaluator.createState();

    let elapsed = 0;
    const run = (inputs: Record<string, boolean>): void => {
      const map: SignalEmitterInputs = new Map(Object.entries(inputs).map(([k, v]) => [id(k), v]));
      evaluator.tick(state, map, tickOf(elapsed));
      elapsed += 1;
    };
    const sustain = (inputs: Record<string, boolean>, ticks = 6): void => {
      for (let i = 0; i < ticks; i++) run(inputs);
    };

    // El IFF se fija ANTES de cada detección y se sostiene el tiempo suficiente
    // para que el NOT (1 hop de propagación) se estabilice antes de activar
    // "enemigo-detectado" — evita falsos flancos transitorios mientras el NOT
    // todavía arrastra el valor del IFF anterior.

    // Hostil confirmado (no es amigo) -> cuenta 1.
    sustain({ "enemigo-detectado": false, "iff-amigo": false }); // asienta no-es-amigo=true
    sustain({ "enemigo-detectado": true, "iff-amigo": false });
    sustain({ "enemigo-detectado": false, "iff-amigo": false });

    // Un amigo detectado (IFF activo): el NOT bloquea el conteo, no debe sumar.
    sustain({ "enemigo-detectado": false, "iff-amigo": true }); // asienta no-es-amigo=false
    sustain({ "enemigo-detectado": true, "iff-amigo": true });
    sustain({ "enemigo-detectado": false, "iff-amigo": true });
    expect(state.get(id("canon-aprendido"))?.counterValue).toBe(1);
    expect(state.get(id("canon-aprendido"))?.output).toBe(false);

    // Dos hostiles confirmados más -> alcanza el umbral y "aprende".
    sustain({ "enemigo-detectado": false, "iff-amigo": false }); // asienta no-es-amigo=true otra vez
    sustain({ "enemigo-detectado": true, "iff-amigo": false });
    sustain({ "enemigo-detectado": false, "iff-amigo": false });
    sustain({ "enemigo-detectado": true, "iff-amigo": false });

    expect(state.get(id("canon-aprendido"))?.counterValue).toBe(3);
    expect(state.get(id("canon-aprendido"))?.output).toBe(true);
    expect(learned).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "counter-threshold-reached", count: 3 }),
    );
  });
});
