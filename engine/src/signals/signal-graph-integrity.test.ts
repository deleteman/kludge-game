import { describe, expect, it } from "vitest";
import {
  assertSignalGraphIntegrity,
  validateSignalGraphIntegrity,
} from "./signal-graph-integrity.js";
import type { SignalEdgeId } from "./signal-edge.types.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

const NODE_A = "node-a" as SignalNodeId;
const NODE_B = "node-b" as SignalNodeId;
const EDGE_AB = "edge-ab" as SignalEdgeId;

describe("signals: signal graph integrity", () => {
  it("reports no issues for a well-formed graph", () => {
    const graph: SignalGraph = {
      nodes: [
        { id: NODE_A, role: "emitter", position: { x: 0, y: 0 }, ownerRef: "fixture-owner" },
        { id: NODE_B, role: "receptor", position: { x: 1, y: 0 }, ownerRef: "fixture-owner" },
      ],
      edges: [{ id: EDGE_AB, from: NODE_A, to: NODE_B }],
    };

    expect(validateSignalGraphIntegrity(graph)).toEqual([]);
    expect(() => assertSignalGraphIntegrity(graph)).not.toThrow();
  });

  it("detects a duplicate node id", () => {
    const graph: SignalGraph = {
      nodes: [
        { id: NODE_A, role: "emitter", position: { x: 0, y: 0 }, ownerRef: "fixture-owner" },
        { id: NODE_A, role: "conductor", position: { x: 1, y: 0 }, ownerRef: "fixture-owner" },
      ],
      edges: [],
    };

    const issues = validateSignalGraphIntegrity(graph);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("duplicate-node-id");
  });

  it("detects a dangling edge endpoint", () => {
    const graph: SignalGraph = {
      nodes: [{ id: NODE_A, role: "emitter", position: { x: 0, y: 0 }, ownerRef: "fixture-owner" }],
      edges: [{ id: EDGE_AB, from: NODE_A, to: NODE_B }],
    };

    const issues = validateSignalGraphIntegrity(graph);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("dangling-edge-endpoint");
    expect(() => assertSignalGraphIntegrity(graph)).toThrow(/Signal graph integrity violated/);
  });
});
