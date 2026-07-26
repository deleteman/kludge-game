import type { Footprint, GridPosition, Rotation } from "../geometry/grid-position.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import { occupiedCells } from "./workbench-state.types.js";
import { validateInstallation } from "./installation-validation.js";

/**
 * Rotación al instalar (GDD 10.1: "rotación del footprint permitida antes de
 * confirmar la colocación"). Decisión confirmada con el operador: solo afecta
 * el rectángulo EXTERIOR para el chequeo de encaje — las posiciones internas
 * de las piezas/nodos de la creación no se re-derivan aquí (la creación
 * instalada se trata como caja negra, GDD 10.1 párrafo 7); si hiciera falta
 * visualizar el interior rotado, es un problema de Fase 8.
 */
export function rotateExteriorFootprint(footprint: Footprint, rotation: Rotation): Footprint {
  return rotation === 90 || rotation === 270
    ? { width: footprint.height, height: footprint.width }
    : footprint;
}

/** Celdas absolutas que ocuparía un footprint anclado en `anchor` con la rotación dada. */
export function candidateCellsInSection(
  footprint: Footprint,
  anchor: GridPosition,
  rotation: Rotation,
): GridPosition[] {
  return occupiedCells({ position: anchor, footprint, rotation });
}

/** Distancia Chebyshev entre dos celdas (mueve en 8 direcciones a costo 1). */
function chebyshevDistance(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function isEarlier(a: GridPosition, b: GridPosition): boolean {
  return a.y !== b.y ? a.y < b.y : a.x < b.x;
}

/**
 * Busca dónde instalar un footprint más grande que la celda que el jugador
 * clickeó (ej. `motor-pequeno` 2×2 reemplazando una `valvula-simple` 1×1):
 * anclar el footprint exactamente en `anchorCell` puede no entrar (vecinos
 * fijos u otras piezas ya colocadas cerca), así que se recorre cada celda de
 * la sección como candidato de top-left, se descarta la que
 * `validateInstallation` rechace, y se devuelve la válida más cercana a
 * `anchorCell` (distancia Chebyshev entre `anchorCell` y la celda del
 * footprint más próxima a ella) — "lo más cerca posible de la pieza que se
 * está reemplazando". Empate se rompe por orden de `(y, x)` para que el
 * resultado sea determinístico; sin rotación (`rotation: 0`), coherente con
 * que `confirmInstall` tampoco la ofrece hoy. `undefined` si ninguna celda de
 * la sección aloja el footprint sin choques.
 */
export function findFittingInstallPlacement(
  section: FloorplanSection,
  existingPlacements: ReadonlyArray<PlacedComponentInstance>,
  footprint: Footprint,
  anchorCell: GridPosition,
): GridPosition | undefined {
  let best: { readonly position: GridPosition; readonly distance: number } | undefined;

  for (const candidate of section.cells) {
    const placement = { position: candidate, footprint, rotation: 0 as const };
    const issues = validateInstallation(section, existingPlacements, placement);
    if (issues.length > 0) {
      continue;
    }
    const distance = Math.min(...occupiedCells(placement).map((cell) => chebyshevDistance(cell, anchorCell)));
    if (!best || distance < best.distance || (distance === best.distance && isEarlier(candidate, best.position))) {
      best = { position: candidate, distance };
    }
  }

  return best?.position;
}
