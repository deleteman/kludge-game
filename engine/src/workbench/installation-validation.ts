import type { GridPosition, PlacedFootprint } from "../geometry/grid-position.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import { occupiedCells } from "./workbench-state.types.js";

/**
 * Validación de "instalar en el plano" (GDD 10.1 párrafo 5): el footprint
 * calculado debe caber sin solaparse con paredes u otros componentes — si no
 * cabe, se rechaza. Mismo criterio de solape por celda que
 * `floorplan/floorplan-integrity.ts` (`overlapping-section-cells`), aplicado
 * a instalación en RUNTIME (contra el `Blueprint` de la partida) en vez de a
 * la validez estática del plano.
 */
export interface InstallationIssue {
  readonly kind: "footprint-outside-section-shape" | "overlaps-existing-component";
  readonly detail: string;
}

function cellKey(cell: GridPosition): string {
  return `${cell.x},${cell.y}`;
}

export function validateInstallation(
  section: FloorplanSection,
  existingPlacements: ReadonlyArray<PlacedComponentInstance>,
  proposedPlacement: PlacedFootprint,
): InstallationIssue[] {
  const issues: InstallationIssue[] = [];
  const proposedCells = occupiedCells(proposedPlacement);

  const sectionCells = new Set(section.cells.map(cellKey));
  const outsideCells = proposedCells.filter((cell) => !sectionCells.has(cellKey(cell)));
  if (outsideCells.length > 0) {
    issues.push({
      kind: "footprint-outside-section-shape",
      detail: `Footprint at (${proposedPlacement.position.x}, ${proposedPlacement.position.y}) has ${outsideCells.length} cell(s) outside section '${section.id}' (not just its bounding box — the section may be an L-shape)`,
    });
  }

  const occupiedByInstance = new Map<string, PlacedComponentInstance>();
  for (const existing of existingPlacements) {
    for (const cell of occupiedCells(existing.placement)) {
      occupiedByInstance.set(cellKey(cell), existing);
    }
  }

  const conflictingInstanceIds = new Set<string>();
  for (const cell of proposedCells) {
    const occupant = occupiedByInstance.get(cellKey(cell));
    if (occupant && !conflictingInstanceIds.has(occupant.instanceId)) {
      conflictingInstanceIds.add(occupant.instanceId);
      issues.push({
        kind: "overlaps-existing-component",
        detail: `Footprint at (${proposedPlacement.position.x}, ${proposedPlacement.position.y}) overlaps existing component instance '${occupant.instanceId}'`,
      });
    }
  }

  return issues;
}
