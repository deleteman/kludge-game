import Phaser from "phaser";
import { CONDUIT_KINDS, GRID_CELL_SIZE_PX } from "engine";
import type {
  DoorRuntime,
  ConduitConnection,
  ConduitKind,
  FloorplanSection,
  GridPosition,
  SectionId,
  ShipFloorplan,
  ShipStatusIndicator,
} from "engine";

import { createTileLayers } from "./tile-layers.js";
import { RENDER_DEPTH } from "./render-depths.js";
import { computeConduitPaths, type ConduitPath } from "./conduit-path.js";
import type { WalkableGrid } from "./walkable-grid.js";
import {
  ANCHOR_COLOR,
  CONDUIT_COLORS,
  ENERGY_LAYER_ALPHA,
  ENERGY_LAYER_COLOR,
  GRID_LINE_COLOR,
  SEALED_VALVE_COLOR,
  SECTION_FILL_ALPHA,
  SECTION_FILL_COLORS,
  STRUCTURAL_LAYER_ALPHA,
  STRUCTURAL_LAYER_COLOR,
  WALL_COLOR,
  DOOR_STATE_COLOR,
  DOOR_LAYER_ALPHA,
  PRESSURE_LAYER_COLOR,
  PRESSURE_LAYER_ALPHA,
} from "./palette.js";

/**
 * Capas togglables del HUD del plano (Fase 11f, GDD §10): las 4 `ConduitKind`
 * reales + `"estructural"` (Fase 12a, tiñe cada sección según su peor RE
 * agregado, `drawStructuralLayer`) + `"energia"` (Fase 13b, heatmap de
 * demanda vs. suministro del presupuesto de energía, `drawEnergyLayer`).
 */
export type FloorplanLayerId = ConduitKind | "estructural" | "energia" | "puertas" | "presion";
export const FLOORPLAN_LAYER_IDS: readonly FloorplanLayerId[] = [
  ...CONDUIT_KINDS,
  "estructural",
  "energia",
  // Subfase 13h: estado de las puertas y heatmap de presión por sección.
  "puertas",
  "presion",
];

/**
 * Render del plano físico: tile layers reales (Fase 8, `tile-layers.ts`)
 * cuando el mapa del arquetipo ya las trae desde Tiled, con fallback a
 * `Graphics`/`Text` generados por código (Fase 5) para las naves que
 * todavía no tienen pack de arte pintado (GDD §17) — nunca un hueco en
 * blanco. Anclajes/conductos/etiquetas de sección son overlay informativo y
 * se dibujan siempre, tenga o no tile layers la nave.
 */
const CELL = GRID_CELL_SIZE_PX;

/**
 * Resultado del render del plano dividido en DOS objetos por profundidad
 * (post-playtest #7): `base` (suelo, objetos decorativos, anclajes, conductos,
 * etiquetas) por debajo de la tripulación/componentes colocados, y `walls`
 * (las paredes) por ENCIMA de ellos. Van separados porque un `Container` de
 * Phaser aplana la profundidad de sus hijos: si las paredes vivieran dentro
 * del container base (depth `background`), renderizarían siempre debajo de la
 * tripulación y los objetos, sin importar su `setDepth` individual. El
 * llamador registra AMBOS en la cámara de mundo.
 */
export interface FloorplanRender {
  readonly base: Phaser.GameObjects.Container;
  readonly walls?: Phaser.Tilemaps.TilemapLayer | Phaser.GameObjects.Graphics;
  /** Un `Graphics` dedicado por capa (Fase 11f) — permite `setAlpha()` independiente por `FloorplanLayerId` desde el toggle de HUD. `estructural` se crea pero nunca recibe dibujo (placeholder). */
  readonly conduitLayers: Readonly<Record<FloorplanLayerId, Phaser.GameObjects.Graphics>>;
  /** Rutas ya calculadas (Fase 11f) — expuestas para que la escena arranque el flujo animado sin recalcularlas. */
  readonly conduitPaths: readonly ConduitPath[];
}

