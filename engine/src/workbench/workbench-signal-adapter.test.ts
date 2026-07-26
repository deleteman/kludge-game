import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { addSignalNode, connectNodes } from "./workbench-signal-adapter.js";
import {
  addPiece,
  createEmptyWorkbenchState,
  WorkbenchError,
  type WorkbenchPiece,
  type WorkbenchPieceId,
} from "./workbench-state.types.js";

const nodeId = (value: string) => value as SignalNodeId;
const edgeId = (value: string) => value as SignalEdgeId;

function piece(id: string, x: number, y: number): WorkbenchPiece {
  return {
    id: id as WorkbenchPieceId,
    componentDefinitionId: "comp" as ComponentId,
    placement: { position: { x, y }, footprint: { width: 1, height: 1 }, rotation: 0 },
  };
}

describe("workbench: signal adapter", () => {
  it("attaches a signal node to an existing piece", () => {
    const withPiece = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0));
    const state = addSignalNode(withPiece, nodeId("n1"), "a" as WorkbenchPieceId, "emitter", {
      x: 0,
      y: 0,
    });
    expect(state.signalGraph.nodes).toHaveLength(1);
  });

  it("rejects attaching a node to an unknown piece", () => {
    const state = createEmptyWorkbenchState();
    expect(() =>
      addSignalNode(state, nodeId("n1"), "missing" as WorkbenchPieceId, "emitter", { x: 0, y: 0 }),
    ).toThrow(WorkbenchError);
  });

  it("connects two existing nodes", () => {
    let state = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0));
    state = addPiece(state, piece("b", 1, 0));
    state = addSignalNode(state, nodeId("n1"), "a" as WorkbenchPieceId, "emitter", { x: 0, y: 0 });
    state = addSignalNode(state, nodeId("n2"), "b" as WorkbenchPieceId, "receptor", { x: 1, y: 0 });
    state = connectNodes(state, edgeId("e1"), nodeId("n1"), nodeId("n2"));
    expect(state.signalGraph.edges).toHaveLength(1);
  });

  it("rejects connecting a node to itself", () => {
    let state = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0));
    state = addSignalNode(state, nodeId("n1"), "a" as WorkbenchPieceId, "emitter", { x: 0, y: 0 });
    expect(() => connectNodes(state, edgeId("e1"), nodeId("n1"), nodeId("n1"))).toThrow(
      WorkbenchError,
    );
  });

  it("rejects connecting to a node that does not exist (dangling edge endpoint)", () => {
    let state = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0));
    state = addSignalNode(state, nodeId("n1"), "a" as WorkbenchPieceId, "emitter", { x: 0, y: 0 });
    expect(() => connectNodes(state, edgeId("e1"), nodeId("n1"), nodeId("missing"))).toThrow(
      WorkbenchError,
    );
  });
});
