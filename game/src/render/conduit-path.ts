import { GRID_CELL_SIZE_PX } from "engine";
import type { ConduitConnection, ConduitKind, FloorplanSection, GridPosition, SectionId, ShipFloorplan } from "engine";
import { findConduitRoute, sectionContainingCell } from "engine";

import { findPath } from "../crew/floorplan-pathfinding.js";
import type { WalkableGrid } from "./walkable-grid.js";

const CELL = GRID_CELL_SIZE_PX;

/**
 * Punto en PÍXELES (no celdas). El ruteo de conductos/cables trabaja en
 * píxeles, no en celdas, porque el vértice clave — el marcador del conducto,
 * `conduit.position` — es un punto FRACCIONAL sobre la pared entre dos
 * secciones (autorado en Tiled). Redondearlo a celda desfasaba la línea del
 * marcador y hacía que el cruce se resolviera por la puerta transitable más
 * cercana en vez de por el conducto. En píxeles, el marcador es un vértice
 * exacto de la polilínea (Fase 11f.2).
 */
export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Polilínea (en píxeles) que traza un conducto entre el centro de sus dos
 * secciones, PASANDO por el píxel exacto del marcador (`conduit.position`).
 * El cruce de pared se arma con celdas de aproximación transitables a cada
 * lado del conducto — `findPath` nunca recibe el punto de pared, así que no
 * se desvía por otra puerta. Cómputo ESTÁTICO por misión.
 */
export interface ConduitPath {
  readonly conduit: ConduitConnection;
  /** ≥2 puntos en píxeles, ya simplificados a tramos rectos. */
  readonly waypoints: readonly PixelPoint[];
}

export function computeConduitPaths(
  floorplan: ShipFloorplan,
  walkableGrid: WalkableGrid | undefined,
): readonly ConduitPath[] {
  const sectionById = new Map(floorplan.sections.map((section) => [section.id, section]));
  const paths: ConduitPath[] = [];
  for (const conduit of floorplan.conduits) {
    const sectionA = sectionById.get(conduit.a);
    const sectionB = sectionById.get(conduit.b);
    if (!sectionA || !sectionB) continue;
    const from = roundCell(centroidCell(sectionA));
    const to = roundCell(centroidCell(sectionB));
    const waypoints = buildRoutedPath(floorplan, walkableGrid, from, to, [conduit], sectionA.id);
    paths.push({ conduit, waypoints });
  }
  return paths;
}

/**
 * Ruta (píxeles) que un flujo de conducto de tipo `kind` debe seguir entre dos
 * celdas (Fase 11f, generalizada en la ronda 8 de playtest de 13e para el modo
 * de trasvase): si cruza de una sección a otra, pasa por los pasamuros de los
 * conductos `kind` que las conectan (`findConduitRoute`, el MISMO grafo que la
 * restricción de `assertSignalWiringReachable` para `"senal"`). Intra-sección
 * (o sección indeterminable) va directo. Sin ruta de conductos cae a recta.
 */
export function computeConduitRoute(
  floorplan: ShipFloorplan,
  walkableGrid: WalkableGrid | undefined,
  from: GridPosition,
  to: GridPosition,
  kind: ConduitKind,
): readonly PixelPoint[] {
  const sectionA = sectionContainingCell(floorplan, from);
  const sectionB = sectionContainingCell(floorplan, to);
  if (!sectionA || !sectionB || sectionA.id === sectionB.id) {
    return buildRoutedPath(floorplan, walkableGrid, roundCell(from), roundCell(to), [], undefined);
  }
  const conduits = findConduitRoute(floorplan, kind, sectionA.id, sectionB.id);
  if (!conduits || conduits.length === 0) {
    return buildRoutedPath(floorplan, walkableGrid, roundCell(from), roundCell(to), [], undefined);
  }
  return buildRoutedPath(floorplan, walkableGrid, roundCell(from), roundCell(to), conduits, sectionA.id);
}

/** Wrapper de compatibilidad para cableado de señal — ver `computeConduitRoute`. */
export function computeSignalWireRoute(
  floorplan: ShipFloorplan,
  walkableGrid: WalkableGrid | undefined,
  from: GridPosition,
  to: GridPosition,
): readonly PixelPoint[] {
  return computeConduitRoute(floorplan, walkableGrid, from, to, "senal");
}

