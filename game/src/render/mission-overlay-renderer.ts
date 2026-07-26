import Phaser from "phaser";
import { effectiveFootprintExtent, GRID_CELL_SIZE_PX, occupiedCells } from "engine";
import type { Blueprint, GridPosition, ShipFloorplan } from "engine";

import { RENDER_DEPTH } from "./render-depths.js";
import { componentTextureKey, hasComponentSprite } from "./component-sprite-registry.js";
import { computeSignalWireRoute } from "./conduit-path.js";
import type { WalkableGrid } from "./walkable-grid.js";
import {
  COMPONENT_CONDITION_TINT,
  CONDUIT_COLORS,
  SECTION_FILL_COLORS,
  SIGNAL_NODE_COLORS,
  WALL_COLOR,
} from "./palette.js";

/** Resultado del overlay de misión: `container` con todo, y `signalGraphics` (nodos + cables) aparte para poder atenuarlo con la capa `señales` del HUD (Fase 11f.3). */
export interface MissionOverlayRender {
  readonly container: Phaser.GameObjects.Container;
  readonly signalGraphics: Phaser.GameObjects.Graphics;
}

const CELL = GRID_CELL_SIZE_PX;

/**
 * Capa dinámica ESTÁTICA de una misión en curso (Fase 10d): componentes
 * colocados (teñidos por `condition`) y grafo de señales real del
 * `Blueprint` — todo lo que `floorplan-renderer.ts` (puramente estático,
 * Fase 5/8) no conoce. Hermano de `workbench-renderer.ts`: mismo grid/celda,
 * mismo criterio de solape, pero sobre el `Blueprint` vivo de la partida en
 * vez de la mesa de creación.
 *
 * Los tokens de tripulación NO viven acá: necesitan identidad de objeto
 * persistente entre redibujados para poder animar el salto (`hop-movement.ts`,
 * Fase 8) al completarse un `go-to` — los gestiona `FloorplanScene`
 * directamente. Esta capa sí se destruye/reconstruye por completo en cada
 * cambio (mismo patrón `redraw()` que el resto del proyecto), porque no
 * necesita animarse: cambia solo en eventos discretos (tarea completada).
 */
export function renderMissionOverlay(
  scene: Phaser.Scene,
  blueprint: Blueprint,
  // Fase 11f: con el plano + grilla, un cable de señal que cruza secciones se
  // dibuja RUTEADO por los conductos `senal` (mismo `findConduitRoute` que la
  // regla que lo habilita), no en línea recta. Sin ellos (llamador que no los
  // pasa), cae a la recta de siempre.
  floorplan?: ShipFloorplan,
  walkableGrid?: WalkableGrid,
): MissionOverlayRender {
  const container = scene.add.container(0, 0).setDepth(RENDER_DEPTH.objects);
  const graphics = scene.add.graphics();
  container.add(graphics);

  blueprint.placedComponents.forEach((instance, index) => {
    const tint = COMPONENT_CONDITION_TINT[instance.condition];
    const { width, height } = effectiveFootprintExtent(instance.placement);
    const originX = instance.placement.position.x * CELL;
    const originY = instance.placement.position.y * CELL;

    // Sprite real si existe (tinte por `condition`, principio 6 de CLAUDE.md);
    // si no, el rectángulo de color placeholder de siempre.
    if (hasComponentSprite(scene, instance.componentDefinitionId)) {
      const sprite = scene.add
        .image(originX, originY, componentTextureKey(instance.componentDefinitionId))
        .setOrigin(0, 0)
        .setDisplaySize(width * CELL, height * CELL)
        .setDepth(RENDER_DEPTH.objects);
      if (tint !== undefined) sprite.setTint(tint);
      container.add(sprite);
    } else {
      const color = tint ?? SECTION_FILL_COLORS[index % SECTION_FILL_COLORS.length]!;
      graphics.fillStyle(color, 0.85);
      for (const cell of occupiedCells(instance.placement)) {
        graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
      }
    }

    graphics.lineStyle(2, tint ?? WALL_COLOR, 1);
    graphics.strokeRect(originX, originY, width * CELL, height * CELL);
    // El nombre del componente ya no se dibuja fijo sobre la pieza (playtest #14):
    // se muestra como tooltip al pasar el mouse (`FloorplanScene.updateTooltip`).
  });

  // El grafo de señal (nodos + cables) va en su PROPIO `Graphics` (Fase 11f.3):
  // es el contenido de la capa `señales` del HUD, así que la escena lo atenúa
  // junto con `conduitLayers.senal` al desactivar esa capa — sin tocar los
  // componentes físicos, que quedan en `graphics` (siempre visibles).
  const signalGraphics = scene.add.graphics();
  container.add(signalGraphics);

  // Nodos y aristas se dibujan en el CENTRO de la celda (`+ CELL/2`), no en la
  // esquina, para que el punto quede sobre el sprite del componente y el cable
  // conecte de centro a centro (playtest #15). El hit-test del cableado usa la
  // celda (`Math.floor(worldPoint/CELL)`), así que centrar es solo visual.
  const center = (n: number): number => n * CELL + CELL / 2;
  const nodeById = new Map(blueprint.signalGraph.nodes.map((node) => [node.id, node]));
  // Cable en el color de la capa `senal` (Fase 11f.3) — unifica cable/conducto/capa.
  signalGraphics.lineStyle(2, CONDUIT_COLORS.senal, 0.85);
  for (const edge of blueprint.signalGraph.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    drawSignalEdge(signalGraphics, from.position, to.position, floorplan, walkableGrid);
  }
  for (const node of blueprint.signalGraph.nodes) {
    signalGraphics.fillStyle(SIGNAL_NODE_COLORS[node.role], 1);
    signalGraphics.fillCircle(center(node.position.x), center(node.position.y), 7);
  }

  return { container, signalGraphics };
}

/** Dibuja un cable de señal ruteado por conductos (Fase 11f) — recta si no hay plano/grilla o si es intra-sección. */
function drawSignalEdge(
  graphics: Phaser.GameObjects.Graphics,
  from: GridPosition,
  to: GridPosition,
  floorplan: ShipFloorplan | undefined,
  walkableGrid: WalkableGrid | undefined,
): void {
  const center = (n: number): number => n * CELL + CELL / 2;
  if (!floorplan) {
    graphics.lineBetween(center(from.x), center(from.y), center(to.x), center(to.y));
    return;
  }
  // `computeSignalWireRoute` devuelve PÍXELES (Fase 11f.2), con el marcador del
  // conducto como vértice exacto — se dibuja directo, sin re-centrar.
  const route = computeSignalWireRoute(floorplan, walkableGrid, from, to);
  if (route.length < 2) {
    graphics.lineBetween(center(from.x), center(from.y), center(to.x), center(to.y));
    return;
  }
  graphics.beginPath();
  graphics.moveTo(route[0]!.x, route[0]!.y);
  for (const point of route.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.strokePath();
}
