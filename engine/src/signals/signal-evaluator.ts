import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import { DEFAULT_SIGNAL_BEHAVIOR } from "./signal-behavior.types.js";
import { createDefaultSignalRuleRegistry } from "./rules/signal-rule-registry.js";
import { createSignalGraphState } from "./signal-state.types.js";
import type { SignalGraphState } from "./signal-state.types.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalEdge } from "./signal-edge.types.js";
import type { SignalNodeId } from "./signal-node.types.js";
import type { SignalInput } from "./signal-rule.js";
import type { SignalDomainEvent } from "./signal-events.types.js";

/**
 * Valores externos de los nodos emisores en un tick: el mundo (un sensor que
 * detecta movimiento, un botón pulsado) le dice al grafo qué emisores están
 * activos. Un emisor ausente del mapa se considera inactivo.
 */
export type SignalEmitterInputs = ReadonlyMap<SignalNodeId, boolean>;

/**
 * Evalúa un grafo de señales paso a paso (GDD 5.6). Semántica de circuito
 * síncrono: cada nodo calcula su nueva salida a partir de las salidas del tick
 * ANTERIOR de sus nodos origen. Esto:
 *  - resuelve grafos cíclicos sin ordenación topológica (los latches
 *    realimentan su salida como entrada),
 *  - da una propagación determinista de un hop por tick (la temporización fina
 *    entre hops se modela explícitamente con nodos `delay`).
 *
 * El evaluador no reimplementa la lógica de cada comportamiento: delega en las
 * Strategy del registro (`rules/`). Emite `signal-latched` cuando un latch
 * cambia de estado (contrato Observer para Fase 8).
 */
export class SignalEvaluator<TOwnerRef = string> {
  private readonly registry = createDefaultSignalRuleRegistry();
  private readonly incomingByNode = new Map<SignalNodeId, SignalEdge[]>();

  constructor(
    private readonly graph: SignalGraph<TOwnerRef>,
    private readonly emitter?: EventEmitter<SignalDomainEvent>,
  ) {
    for (const node of graph.nodes) {
      this.incomingByNode.set(node.id, []);
    }
    for (const edge of graph.edges) {
      this.incomingByNode.get(edge.to)?.push(edge);
    }
  }

  createState(): SignalGraphState {
    return createSignalGraphState(this.graph);
  }

  tick(state: SignalGraphState, emitterInputs: SignalEmitterInputs, tick: TickContext): void {
    const previousOutputs = new Map<SignalNodeId, boolean>();
    for (const node of this.graph.nodes) {
      previousOutputs.set(node.id, state.get(node.id)?.output ?? false);
    }

    const nextOutputs = new Map<SignalNodeId, boolean>();
    const latchTransitions: Array<{ nodeId: SignalNodeId; engaged: boolean }> = [];

    for (const node of this.graph.nodes) {
      const nodeState = state.get(node.id);
      if (!nodeState) continue;

      let output: boolean;
      if (node.role === "emitter") {
        // La salida de un emisor la fija el mundo, no la topología del grafo.
        output = emitterInputs.get(node.id) ?? false;
      } else {
        const behavior = node.behavior ?? DEFAULT_SIGNAL_BEHAVIOR;
        const rule = this.registry.get(behavior.kind);
        if (!rule) {
          throw new Error(`No signal rule registered for behavior kind: ${behavior.kind}`);
        }
        const inputs: SignalInput[] = (this.incomingByNode.get(node.id) ?? []).map((edge) => ({
          value: previousOutputs.get(edge.from) ?? false,
          port: edge.toPort,
        }));
        const latchBefore = nodeState.latchMemory;
        output = rule.evaluate({ inputs, state: nodeState, tick, behavior });
        if (behavior.kind === "latch" && nodeState.latchMemory !== latchBefore) {
          latchTransitions.push({ nodeId: node.id, engaged: nodeState.latchMemory });
        }
      }
      nextOutputs.set(node.id, output);
    }

    for (const node of this.graph.nodes) {
      const nodeState = state.get(node.id);
      if (nodeState) {
        nodeState.output = nextOutputs.get(node.id) ?? false;
      }
    }

    if (this.emitter) {
      for (const transition of latchTransitions) {
        this.emitter.emit({
          kind: "signal-latched",
          nodeId: transition.nodeId,
          engaged: transition.engaged,
          elapsedSeconds: tick.elapsedSeconds,
        });
      }
    }
  }
}
