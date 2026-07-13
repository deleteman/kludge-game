import type { SignalEdge } from "./signal-edge.types.js";
import type { SignalNode } from "./signal-node.types.js";

export interface SignalGraph<TOwnerRef = string> {
  readonly nodes: ReadonlyArray<SignalNode<TOwnerRef>>;
  readonly edges: ReadonlyArray<SignalEdge>;
}
