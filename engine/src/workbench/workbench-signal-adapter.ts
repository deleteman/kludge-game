import { validateSignalGraphIntegrity } from "../signals/signal-graph-integrity.js";
import type { SignalEdge, SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalBehavior } from "../signals/signal-behavior.types.js";
import type { SignalNode, SignalNodeId, SignalNodeRole } from "../signals/signal-node.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import { WorkbenchError, type WorkbenchPieceId, type WorkbenchState } from "./workbench-state.types.js";

/**
 * Mismo lenguaje de interacción que cablear el plano principal (GDD 10.1:
 * "seleccionar nodo A → arrastrar a nodo B"), instanciado sobre
 * `SignalGraph<WorkbenchPieceId>` — ningún tipo de nodo/arista nuevo, solo
 * operaciones inmutables de conveniencia sobre `WorkbenchState.signalGraph`.
 */

export function addSignalNode(
  state: WorkbenchState,
  nodeId: SignalNodeId,
  pieceId: WorkbenchPieceId,
  role: SignalNodeRole,
  localPosition: GridPosition,
  behavior?: SignalBehavior,
): WorkbenchState {
  if (!state.pieces.some((piece) => piece.id === pieceId)) {
    throw new WorkbenchError(`Cannot attach a signal node to unknown piece: ${pieceId}`);
  }

  const node: SignalNode<WorkbenchPieceId> = {
    id: nodeId,
    role,
    position: localPosition,
    ownerRef: pieceId,
    behavior,
  };

  const nextGraph = { ...state.signalGraph, nodes: [...state.signalGraph.nodes, node] };
  const issues = validateSignalGraphIntegrity(nextGraph);
  if (issues.length > 0) {
    throw new WorkbenchError(`Invalid signal node: ${JSON.stringify(issues)}`);
  }

  return { ...state, signalGraph: nextGraph };
}

export function connectNodes(
  state: WorkbenchState,
  edgeId: SignalEdgeId,
  fromNodeId: SignalNodeId,
  toNodeId: SignalNodeId,
  toPort?: string,
): WorkbenchState {
  if (fromNodeId === toNodeId) {
    throw new WorkbenchError(`Cannot connect a signal node to itself: ${fromNodeId}`);
  }

  const edge: SignalEdge = { id: edgeId, from: fromNodeId, to: toNodeId, toPort };
  const nextGraph = { ...state.signalGraph, edges: [...state.signalGraph.edges, edge] };
  const issues = validateSignalGraphIntegrity(nextGraph);
  if (issues.length > 0) {
    throw new WorkbenchError(`Invalid signal connection: ${JSON.stringify(issues)}`);
  }

  return { ...state, signalGraph: nextGraph };
}
