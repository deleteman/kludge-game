import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import { addSignalNode, connectNodes } from "./workbench-signal-adapter.js";
import {
  addPiece,
  removePiece,
  createEmptyWorkbenchState,
  findOverlappingPieces,
  WorkbenchError,
  type WorkbenchPiece,
  type WorkbenchPieceId,
} from "./workbench-state.types.js";

function piece(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270 = 0,
): WorkbenchPiece {
  return {
    id: id as WorkbenchPieceId,
    componentDefinitionId: "comp" as ComponentId,
    placement: { position: { x, y }, footprint: { width, height }, rotation },
  };
}

describe("workbench: state", () => {
  it("starts empty", () => {
    const state = createEmptyWorkbenchState();
    expect(state.pieces).toEqual([]);
    expect(state.signalGraph).toEqual({ nodes: [], edges: [] });
  });

  it("adds non-overlapping pieces", () => {
    const state = addPiece(
      addPiece(createEmptyWorkbenchState(), piece("a", 0, 0, 1, 1)),
      piece("b", 1, 0, 1, 1),
    );
    expect(state.pieces).toHaveLength(2);
  });

  it("rejects a duplicate piece id", () => {
    const state = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0, 1, 1));
    expect(() => addPiece(state, piece("a", 5, 5, 1, 1))).toThrow(WorkbenchError);
  });

  it("rejects placing a piece that overlaps an existing one", () => {
    const state = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0, 2, 2));
    expect(() => addPiece(state, piece("b", 1, 1, 2, 2))).toThrow(WorkbenchError);
  });

  it("detects overlap considering rotation swapping width/height", () => {
    const overlaps = findOverlappingPieces([piece("a", 0, 0, 2, 1, 90), piece("b", 0, 1, 1, 1)]);
    expect(overlaps).toHaveLength(1);
  });

  it("allows adjacent (non-overlapping) pieces", () => {
    const overlaps = findOverlappingPieces([piece("a", 0, 0, 1, 1), piece("b", 1, 0, 1, 1)]);
    expect(overlaps).toEqual([]);
  });

  it("removePiece deletes the piece and cleans up its signal nodes and dangling edges", () => {
    let state = addPiece(
      addPiece(createEmptyWorkbenchState(), piece("a", 0, 0, 1, 1)),
      piece("b", 1, 0, 1, 1),
    );
    state = addSignalNode(state, "na" as SignalNodeId, "a" as WorkbenchPieceId, "conductor", { x: 0, y: 0 });
    state = addSignalNode(state, "nb" as SignalNodeId, "b" as WorkbenchPieceId, "conductor", { x: 1, y: 0 });
    state = connectNodes(state, "e1" as SignalEdgeId, "na" as SignalNodeId, "nb" as SignalNodeId);

    const after = removePiece(state, "a" as WorkbenchPieceId);

    expect(after.pieces.map((p) => p.id)).toEqual(["b"]);
    expect(after.signalGraph.nodes.map((n) => n.id)).toEqual(["nb"]);
    expect(after.signalGraph.edges).toEqual([]);
  });

  it("removePiece is a no-op for an unknown piece id", () => {
    const state = addPiece(createEmptyWorkbenchState(), piece("a", 0, 0, 1, 1));
    expect(removePiece(state, "ghost" as WorkbenchPieceId)).toEqual(state);
  });
});
