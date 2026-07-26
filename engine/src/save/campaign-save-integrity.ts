import { validateBlueprintIntegrity } from "../blueprint/blueprint-integrity.js";
import { CREW_CAPACITY_BY_ARCHETYPE } from "../crew/crew-roster.js";
import type { CampaignSaveState } from "./campaign-save.types.js";

export interface CampaignSaveIntegrityIssue {
  readonly kind:
    | "duplicate-crew-id"
    | "dangling-active-crew-reference"
    | "active-crew-exceeds-capacity"
    | "blueprint-issue";
  readonly detail: string;
}

export function validateCampaignSaveIntegrity(
  state: CampaignSaveState,
): CampaignSaveIntegrityIssue[] {
  const issues: CampaignSaveIntegrityIssue[] = [];

  const seenCrewIds = new Set<string>();
  for (const actor of state.crew) {
    if (seenCrewIds.has(actor.id)) {
      issues.push({ kind: "duplicate-crew-id", detail: `Duplicate crew id: ${actor.id}` });
    }
    seenCrewIds.add(actor.id);
  }

  for (const activeId of state.activeCrewIds) {
    if (!seenCrewIds.has(activeId)) {
      issues.push({
        kind: "dangling-active-crew-reference",
        detail: `activeCrewIds references missing crew member: ${activeId}`,
      });
    }
  }

  const capacity = CREW_CAPACITY_BY_ARCHETYPE[state.metadata.archetype];
  if (state.activeCrewIds.length > capacity) {
    issues.push({
      kind: "active-crew-exceeds-capacity",
      detail: `${state.activeCrewIds.length} active crew exceed capacity ${capacity} for archetype ${state.metadata.archetype}`,
    });
  }

  for (const blueprintIssue of validateBlueprintIntegrity(state.shipState)) {
    issues.push({ kind: "blueprint-issue", detail: blueprintIssue.detail });
  }

  return issues;
}

export function assertCampaignSaveIntegrity(state: CampaignSaveState): void {
  const issues = validateCampaignSaveIntegrity(state);
  if (issues.length > 0) {
    throw new Error(`CampaignSaveState integrity violated: ${JSON.stringify(issues)}`);
  }
}
