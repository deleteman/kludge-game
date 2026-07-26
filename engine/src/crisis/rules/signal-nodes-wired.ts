import type { CrisisEvalContext, CrisisResolutionRule } from "../crisis-rule.js";
import type { CrisisResolutionSpec, SignalNodesWiredResolutionSpec } from "../crisis-definition.types.js";
import type { SignalNodeId } from "../../signals/signal-node.types.js";

/**
 * Resolución de señal (capítulo 1, 2º paso): verdadera cuando `fromNodeId` y
 * `toNodeId` están conectados en el grafo de señales del plano. La conectividad
 * se evalúa NO dirigida (BFS tratando cada edge como bidireccional): el gesto de
 * cablear del jugador fija la dirección del edge, pero para "el sensor y la
 * compuerta quedaron unidos" da igual en qué orden clickeó los nodos. Un BFS
 * (no solo edge directo) deja la regla lista para capítulos con nodos
 * intermedios sin cambiarla.
 */
export class SignalNodesWiredRule implements CrisisResolutionRule {
  readonly kind = "signal-nodes-wired" as const;

  isResolved(spec: CrisisResolutionSpec, ctx: CrisisEvalContext): boolean {
    const typedSpec = spec as SignalNodesWiredResolutionSpec;
    return this.areConnected(ctx, typedSpec.fromNodeId, typedSpec.toNodeId);
  }

  private areConnected(ctx: CrisisEvalContext, from: SignalNodeId, to: SignalNodeId): boolean {
    if (from === to) return true;

    const adjacency = new Map<SignalNodeId, SignalNodeId[]>();
    const link = (a: SignalNodeId, b: SignalNodeId): void => {
      const list = adjacency.get(a) ?? [];
      list.push(b);
      adjacency.set(a, list);
    };
    for (const edge of ctx.ship.signalGraph.edges) {
      link(edge.from, edge.to);
      link(edge.to, edge.from);
    }

    const visited = new Set<SignalNodeId>([from]);
    const queue: SignalNodeId[] = [from];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    return false;
  }
}