/**
 * Arma la polilínea en píxeles de `startCell` a `endCell` cruzando la secuencia
 * ordenada de `conduits` (posiblemente vacía = misma sección). Cada cruce
 * inserta el píxel exacto del conducto entre las celdas de aproximación
 * transitables de cada lado; los tramos dentro de una sección los resuelve
 * `findPath` entre celdas transitables. `startSectionId` es la sección donde
 * arranca la ruta (para orientar `a`/`b` de cada conducto); irrelevante si no
 * hay conductos.
 */
function buildRoutedPath(
  floorplan: ShipFloorplan,
  walkableGrid: WalkableGrid | undefined,
  startCell: GridPosition,
  endCell: GridPosition,
  conduits: readonly ConduitConnection[],
  startSectionId: SectionId | undefined,
): readonly PixelPoint[] {
  const sectionById = new Map(floorplan.sections.map((section) => [section.id, section]));
  const points: PixelPoint[] = [];
  let legStart = startCell;
  let currentSectionId = startSectionId;

  for (const conduit of conduits) {
    const exitSectionId = conduit.a === currentSectionId ? conduit.b : conduit.a;
    const entrySection = currentSectionId ? sectionById.get(currentSectionId) : undefined;
    const exitSection = sectionById.get(exitSectionId);
    const approachEntry = entrySection ? nearestSectionCell(entrySection, conduit.position) : legStart;
    // Tramo transitable dentro de la sección de entrada, hasta el borde del conducto.
    appendCellLeg(points, walkableGrid, legStart, approachEntry);
    // Cruce por el píxel exacto del marcador (vértice duro, no redondeado).
    pushPoint(points, conduitPx(conduit));
    // Del otro lado de la pared, seguimos desde la celda de aproximación de la sección de salida.
    legStart = exitSection ? nearestSectionCell(exitSection, conduit.position) : legStart;
    currentSectionId = exitSectionId;
  }

  appendCellLeg(points, walkableGrid, legStart, endCell);
  return points;
}

/** Agrega el tramo transitable `from`→`to` (celdas → centros en píxel), simplificado a tramos rectos, sin duplicar el vértice de unión. */
function appendCellLeg(
  points: PixelPoint[],
  walkableGrid: WalkableGrid | undefined,
  from: GridPosition,
  to: GridPosition,
): void {
  const cells = simplifyCollinear(resolveLeg(walkableGrid, from, to));
  for (const cell of cells) pushPoint(points, cellCenterPx(cell));
}

/** Evita vértices consecutivos duplicados (la unión entre tramos comparte punto). */
function pushPoint(points: PixelPoint[], point: PixelPoint): void {
  const last = points[points.length - 1];
  if (last && last.x === point.x && last.y === point.y) return;
  points.push(point);
}

function resolveLeg(
  walkableGrid: WalkableGrid | undefined,
  from: GridPosition,
  to: GridPosition,
): readonly GridPosition[] {
  if (walkableGrid) {
    const path = findPath(walkableGrid, from, to);
    if (path && path.length >= 2) return path;
  }
  return [from, to];
}

/**
 * Celdas que ATRAVIESA una ruta de cable, muestreando su polilínea (Subfase
 * 14a-4).
 *
 * La cicatriz de un cable quemado tiene que repartirse por todo el recorrido,
 * no apilarse en un punto: es la misma corrección que la ronda 1 de playtest de
 * 14a-2 aplicó a los efectos de atmósfera, donde un fenómeno de sala se pintaba
 * como una chispa en el centroide. Un cable es todavía más largo que una sala,
 * así que el problema sería peor.
 *
 * Muestrea a media celda para no saltarse ninguna en las diagonales, y
 * deduplica: el emisor reparte por celdas, no por longitud, y una celda repetida
 * chispearía el doble.
 */
export function signalWireCells(route: ReadonlyArray<PixelPoint>): ReadonlyArray<GridPosition> {
  const seen = new Set<string>();
  const cells: GridPosition[] = [];
  const push = (px: number, py: number) => {
    const cell = { x: Math.floor(px / CELL), y: Math.floor(py / CELL) };
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push(cell);
  };

  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i]!;
    const b = route[i + 1]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
  }
  // Ruta de un solo punto (los dos nodos en la misma celda): sigue teniendo
  // celda, y sin esto el efecto se quedaría sin ninguna.
  if (cells.length === 0 && route.length > 0) {
    push(route[0]!.x, route[0]!.y);
  }
  return cells;
}

/** Centro en píxeles de una celda transitable — misma convención con la que se dibujan nodos y tokens. */
function cellCenterPx(cell: GridPosition): PixelPoint {
  return { x: (cell.x + 0.5) * CELL, y: (cell.y + 0.5) * CELL };
}

