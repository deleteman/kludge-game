import type { GridPosition } from "../geometry/grid-position.types.js";
import type { FloorplanSection, ShipFloorplan } from "./floorplan.types.js";

/**
 * Invariantes semánticos del plano físico (espejo de `blueprint-integrity.ts`):
 * la forma del JSON la valida el parser; aquí se valida que el grafo tenga
 * sentido — secciones sin solape, conductos entre secciones existentes y
 * físicamente adyacentes, anclajes dentro de su sección declarada.
 */
export interface FloorplanIntegrityIssue {
  readonly kind:
    | "overlapping-section-cells"
    | "conduit-unknown-section"
    | "conduit-self-reference"
    | "conduit-sections-not-adjacent"
    | "invalid-conduit-aperture"
    | "anchor-outside-section"
    | "duplicate-anchor-id"
    | "component-seed-outside-section"
    | "duplicate-component-seed-id"
    | "door-self-reference"
    | "door-unknown-section"
    | "door-sections-not-adjacent"
    | "door-outside-section"
    | "duplicate-door-id";
  readonly detail: string;
}

function cellKey(cell: GridPosition): string {
  return `${cell.x},${cell.y}`;
}

function cellSet(section: FloorplanSection): Set<string> {
  return new Set(section.cells.map(cellKey));
}

/** Adyacencia por arista: alguna celda de `a` toca ortogonalmente alguna de `b`. */
function areSectionsAdjacent(a: FloorplanSection, b: FloorplanSection): boolean {
  const cellsOfB = cellSet(b);
  for (const cell of a.cells) {
    if (
      cellsOfB.has(cellKey({ x: cell.x + 1, y: cell.y })) ||
      cellsOfB.has(cellKey({ x: cell.x - 1, y: cell.y })) ||
      cellsOfB.has(cellKey({ x: cell.x, y: cell.y + 1 })) ||
      cellsOfB.has(cellKey({ x: cell.x, y: cell.y - 1 }))
    ) {
      return true;
    }
  }
  return false;
}

export function validateFloorplanIntegrity(floorplan: ShipFloorplan): FloorplanIntegrityIssue[] {
  const issues: FloorplanIntegrityIssue[] = [];

  const sectionsById = new Map(floorplan.sections.map((section) => [section.id, section]));

  const occupiedCells = new Map<string, string>();
  for (const section of floorplan.sections) {
    for (const cell of section.cells) {
      const key = cellKey(cell);
      const occupant = occupiedCells.get(key);
      if (occupant !== undefined && occupant !== section.id) {
        issues.push({
          kind: "overlapping-section-cells",
          detail: `Cell (${cell.x}, ${cell.y}) belongs to both '${occupant}' and '${section.id}'`,
        });
      }
      occupiedCells.set(key, section.id);
    }
  }

  for (const conduit of floorplan.conduits) {
    if (conduit.a === conduit.b) {
      issues.push({
        kind: "conduit-self-reference",
        detail: `Conduit (${conduit.kind}) connects section '${conduit.a}' to itself`,
      });
      continue;
    }
    const a = sectionsById.get(conduit.a);
    const b = sectionsById.get(conduit.b);
    if (!a || !b) {
      issues.push({
        kind: "conduit-unknown-section",
        detail: `Conduit (${conduit.kind}) references missing section: ${!a ? conduit.a : conduit.b}`,
      });
      continue;
    }
    if (!areSectionsAdjacent(a, b)) {
      issues.push({
        kind: "conduit-sections-not-adjacent",
        detail: `Conduit (${conduit.kind}) connects '${conduit.a}' and '${conduit.b}', which share no edge`,
      });
    }
    if (conduit.initialAperture < 0 || conduit.initialAperture > 1) {
      issues.push({
        kind: "invalid-conduit-aperture",
        detail: `Conduit '${conduit.a}'↔'${conduit.b}' has aperture ${conduit.initialAperture}, outside [0, 1]`,
      });
    }
  }

  const seenAnchorIds = new Set<string>();
  for (const anchor of floorplan.anchors) {
    if (seenAnchorIds.has(anchor.id)) {
      issues.push({
        kind: "duplicate-anchor-id",
        detail: `Duplicate anchor id: ${anchor.id}`,
      });
    }
    seenAnchorIds.add(anchor.id);

    const section = sectionsById.get(anchor.sectionId);
    if (!section || !cellSet(section).has(cellKey(anchor.position))) {
      issues.push({
        kind: "anchor-outside-section",
        detail: `Anchor '${anchor.id}' at (${anchor.position.x}, ${anchor.position.y}) is not inside section '${anchor.sectionId}'`,
      });
    }
  }

  const seenComponentSeedIds = new Set<string>();
  for (const seed of floorplan.componentSeeds) {
    if (seenComponentSeedIds.has(seed.id)) {
      issues.push({
        kind: "duplicate-component-seed-id",
        detail: `Duplicate component seed id: ${seed.id}`,
      });
    }
    seenComponentSeedIds.add(seed.id);

    const section = sectionsById.get(seed.sectionId);
    if (!section || !cellSet(section).has(cellKey(seed.position))) {
      issues.push({
        kind: "component-seed-outside-section",
        detail: `Component seed '${seed.id}' at (${seed.position.x}, ${seed.position.y}) is not inside section '${seed.sectionId}'`,
      });
    }
  }

  // Puertas autoradas (Subfase 13h). Mismos invariantes que un conducto —une
  // dos secciones distintas, existentes y físicamente adyacentes— más uno
  // propio: la celda tiene que estar DENTRO de alguna sección, porque a
  // diferencia del marcador fraccional de un conducto, una puerta ocupa una
  // celda concreta y hay que poder preguntar si bloquea el paso.
  const seenDoorIds = new Set<string>();
  for (const door of floorplan.doors) {
    if (seenDoorIds.has(door.id)) {
      issues.push({ kind: "duplicate-door-id", detail: `Duplicate door id: ${door.id}` });
    }
    seenDoorIds.add(door.id);

    if (door.a === door.b) {
      issues.push({
        kind: "door-self-reference",
        detail: `Door '${door.id}' connects section '${door.a}' to itself`,
      });
      continue;
    }
    const a = sectionsById.get(door.a);
    const b = sectionsById.get(door.b);
    if (!a || !b) {
      issues.push({
        kind: "door-unknown-section",
        detail: `Door '${door.id}' references missing section: ${!a ? door.a : door.b}`,
      });
      continue;
    }
    if (!areSectionsAdjacent(a, b)) {
      issues.push({
        kind: "door-sections-not-adjacent",
        detail: `Door '${door.id}' connects '${door.a}' and '${door.b}', which share no edge`,
      });
    }
    if (!cellSet(a).has(cellKey(door.position)) && !cellSet(b).has(cellKey(door.position))) {
      issues.push({
        kind: "door-outside-section",
        detail: `Door '${door.id}' at (${door.position.x}, ${door.position.y}) is in neither '${door.a}' nor '${door.b}'`,
      });
    }
  }

  return issues;
}

export function assertFloorplanIntegrity(floorplan: ShipFloorplan): void {
  const issues = validateFloorplanIntegrity(floorplan);
  if (issues.length > 0) {
    throw new Error(`Floorplan integrity violated: ${JSON.stringify(issues)}`);
  }
}
