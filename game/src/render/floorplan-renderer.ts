import Phaser from "phaser";
import { GRID_CELL_SIZE_PX } from "engine";
import type { ConduitConnection, FloorplanSection, ShipFloorplan } from "engine";

import { t } from "../i18n/i18n.js";
import {
  ANCHOR_COLOR,
  CONDUIT_COLORS,
  GRID_LINE_COLOR,
  LABEL_COLOR,
  SEALED_VALVE_COLOR,
  SECTION_FILL_ALPHA,
  SECTION_FILL_COLORS,
  WALL_COLOR,
} from "./palette.js";

/**
 * Render estático del plano físico (Fase 5): todo con `Graphics`/`Text`
 * generados por código — no existe todavía ningún pack de pixel art (GDD
 * §17). Cuando lo haya, los tiles de suelo/pared reemplazarán los rellenos y
 * bordes; los marcadores de conducto/anclaje pasarán a iconos de
 * `game/assets/sprites/ui/`.
 */
const CELL = GRID_CELL_SIZE_PX;

export function renderFloorplan(
  scene: Phaser.Scene,
  floorplan: ShipFloorplan,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  container.add(graphics);

  drawGrid(graphics, floorplan);
  floorplan.sections.forEach((section, index) => {
    drawSectionFill(graphics, section, SECTION_FILL_COLORS[index % SECTION_FILL_COLORS.length]!);
  });
  for (const section of floorplan.sections) {
    drawSectionWalls(graphics, section);
  }
  drawAnchors(graphics, floorplan);
  for (const conduit of floorplan.conduits) {
    drawConduit(graphics, conduit);
  }
  for (const section of floorplan.sections) {
    container.add(sectionLabel(scene, section));
  }
  return container;
}

function drawGrid(graphics: Phaser.GameObjects.Graphics, floorplan: ShipFloorplan): void {
  graphics.lineStyle(1, GRID_LINE_COLOR, 1);
  for (let x = 0; x <= floorplan.gridSize.width; x += 1) {
    graphics.lineBetween(x * CELL, 0, x * CELL, floorplan.gridSize.height * CELL);
  }
  for (let y = 0; y <= floorplan.gridSize.height; y += 1) {
    graphics.lineBetween(0, y * CELL, floorplan.gridSize.width * CELL, y * CELL);
  }
}

function drawSectionFill(
  graphics: Phaser.GameObjects.Graphics,
  section: FloorplanSection,
  color: number,
): void {
  graphics.fillStyle(color, SECTION_FILL_ALPHA);
  for (const cell of section.cells) {
    graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
  }
}

/** Paredes implícitas: toda arista de celda que no da a otra celda de la MISMA sección. */
function drawSectionWalls(graphics: Phaser.GameObjects.Graphics, section: FloorplanSection): void {
  const cells = new Set(section.cells.map((cell) => `${cell.x},${cell.y}`));
  graphics.lineStyle(3, WALL_COLOR, 1);
  for (const cell of section.cells) {
    const px = cell.x * CELL;
    const py = cell.y * CELL;
    if (!cells.has(`${cell.x},${cell.y - 1}`)) graphics.lineBetween(px, py, px + CELL, py);
    if (!cells.has(`${cell.x},${cell.y + 1}`))
      graphics.lineBetween(px, py + CELL, px + CELL, py + CELL);
    if (!cells.has(`${cell.x - 1},${cell.y}`)) graphics.lineBetween(px, py, px, py + CELL);
    if (!cells.has(`${cell.x + 1},${cell.y}`))
      graphics.lineBetween(px + CELL, py, px + CELL, py + CELL);
  }
}

function drawAnchors(graphics: Phaser.GameObjects.Graphics, floorplan: ShipFloorplan): void {
  graphics.lineStyle(1, ANCHOR_COLOR, 1);
  for (const anchor of floorplan.anchors) {
    const size = 8;
    graphics.strokeRect(
      anchor.position.x * CELL + (CELL - size) / 2,
      anchor.position.y * CELL + (CELL - size) / 2,
      size,
      size,
    );
  }
}

function drawConduit(graphics: Phaser.GameObjects.Graphics, conduit: ConduitConnection): void {
  const px = conduit.position.x * CELL;
  const py = conduit.position.y * CELL;
  const sealed = conduit.kind === "ventilacion" && conduit.initialAperture === 0;

  graphics.fillStyle(CONDUIT_COLORS[conduit.kind], 1);
  graphics.fillCircle(px, py, 5);
  if (sealed) {
    // Válvula sellada ≠ válvula abierta a simple vista (principio 6 de CLAUDE.md).
    graphics.lineStyle(2, SEALED_VALVE_COLOR, 1);
    graphics.strokeCircle(px, py, 7);
    graphics.lineBetween(px - 5, py - 5, px + 5, py + 5);
    graphics.lineBetween(px - 5, py + 5, px + 5, py - 5);
  }
}

function sectionLabel(scene: Phaser.Scene, section: FloorplanSection): Phaser.GameObjects.Text {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of section.cells) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + 1);
    maxY = Math.max(maxY, cell.y + 1);
  }
  const centerX = ((minX + maxX) / 2) * CELL;
  const centerY = ((minY + maxY) / 2) * CELL;
  return scene.add
    .text(centerX, centerY, t(section.nameKey), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: LABEL_COLOR,
    })
    .setOrigin(0.5);
}