/** Píxel exacto del marcador del conducto — idéntico a `drawConduitMarker` (`floorplan-renderer.ts`), para que la línea llegue justo al punto. */
function conduitPx(conduit: ConduitConnection): PixelPoint {
  return { x: conduit.position.x * CELL, y: conduit.position.y * CELL };
}

/** Celda de la sección más cercana a `target` (celda de aproximación transitable a un lado del conducto). */
function nearestSectionCell(section: FloorplanSection, target: GridPosition): GridPosition {
  let best = section.cells[0]!;
  let bestDist = Infinity;
  for (const cell of section.cells) {
    const dx = cell.x + 0.5 - target.x;
    const dy = cell.y + 0.5 - target.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = cell;
    }
  }
  return best;
}

/**
 * Centro geométrico de una sección, en celdas (puede ser fraccional). Exportada
 * en la ronda 2 de playtest de 13h: `doorSlideAxis` necesita el mismo criterio
 * de "dónde está esta sección" que ya usan los conductos para trazar su ruta —
 * dos definiciones distintas darían un eje de deslizamiento que no coincide con
 * por dónde se dibuja el paso.
 */
export function centroidCell(section: FloorplanSection): GridPosition {
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

/** El bounding box puede centrar en mitad de celda; `findPath`/`WalkableGrid` operan en celdas enteras. */
function roundCell(position: GridPosition): GridPosition {
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

/**
 * Colapsa celdas intermedias colineales consecutivas: `findPath` devuelve una
 * celda por paso de BFS, y cada waypoint termina siendo un emisor de partículas
 * — sin simplificar, un pasillo recto largo generaría un emisor por celda.
 */
function simplifyCollinear(points: readonly GridPosition[]): readonly GridPosition[] {
  if (points.length <= 2) return points;
  const result: GridPosition[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const dir2 = { x: next.x - curr.x, y: next.y - curr.y };
    if (dir1.x === dir2.x && dir1.y === dir2.y) continue;
    result.push(curr);
  }
  result.push(points[points.length - 1]!);
  return result;
}

/**
 * Celdas del CUERPO de un cable: las que atraviesa, **menos las de sus dos
 * extremos** (14a-4, ronda 3 de playtest).
 *
 * Por qué existe. Todo lo que dibuja un cable quemado —la cicatriz persistente,
 * el fogonazo del corte, la estática local— se apoyaba en `signalWireCells`, que
 * muestrea `step = 0` y `step = steps` y por lo tanto incluye las celdas de los
 * dos extremos: exactamente donde están las piezas que el cable une. El operador
 * quemó el tronco `fotorreceptor → chip` y reportó que **el chip empezó a
 * brillar como si estuviera roto**. No lo estaba: el motor atribuye el corte a
 * la ARISTA (en `overloadedRefs` entra el id de la arista, no el de la pieza) y
 * el chip no tenía tinte, glifo ni estado. Era la cicatriz correcta pintada
 * sobre el sujeto equivocado.
 *
 * `signalWireCells` se queda como está y sigue siendo la de siempre para el
 * índice celda→cable del tooltip: ahí excluir extremos abriría huecos muertos, y
 * el solape con una pieza ya lo resuelve la precedencia de `tooltipContentAt`
 * (gana la pieza, que es el objeto que el jugador cree estar señalando).
 *
 * **Cable corto** (los dos extremos adyacentes, sin cuerpo): se cae a la celda
 * del punto medio de la polilínea. Nunca devuelve vacío mientras haya ruta —
 * mismo criterio que el caso de un solo punto que `signalWireCells` ya
 * contemplaba: un cable sin cicatriz sería un corte invisible.
 */
export function signalWireBodyCells(route: ReadonlyArray<PixelPoint>): ReadonlyArray<GridPosition> {
  const all = signalWireCells(route);
  if (all.length > 2) {
    return all.slice(1, -1);
  }
  const midpoint = polylineMidpoint(route);
  return midpoint ? [{ x: Math.floor(midpoint.x / CELL), y: Math.floor(midpoint.y / CELL) }] : [];
}

/**
 * Punto medio de una polilínea POR LONGITUD (no el vértice del medio), o
 * `undefined` si la ruta está vacía. Es dónde se ancla el fogonazo y la estática
 * de un corte: la ronda 1 los anclaba en `signalWireCells(...)[0]`, o sea en la
 * celda del emisor, así que el corte parecía ocurrir dentro del sensor.
 */
export function polylineMidpoint(route: ReadonlyArray<PixelPoint>): PixelPoint | undefined {
  if (route.length === 0) return undefined;
  if (route.length === 1) return route[0];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const length = Math.hypot(route[i + 1]!.x - route[i]!.x, route[i + 1]!.y - route[i]!.y);
    lengths.push(length);
    total += length;
  }
  let remaining = total / 2;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i]!;
    if (remaining <= length || i === lengths.length - 1) {
      const t = length === 0 ? 0 : remaining / length;
      const a = route[i]!;
      const b = route[i + 1]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return route[route.length - 1];
}

/**
 * Parte una polilínea en los segmentos "encendidos" de un trazo entrecortado
 * (14a-4, ronda 3 de playtest).
 *
 * Un cable quemado se dibujaba a 1 px en un gris oscuro al 70% de alfa, debajo
 * de la luz ámbar de su propia cicatriz: el operador lo describió como que **el
 * cable desapareció**. "Invisible" se lee como "no está", y sin recorrido
 * visible el jugador no puede ir a retirarlo — que es la única salida de la
 * cicatriz. Entrecortado y al mismo grosor que uno sano se lee ROTO, que es
 * distinto de ausente.
 *
 * Recorre la polilínea acumulando distancia, así que los guiones **siguen las
 * esquinas** en vez de cortar en recto sobre ellas. Es la razón de que sea una
 * función aparte y con test: es aritmética de recorrido, no pixeles.
 */
export function dashedPolyline(
  route: ReadonlyArray<PixelPoint>,
  dashPx: number,
  gapPx: number,
): ReadonlyArray<readonly [PixelPoint, PixelPoint]> {
  const segments: Array<readonly [PixelPoint, PixelPoint]> = [];
  if (route.length < 2 || dashPx <= 0 || gapPx <= 0) return segments;

  // Posición dentro del patrón guion+hueco, conservada de un tramo al siguiente
  // para que una esquina no reinicie el dibujo (dos guiones pegados en cada
  // vértice se leerían como un engrosamiento, no como un patrón).
  let cursor = 0;
  const period = dashPx + gapPx;

  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i]!;
    const b = route[i + 1]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const at = (distance: number): PixelPoint => ({
      x: a.x + ((b.x - a.x) * distance) / length,
      y: a.y + ((b.y - a.y) * distance) / length,
    });

    let travelled = 0;
    while (travelled < length) {
      const phase = cursor % period;
      const remainingInPhase = phase < dashPx ? dashPx - phase : period - phase;
      const step = Math.min(remainingInPhase, length - travelled);
      if (phase < dashPx) {
        segments.push([at(travelled), at(travelled + step)]);
      }
      travelled += step;
      cursor += step;
    }
  }
  return segments;
}

