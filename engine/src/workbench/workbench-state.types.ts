import type { Brand } from "../shared/brand.types.js";
import type { GridPosition, PlacedFootprint } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";

/**
 * Grid de la mesa de creación (GDD 10.1) — misma unidad que el plano principal
 * (`geometry/grid-position.types.ts`), pero un espacio de trabajo aparte: las
 * piezas colocadas aquí todavía no son un `Blueprint`, y el `ownerRef` de sus
 * nodos de señal es local a la mesa (`WorkbenchPieceId`), no
 * `PlacedComponentInstanceId` (eso último solo existe tras instalar, ver
 * `installation.ts`/`port-wiring.ts`).
 */
export class WorkbenchError extends Error {}

export type WorkbenchPieceId = Brand<string, "WorkbenchPieceId">;

/**
 * Una pieza colocada en el grid de la mesa: atómica o compuesta INTACTA (GDD
 * 10.1 — "piezas atómicas o compuestos intactos"). Desarmar es la tarea
 * `dismantle` (Fase 6), previa y separada; una pieza nunca se desarma dentro
 * de la mesa.
 */
export interface WorkbenchPiece {
  readonly id: WorkbenchPieceId;
  /** Referencia al catálogo de definiciones (Fase 4) — no se embebe la definición completa. */
  readonly componentDefinitionId: ComponentId;
  readonly placement: PlacedFootprint;
}

export interface WorkbenchState {
  readonly pieces: ReadonlyArray<WorkbenchPiece>;
  readonly signalGraph: SignalGraph<WorkbenchPieceId>;
}

export function createEmptyWorkbenchState(): WorkbenchState {
  return { pieces: [], signalGraph: { nodes: [], edges: [] } };
}

function cellKey(cell: GridPosition): string {
  return `${cell.x},${cell.y}`;
}

/** Extensión efectiva de un footprint colocado: 90/270 intercambian ancho y alto. */
export function effectiveFootprintExtent(placement: PlacedFootprint): {
  readonly width: number;
  readonly height: number;
} {
  const { width, height } = placement.footprint;
  return placement.rotation === 90 || placement.rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

/** Celdas absolutas ocupadas por una pieza colocada, considerando su rotación. */
export function occupiedCells(placement: PlacedFootprint): GridPosition[] {
  const { width, height } = effectiveFootprintExtent(placement);
  const cells: GridPosition[] = [];
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      cells.push({ x: placement.position.x + dx, y: placement.position.y + dy });
    }
  }
  return cells;
}

/**
 * Solape de celdas entre piezas de la mesa. Mismo criterio que
 * `floorplan/floorplan-integrity.ts` (`overlapping-section-cells`) aplicado a
 * `PlacedFootprint` en vez de a secciones del plano.
 */
export function findOverlappingPieces(
  pieces: ReadonlyArray<WorkbenchPiece>,
): ReadonlyArray<readonly [WorkbenchPieceId, WorkbenchPieceId]> {
  const overlaps: Array<readonly [WorkbenchPieceId, WorkbenchPieceId]> = [];
  const occupiedBy = new Map<string, WorkbenchPieceId>();

  for (const piece of pieces) {
    for (const cell of occupiedCells(piece.placement)) {
      const key = cellKey(cell);
      const occupant = occupiedBy.get(key);
      if (occupant !== undefined && occupant !== piece.id) {
        overlaps.push([occupant, piece.id]);
      } else {
        occupiedBy.set(key, piece.id);
      }
    }
  }

  return overlaps;
}

export function addPiece(state: WorkbenchState, piece: WorkbenchPiece): WorkbenchState {
  if (state.pieces.some((existing) => existing.id === piece.id)) {
    throw new WorkbenchError(`Duplicate workbench piece id: ${piece.id}`);
  }
  const nextPieces = [...state.pieces, piece];
  const overlaps = findOverlappingPieces(nextPieces);
  if (overlaps.length > 0) {
    throw new WorkbenchError(
      `Piece ${piece.id} overlaps existing piece(s): ${overlaps.map(([a, b]) => `${a}<->${b}`).join(", ")}`,
    );
  }
  return { ...state, pieces: nextPieces };
}

/**
 * Quita una pieza de la mesa y limpia todo lo que la referenciaba: sus nodos de
 * señal (`ownerRef === pieceId`) y los edges colgantes de esos nodos — mismo
 * criterio que `ship-task-effect.ts::dismantleInstance` para el `Blueprint`.
 * Sin esto, el `signalGraph` de la mesa quedaría con referencias colgantes.
 * Quitar una pieza inexistente es un no-op (idempotente).
 */
export function removePiece(state: WorkbenchState, pieceId: WorkbenchPieceId): WorkbenchState {
  const removedNodeIds = new Set(
    state.signalGraph.nodes.filter((node) => node.ownerRef === pieceId).map((node) => node.id),
  );
  return {
    pieces: state.pieces.filter((piece) => piece.id !== pieceId),
    signalGraph: {
      nodes: state.signalGraph.nodes.filter((node) => node.ownerRef !== pieceId),
      edges: state.signalGraph.edges.filter(
        (edge) => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to),
      ),
    },
  };
}
