import { validateSignalGraphIntegrity } from "../signals/signal-graph-integrity.js";
import type { Blueprint } from "./blueprint.types.js";

export interface BlueprintIntegrityIssue {
  readonly kind:
    | "duplicate-instance-id"
    | "dangling-reservoir-reference"
    | "dangling-signal-node-owner"
    | "signal-graph-issue";
  readonly detail: string;
}

export function validateBlueprintIntegrity(blueprint: Blueprint): BlueprintIntegrityIssue[] {
  const issues: BlueprintIntegrityIssue[] = [];

  const seenInstanceIds = new Set<string>();
  for (const placed of blueprint.placedComponents) {
    if (seenInstanceIds.has(placed.instanceId)) {
      issues.push({
        kind: "duplicate-instance-id",
        detail: `Duplicate placed component instanceId: ${placed.instanceId}`,
      });
    }
    seenInstanceIds.add(placed.instanceId);
  }

  for (const reservoir of blueprint.reservoirContents) {
    if (!seenInstanceIds.has(reservoir.componentInstanceId)) {
      issues.push({
        kind: "dangling-reservoir-reference",
        detail: `Reservoir content references missing component instance: ${reservoir.componentInstanceId}`,
      });
    }
  }

  for (const node of blueprint.signalGraph.nodes) {
    if (!seenInstanceIds.has(node.ownerRef)) {
      issues.push({
        kind: "dangling-signal-node-owner",
        detail: `Signal node ${node.id} references missing component instance: ${node.ownerRef}`,
      });
    }
  }

  for (const signalIssue of validateSignalGraphIntegrity(blueprint.signalGraph)) {
    issues.push({ kind: "signal-graph-issue", detail: signalIssue.detail });
  }

  return issues;
}

export function assertBlueprintIntegrity(blueprint: Blueprint): void {
  const issues = validateBlueprintIntegrity(blueprint);
  if (issues.length > 0) {
    throw new Error(`Blueprint integrity violated: ${JSON.stringify(issues)}`);
  }
}
