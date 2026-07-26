import Phaser from "phaser";
import { GRID_CELL_SIZE_PX, findOverlappingPieces, occupiedCells } from "engine";
import type { WorkbenchPieceId, WorkbenchState } from "engine";

import { RENDER_DEPTH } from "./render-depths.js";
import { componentTextureKey, hasComponentSprite } from "./component-sprite-registry.js";
import {
  GRID_LINE_COLOR,
  LABEL_COLOR,
  SECTION_FILL_COLORS,
  SIGNAL_NODE_COLORS,
  WALL_COLOR,
} from "./palette.js";

/**
 * Render de la mesa de creación (GDD 10.1, Fase 9.5 punto 8) — hermano de
 * `floorplan-renderer.ts`: mismo grid/celda (`GRID_CELL_SIZE_PX`), pero sobre
 * `WorkbenchState` en vez de `ShipFloorplan`. Reutiliza `occupiedCells`/
 * `findOverlappingPieces` ya exportados por el motor en vez de reimplementar
 * geometría de footprint rotado. El solape se pinta en rojo — mismo criterio
 * visual que "instalar en el plano" (GDD 10.1).
 */
const CELL = GRID_CELL_SIZE_PX;
const OVERLAP_COLOR = 0xe0483f;

export interface WorkbenchGridSize {
  readonly width: number;
  readonly height: number;
}

export function renderWorkbench(
  scene: Phaser.Scene,
  workbench: WorkbenchState,
  grid: WorkbenchGridSize,
  nameByComponentId: ReadonlyMap<string, string>,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(RENDER_DEPTH.background);
  // Dos capas de gráficos: `graphics` (grid + relleno placeholder, debajo de los
  // sprites) y `topGraphics` (contornos, nodos y cables, ENCIMA de los sprites)
  // para que instalar el sprite de una pieza no tape sus nodos de señal — que el
  // jugador necesita ver para cablear (11c.2, cierre del pendiente #7).
  const graphics = scene.add.graphics();
  const topGraphics = scene.add.graphics().setDepth(RENDER_DEPTH.crewEntity);
  container.add(graphics);
  container.add(topGraphics);

  drawGrid(graphics, grid);

  const overlapping = new Set(
    findOverlappingPieces(workbench.pieces).flatMap(([a, b]) => [a, b] as WorkbenchPieceId[]),
  );

  workbench.pieces.forEach((piece, index) => {
    const overlaps = overlapping.has(piece.id);
    const px = piece.placement.position.x * CELL;
    const py = piece.placement.position.y * CELL;
    const w = occupiedCellsWidth(piece.placement);
    const h = occupiedCellsHeight(piece.placement);

    // Sprite real de la pieza si existe en el pack; si no, el rectángulo de
    // color de siempre (placeholder por código, convención de CLAUDE.md).
    if (hasComponentSprite(scene, piece.componentDefinitionId)) {
      const image = scene.add
        .image(px, py, componentTextureKey(piece.componentDefinitionId))
        .setOrigin(0, 0)
        .setDisplaySize(w * CELL, h * CELL)
        .setDepth(RENDER_DEPTH.objects);
      if (overlaps) image.setTint(OVERLAP_COLOR);
      container.add(image);
    } else {
      const color = overlaps ? OVERLAP_COLOR : SECTION_FILL_COLORS[index % SECTION_FILL_COLORS.length]!;
      graphics.fillStyle(color, overlaps ? 0.75 : 0.55);
      for (const cell of occupiedCells(piece.placement)) {
        graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
      }
    }

    topGraphics.lineStyle(2, overlaps ? OVERLAP_COLOR : WALL_COLOR, 1);
    topGraphics.strokeRect(px, py, w * CELL, h * CELL);

    const label = nameByComponentId.get(piece.componentDefinitionId) ?? piece.componentDefinitionId;
    container.add(
      scene.add
        .text(px + 4, py + 4, label, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: LABEL_COLOR,
        })
        .setDepth(RENDER_DEPTH.objects),
    );
  });

  const nodeById = new Map(workbench.signalGraph.nodes.map((node) => [node.id, node]));
  topGraphics.lineStyle(2, 0xd8dce8, 0.8);
  for (const edge of workbench.signalGraph.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    topGraphics.lineBetween(
      from.position.x * CELL,
      from.position.y * CELL,
      to.position.x * CELL,
      to.position.y * CELL,
    );
  }

  for (const node of workbench.signalGraph.nodes) {
    topGraphics.fillStyle(SIGNAL_NODE_COLORS[node.role], 1);
    topGraphics.fillCircle(node.position.x * CELL, node.position.y * CELL, 5);
  }

  return container;
}

function drawGrid(graphics: Phaser.GameObjects.Graphics, grid: WorkbenchGridSize): void {
  graphics.lineStyle(1, GRID_LINE_COLOR, 1);
  for (let x = 0; x <= grid.width; x += 1) {
    graphics.lineBetween(x * CELL, 0, x * CELL, grid.height * CELL);
  }
  for (let y = 0; y <= grid.height; y += 1) {
    graphics.lineBetween(0, y * CELL, grid.width * CELL, y * CELL);
  }
}

function occupiedCellsWidth(placement: WorkbenchState["pieces"][number]["placement"]): number {
  return placement.rotation === 90 || placement.rotation === 270
    ? placement.footprint.height
    : placement.footprint.width;
}

function occupiedCellsHeight(placement: WorkbenchState["pieces"][number]["placement"]): number {
  return placement.rotation === 90 || placement.rotation === 270
    ? placement.footprint.width
    : placement.footprint.height;
}
