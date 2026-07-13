// GDD 9, caso 6 — "El Pulmón Compartido": oscilador cíclico + prioridad por presencia + memoria de patrón de uso a largo plazo.
//
// Interpretación con las primitivas ya existentes (documentada aquí, no hay
// comportamiento nuevo para este caso): el oscilador modela la ventana
// cíclica de acceso al pulmón compartido; una compuerta AND(ciclo, presencia)
// modela que el acceso se concede solo si la sala tiene presencia Y el ciclo
// está en su ventana activa ("prioridad por presencia"); un latch aguas abajo
// registra que la sala USÓ el pulmón alguna vez, sin resetearse cuando la
// presencia cesa — la diferencia entre el acceso momentáneo (la compuerta,
// que sube y baja) y el patrón de uso a largo plazo (el latch, que retiene)
// es exactamente la distinción que pide el caso.
import { describe, expect, it } from "vitest";
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

describe("case 6 — El Pulmón Compartido", () => {
  it("gates momentary access by presence within the oscillator window, and remembers usage long after presence ends", () => {
    const graph: SignalGraph = {
      nodes: [
        node("ciclo", "conductor", { kind: "oscillator", periodSeconds: 2 }),
        node("presencia-a", "emitter"),
        node("valvula-a", "conductor", { kind: "gate", mode: "AND" }),
        node("memoria-uso-a", "receptor", { kind: "latch" }),
      ],
      edges: [
        edge("ciclo", "valvula-a"),
        edge("presencia-a", "valvula-a"),
        edge("valvula-a", "memoria-uso-a"),
      ],
    };
    const emitter = new EventEmitter<SignalDomainEvent>();
    const evaluator = new SignalEvaluator(graph, emitter);
    const state = evaluator.createState();

    const valveHistory: boolean[] = [];
    for (let t = 0; t < 13; t++) {
      const presence = t < 8; // la sala tiene presencia solo hasta t=7.
      const map: SignalEmitterInputs = new Map([[id("presencia-a"), presence]]);
      evaluator.tick(state, map, tickOf(t));
      valveHistory.push(state.get(id("valvula-a"))?.output ?? false);
    }

    // Con presencia sostenida y el ciclo alternando, la válvula sí llegó a
    // abrirse (acceso momentáneo concedido por prioridad de presencia).
    expect(valveHistory.some((open) => open)).toBe(true);
    // Tras t=7 la presencia cesa: el acceso momentáneo se cierra...
    expect(state.get(id("valvula-a"))?.output).toBe(false);
    // ...pero la memoria de patrón de uso a largo plazo persiste (GDD 5.6:
    // el latch retiene su estado aunque cese el trigger original).
    expect(state.get(id("memoria-uso-a"))?.output).toBe(true);
  });
});