/**
 * Celdas cercanas contra las que un cable quemado puede descargar un arco
 * (14a-4, ronda 3 de playtest): paredes y celdas ocupadas por una pieza.
 *
 * Reemplaza a la luz de la cicatriz, que el operador pidió sacar porque "oculta
 * todo lo demás" — un glow de 64 px anclado en un punto sobre una pieza. El arco
 * dice lo mismo (esto está eléctricamente roto) pero es **direccional**: se ve
 * nacer en el cable, así que atribuye el fallo al cable en vez de teñir lo que
 * tenga debajo.
 *
 * Pura y con test propio porque su modo de fallo es INVISIBLE: si devolviera
 * siempre vacío, el efecto simplemente no aparecería nunca y nadie lo notaría
 * hasta un playtest; si devolviera celdas vacías, el arco saldría al aire.
 *
 * Devolver una lista y no un blanco elegido deja el azar afuera, que es lo que
 * la hace testeable.
 */
export function arcTargetsNear(
  origin: GridPosition,
  radiusCells: number,
  walkableGrid: WalkableGrid | undefined,
  occupiedCells: ReadonlySet<string>,
): ReadonlyArray<GridPosition> {
  const targets: GridPosition[] = [];
  for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
    for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
      if (dx === 0 && dy === 0) continue;
      const cell = { x: origin.x + dx, y: origin.y + dy };
      if (Math.hypot(dx, dy) > radiusCells) continue;
      const isWall = walkableGrid
        ? cell.x >= 0 &&
          cell.y >= 0 &&
          cell.x < walkableGrid.width &&
          cell.y < walkableGrid.height &&
          !walkableGrid.isWalkable(cell.x, cell.y)
        : false;
      if (isWall || occupiedCells.has(`${cell.x},${cell.y}`)) {
        targets.push(cell);
      }
    }
  }
  return targets;
}
