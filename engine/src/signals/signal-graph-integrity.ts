import type { SignalGraph } from "./signal-graph.types.js";

/**
 * Chequeos de integridad estructural del grafo — NO lógica de reacción ni de
 * combinación de señales (eso es Fase 2). Solo valida que el dato en sí sea
 * consistente: sin ids duplicados, sin edges que apunten a nodos que no
 * existen.
 */
export interface SignalGraphIntegrityIssue {
  readonly kind: "duplicate-node-id" | "dangling-edge-endpoint";
  readonly detail: string;
}

export function validateSignalGraphIntegrity<TOwnerRef>(
  graph: SignalGraph<TOwnerRef>,
): SignalGraphIntegrityIssue[] {
  const issues: SignalGraphIntegrityIssue[] = [];

  const seenNodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (seenNodeIds.has(node.id)) {
      issues.push({ kind: "duplicate-node-id", detail: `Duplicate node id: ${node.id}` });
    }
    seenNodeIds.add(node.id);
  }

  for (const edge of graph.edges) {
    if (!seenNodeIds.has(edge.from)) {
      issues.push({
        kind: "dangling-edge-endpoint",
        detail: `Edge ${edge.id} references missing 'from' node: ${edge.from}`,
      });
    }
    if (!seenNodeIds.has(edge.to)) {
      issues.push({
        kind: "dangling-edge-endpoint",
        detail: `Edge ${edge.id} references missing 'to' node: ${edge.to}`,
      });
    }
  }

  return issues;
}

export function assertSignalGraphIntegrity<TOwnerRef>(graph: SignalGraph<TOwnerRef>): void {
  const issues = validateSignalGraphIntegrity(graph);
  if (issues.length > 0) {
    throw new Error(`Signal graph integrity violated: ${JSON.stringify(issues)}`);
  }
}