export function renderFloorplan(
  scene: Phaser.Scene,
  floorplan: ShipFloorplan,
  walkableGrid?: WalkableGrid,
): FloorplanRender {
  const base = scene.add.container(0, 0).setDepth(RENDER_DEPTH.background);

  const tileLayers = createTileLayers(scene, floorplan.archetype);
  let walls: Phaser.Tilemaps.TilemapLayer | Phaser.GameObjects.Graphics | undefined;
  for (const layer of tileLayers) {
    if (layer.layer.name === "walls") {
      // Se queda top-level a `RENDER_DEPTH.walls` (ya fijado por
      // `createTileLayers`), NO dentro del container base — así las paredes
      // quedan por encima de la tripulación y los componentes colocados.
      walls = layer;
    } else {
      base.add(layer);
    }
  }

  // Fallback de Fase 5: dibuja suelo (grid + rellenos de sección) en un
  // Graphics del base; las paredes van a un Graphics APARTE, top-level a
  // `walls`, mismo criterio de profundidad que la tile layer real.
  const graphics = scene.add.graphics().setDepth(RENDER_DEPTH.background);
  base.add(graphics);

  if (tileLayers.length === 0) {
    drawGrid(graphics, floorplan);
    floorplan.sections.forEach((section, index) => {
      drawSectionFill(graphics, section, SECTION_FILL_COLORS[index % SECTION_FILL_COLORS.length]!);
    });
    const wallsGraphics = scene.add.graphics().setDepth(RENDER_DEPTH.walls);
    for (const section of floorplan.sections) {
      drawSectionWalls(wallsGraphics, section);
    }
    walls = wallsGraphics;
  }
  drawAnchors(graphics, floorplan);

  const conduitLayers = Object.fromEntries(
    FLOORPLAN_LAYER_IDS.map((layerId) => [layerId, scene.add.graphics().setDepth(RENDER_DEPTH.background)]),
  ) as Record<FloorplanLayerId, Phaser.GameObjects.Graphics>;
  for (const layerId of FLOORPLAN_LAYER_IDS) base.add(conduitLayers[layerId]);

  const conduitPaths = computeConduitPaths(floorplan, walkableGrid);
  for (const path of conduitPaths) {
    drawConduitLine(conduitLayers[path.conduit.kind], path);
    drawConduitMarker(conduitLayers[path.conduit.kind], path.conduit);
  }
  // `conduitLayers.estructural` arranca vacío: a diferencia de los conductos
  // (estáticos, se dibujan una sola vez acá), la integridad de casco cambia
  // en vivo — la escena la redibuja periódicamente vía `drawStructuralLayer`
  // (mismo criterio que `redrawUnpoweredSectionScar`).

  // Los nombres de sección ya no se dibujan fijos sobre el plano (playtest #14):
  // se muestran como tooltip al pasar el mouse (`FloorplanScene.updateTooltip`),
  // con prioridad del componente por debajo del cursor sobre el de la zona.
  return { base, walls, conduitLayers, conduitPaths };
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

/** Polilínea real del conducto entre sus dos secciones (Fase 11f) — reemplaza el punto suelto que había antes (Observación #1 de PENDIENTES_OBSERVACIONES.md). Exportada (13e ronda 8) para el clon top-level de la capa `fluido` durante el modo de trasvase. */
export function drawConduitLine(graphics: Phaser.GameObjects.Graphics, path: ConduitPath): void {
  if (path.waypoints.length < 2) return;
  // 4px opaco (antes 2px/0.8 alpha): a zoom "encajar toda la nave" (`minZoom`,
  // `floorplan-scene.ts`) un trazo más fino quedaba casi invisible frente al
  // ruido de la grilla de fondo — principio 6, el conducto debe leerse siempre.
  graphics.lineStyle(4, CONDUIT_COLORS[path.conduit.kind], 1);
  graphics.beginPath();
  // `waypoints` ya viene en PÍXELES (Fase 11f.2), con el marcador como vértice
  // exacto — se dibuja directo, sin re-escalar ni centrar.
  const [first, ...rest] = path.waypoints;
  graphics.moveTo(first!.x, first!.y);
  for (const point of rest) graphics.lineTo(point.x, point.y);
  graphics.strokePath();
}

/** Marcador puntual en `conduit.position` — sigue siendo información real (`initialAperture`), se conserva junto a la nueva polilínea. Exportada (13e ronda 8) — ver `drawConduitLine`. */
export function drawConduitMarker(graphics: Phaser.GameObjects.Graphics, conduit: ConduitConnection): void {
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

/**
 * Capa "estructural" del HUD del plano (Fase 12a): tiñe cada sección según su
 * peor RE agregado. `nominal` no dibuja nada — solo lo degradado necesita
 * remarcarse (principio 6: una sección sana no debe competir visualmente con
 * el resto del plano). Redibujado periódicamente por la escena
 * (`floorplan-scene.ts`, mismo criterio que `redrawUnpoweredSectionScar`),
 * no una sola vez en `renderFloorplan` — la integridad de casco cambia en
 * vivo (`MissionStructuralRuntime`), a diferencia de los conductos estáticos.
 */
export function drawStructuralLayer(
  graphics: Phaser.GameObjects.Graphics,
  floorplan: ShipFloorplan,
  indicatorForSection: (sectionId: SectionId) => ShipStatusIndicator,
): void {
  graphics.clear();
  for (const section of floorplan.sections) {
    const indicator = indicatorForSection(section.id);
    const color = STRUCTURAL_LAYER_COLOR[indicator.level];
    if (color === undefined) continue;
    graphics.fillStyle(color, STRUCTURAL_LAYER_ALPHA);
    for (const cell of section.cells) {
      graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
    }
  }
}

/**
 * Capa "energia" (Fase 13b): mismo patrón que `drawStructuralLayer` — función
 * pura, `clear()` + iterar secciones + `fillRect` por celda. `isDark`/`isDeficit`
 * son callbacks inyectados por el llamador (mismo desacople de datos que
 * `indicatorForSection`), en vez de que este módulo de render conozca
 * `MissionPowerRuntime`.
 */
export function drawEnergyLayer(
  graphics: Phaser.GameObjects.Graphics,
  floorplan: ShipFloorplan,
  isDark: (sectionId: SectionId) => boolean,
  isDeficit: (sectionId: SectionId) => boolean,
): void {
  graphics.clear();
  for (const section of floorplan.sections) {
    const color = isDark(section.id)
      ? ENERGY_LAYER_COLOR.dark
      : isDeficit(section.id)
        ? ENERGY_LAYER_COLOR.deficit
        : undefined;
    if (color === undefined) continue;
    graphics.fillStyle(color, ENERGY_LAYER_ALPHA);
    for (const cell of section.cells) {
      graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
    }
  }
}

/**
 * Capa "puertas" del HUD del plano (Subfase 13h): una barra por puerta,
 * coloreada por el estado de la hoja y orientada según el eje que bloquea.
 *
 * Se redibuja por tick como `drawStructuralLayer`/`drawEnergyLayer` y no una
 * sola vez en `renderFloorplan`: el estado de una puerta cambia varias veces
 * por minuto, a diferencia de los conductos, que son estáticos.
 *
 * Durante `opening`/`closing` la barra se ACORTA proporcionalmente al avance de
 * la transición: es lo que hace visible que la hoja tarda `ACT.cadence` en
 * moverse, en vez de que ese tiempo solo exista en la simulación.
 */
export function drawDoorLayer(
  graphics: Phaser.GameObjects.Graphics,
  doors: readonly DoorRuntime[],
  transitionSecondsOf: (door: DoorRuntime) => number,
  /**
   * Conductos de ventilación con la válvula CERRADA ahora mismo. Van en esta
   * capa y no junto a la línea estática del conducto porque la apertura dejó de
   * ser un dato del plano: el marcador de `drawConduitMarker` se dibuja una
   * sola vez desde `initialAperture` y se quedaría mostrando la apertura de
   * fábrica después de que el jugador mande a cerrar la válvula.
   */
  closedValves: readonly ConduitConnection[] = [],
): void {
  graphics.clear();
  for (const door of doors) {
    const color = doorLayerColor(door);
    // Una puerta abierta ocupa menos hoja que una cerrada: el ancho de la barra
    // ES la lectura de cuánto tapa.
    const openness = doorOpenness(door, transitionSecondsOf(door));
    graphics.fillStyle(color, DOOR_LAYER_ALPHA);
    for (const cell of door.cells) {
      const thickness = Math.max(2, CELL * 0.28 * (1 - openness));
      if (thickness <= 2 && openness > 0.95) {
        // Del todo abierta: solo los dos jambajes, para que el umbral siga
        // siendo legible como puerta y no desaparezca del plano.
        graphics.fillRect(cell.x * CELL, cell.y * CELL, 3, CELL);
        graphics.fillRect((cell.x + 1) * CELL - 3, cell.y * CELL, 3, CELL);
        continue;
      }
      graphics.fillRect(
        cell.x * CELL,
        cell.y * CELL + (CELL - thickness) / 2,
        CELL,
        thickness,
      );
    }
  }

  // Válvula cerrada: misma cruz que `drawConduitMarker` usa para la sellada de
  // fábrica — es el mismo hecho, así que se lee igual (principio 6 al revés:
  // dos fenómenos IGUALES no deben verse distinto).
  for (const conduit of closedValves) {
    const px = conduit.position.x * CELL;
    const py = conduit.position.y * CELL;
    graphics.lineStyle(2, DOOR_STATE_COLOR.closed, DOOR_LAYER_ALPHA);
    graphics.strokeCircle(px, py, 7);
    graphics.lineBetween(px - 5, py - 5, px + 5, py + 5);
    graphics.lineBetween(px - 5, py + 5, px + 5, py - 5);
  }
}

function doorLayerColor(door: DoorRuntime): number {
  if (door.state === "destroyed") return DOOR_STATE_COLOR.destroyed;
  if (door.overrideSource === "unpowered") return DOOR_STATE_COLOR.unpowered;
  if (door.state === "jammed") return DOOR_STATE_COLOR.jammed;
  return door.state === "open" ? DOOR_STATE_COLOR.open : DOOR_STATE_COLOR.closed;
}

/** 0 = hoja completamente cerrada, 1 = del todo abierta. Interpola en la transición. */
function doorOpenness(door: DoorRuntime, transitionSeconds: number): number {
  const progress =
    transitionSeconds > 0
      ? Math.max(0, Math.min(1, door.transitionElapsedSeconds / transitionSeconds))
      : 1;
  switch (door.state) {
    case "open":
    case "destroyed":
      return 1;
    case "closed":
    case "jammed":
      return 0;
    case "opening":
      return progress;
    case "closing":
      return 1 - progress;
  }
}

/**
 * Capa "presion" del HUD del plano (Subfase 13h): heatmap de presión por
 * sección. Molde exacto de `drawEnergyLayer` — una sala a presión nominal no
 * se dibuja (principio 6: lo nominal no compite visualmente).
 *
 * Existe porque hasta 13h la presión de una sala solo se leía en el tooltip, de
 * a una por vez: con la nave compartimentada, "qué sala se está vaciando" es
 * justo la pregunta que el jugador necesita responder de un vistazo.
 */
export function drawPressureLayer(
  graphics: Phaser.GameObjects.Graphics,
  floorplan: ShipFloorplan,
  pressureKpaOf: (sectionId: SectionId) => number | undefined,
): void {
  graphics.clear();
  for (const section of floorplan.sections) {
    const pressure = pressureKpaOf(section.id);
    if (pressure === undefined || pressure >= PRESSURE_LAYER_NOMINAL_KPA) continue;
    const color =
      pressure <= PRESSURE_LAYER_VACUUM_KPA ? PRESSURE_LAYER_COLOR.vacuum : PRESSURE_LAYER_COLOR.low;
    // El alpha escala con lo lejos que está de lo nominal: una sala que acaba de
    // empezar a perder se distingue de una ya casi vacía.
    const severity = 1 - pressure / PRESSURE_LAYER_NOMINAL_KPA;
    graphics.fillStyle(color, PRESSURE_LAYER_ALPHA * Math.max(0.35, severity));
    for (const cell of section.cells) {
      graphics.fillRect(cell.x * CELL, cell.y * CELL, CELL, CELL);
    }
  }
}

/** Presión (kPa) a partir de la cual una sala se considera nominal y no se pinta. */
const PRESSURE_LAYER_NOMINAL_KPA = 95;
/** Por debajo de esto la sala se lee como vacío letal, no como "perdiendo presión". */
const PRESSURE_LAYER_VACUUM_KPA = 30;

/** Centro en celdas del bounding box de una sección (Fase 11b: posición de partículas state-driven por sección). */
export function sectionCentroidCell(section: FloorplanSection): GridPosition {
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
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** Centro en píxeles del bounding box de una sección — reutilizado por `FloorplanScene` (Fase 10d) para posicionar tokens de tripulación. */
export function sectionCentroidPx(section: FloorplanSection): { x: number; y: number } {
  const { x, y } = sectionCentroidCell(section);
  return { x: x * CELL, y: y * CELL };
}
