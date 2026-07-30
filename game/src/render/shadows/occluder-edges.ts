import type Phaser from "phaser";
import type { Footprint, ShipArchetype } from "engine";

import type { Segment, Vec2 } from "./visibility-polygon.js";

/**
 * Construcción de los segmentos oclusores que bloquean la luz (Fase 12d).
 * Separa lo PURO (armar aristas a partir de una grilla booleana o de rects —
 * unit-testeable sin Phaser, ver `occluder-edges.test.ts`) de la extracción de
 * la grilla desde el tilemap (`extractOccluderGrid`, que sí toca Phaser, mismo
 * patrón type-only que `walkable-grid.ts`).
 *
 * Oclusor estático = celda con pared (`walls`) u objeto autorado (`objects`).
 * A diferencia de la grilla transitable (que ignora `objects` para no cerrar
 * pasos de pathing), acá `objects` SÍ cuenta: el operador pidió que los objetos
 * de Tiled proyecten sombra.
 */

/** Grilla booleana de oclusión: `isOccluder(x,y)` = esa celda bloquea la luz. */
export interface OccluderGrid {
  readonly width: number;
  readonly height: number;
  isOccluder(x: number, y: number): boolean;
}

/**
 * Convierte la grilla de oclusión en la silueta de segmentos expuestos: cada
 * borde entre una celda oclusora y una celda abierta (o el exterior). Los
 * tramos colineales contiguos se fusionan en un solo segmento para no inundar
 * el raycasting con miles de aristas unitarias.
 */
export function buildStaticOccluderEdges(grid: OccluderGrid, cellSize: number): Segment[] {
  const { width, height } = grid;
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && grid.isOccluder(x, y);

  const edges: Segment[] = [];

  // Aristas horizontales: en cada línea de celda `yline`, un tramo está
  // expuesto cuando la celda de arriba y la de abajo difieren en oclusión.
  for (let yline = 0; yline <= height; yline += 1) {
    let runStart: number | null = null;
    for (let x = 0; x <= width; x += 1) {
      const exposed = x < width && solid(x, yline - 1) !== solid(x, yline);
      if (exposed && runStart === null) runStart = x;
      if (!exposed && runStart !== null) {
        edges.push(horizontalSegment(runStart, x, yline, cellSize));
        runStart = null;
      }
    }
  }

  // Aristas verticales: en cada línea `xline`, expuesto cuando izquierda y
  // derecha difieren.
  for (let xline = 0; xline <= width; xline += 1) {
    let runStart: number | null = null;
    for (let y = 0; y <= height; y += 1) {
      const exposed = y < height && solid(xline - 1, y) !== solid(xline, y);
      if (exposed && runStart === null) runStart = y;
      if (!exposed && runStart !== null) {
        edges.push(verticalSegment(xline, runStart, y, cellSize));
        runStart = null;
      }
    }
  }

  return edges;
}

function horizontalSegment(xStart: number, xEnd: number, yline: number, cellSize: number): Segment {
  return { a: { x: xStart * cellSize, y: yline * cellSize }, b: { x: xEnd * cellSize, y: yline * cellSize } };
}

function verticalSegment(xline: number, yStart: number, yEnd: number, cellSize: number): Segment {
  return { a: { x: xline * cellSize, y: yStart * cellSize }, b: { x: xline * cellSize, y: yEnd * cellSize } };
}

/** Las 4 aristas de un rectángulo en píxeles (caster dinámico: componente, token). */
export function rectEdges(minX: number, minY: number, maxX: number, maxY: number): Segment[] {
  const tl: Vec2 = { x: minX, y: minY };
  const tr: Vec2 = { x: maxX, y: minY };
  const br: Vec2 = { x: maxX, y: maxY };
  const bl: Vec2 = { x: minX, y: maxY };
  return [
    { a: tl, b: tr },
    { a: tr, b: br },
    { a: br, b: bl },
    { a: bl, b: tl },
  ];
}

/** Marco del mundo, para que ningún polígono de visibilidad quede abierto. */
export function worldBorderEdges(worldWidth: number, worldHeight: number): Segment[] {
  return rectEdges(0, 0, worldWidth, worldHeight);
}

/**
 * Extrae la grilla de oclusión del arquetipo leyendo sus tile layers ya
 * parseadas por Phaser (`walls` ∪ `objects`). Mismo patrón de disponibilidad y
 * de tilemap efímero que `extractWalkableGrid`. Devuelve `undefined` si el
 * arquetipo todavía no tiene arte (naves sin tiles) — el llamador cae a "sin
 * sombras estáticas".
 */
export function extractOccluderGrid(
  scene: Phaser.Scene,
  archetype: ShipArchetype,
  gridSize: Footprint,
): OccluderGrid | undefined {
  if (!scene.cache.tilemap.exists(archetype)) return undefined;
  const map = scene.make.tilemap({ key: archetype });
  if (map.tilesets.length === 0) {
    map.destroy();
    return undefined;
  }

  const walls = map.getLayer("walls");
  const objects = map.getLayer("objects");
  if (!walls && !objects) {
    map.destroy();
    return undefined;
  }

  const hasTile = (layer: Phaser.Tilemaps.LayerData | null, x: number, y: number): boolean => {
    const tile = layer?.data[y]?.[x];
    return tile !== undefined && tile !== null && tile.index !== -1;
  };

  const { width, height } = gridSize;
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const occluder = hasTile(walls ?? null, x, y) || hasTile(objects ?? null, x, y);
      cells[y * width + x] = occluder ? 1 : 0;
    }
  }

  map.destroy();

  return {
    width,
    height,
    isOccluder(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return cells[y * width + x] === 1;
    },
  };
}
