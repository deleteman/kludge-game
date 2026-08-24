import type { Segment, Vec2 } from "./visibility-polygon.js";
import { raySegmentIntersection } from "./visibility-polygon.js";

/**
 * Nivel de luz por celda (Fase 12d, cierre — Obs 16). Módulo de geometría PURA,
 * sin Phaser: responde "¿cuánta luz llega a esta celda?" con la MISMA oclusión
 * que `DynamicShadowLayer` ya dibuja en su `RenderTexture`.
 *
 * Existe porque la RT de sombras oscurece solo el SUELO (vive por debajo de
 * `objects`/`crewEntity`/`walls`, criterio de sombra top-down): los sprites que
 * proyectan la sombra quedaban a brillo plano constante, "pegados encima" del
 * mapa. Esta grilla es la fuente del tinte que los oscurece —
 * `light-shading.ts` la convierte en color, `floorplan-scene.ts` la aplica.
 *
 * CRÍTICO — una sola geometría: la visibilidad de una celda se resuelve con el
 * mismo `raySegmentIntersection` y el mismo juego de aristas que
 * `computeVisibilityPolygon`. Dos cálculos de oclusión en paralelo terminarían
 * en un sprite brillante parado dentro de una sombra dibujada.
 */

/**
 * Piso de aclarado de una luz: una luz tenue igual despeja algo de oscuridad.
 * Espejo exacto del `Math.max(0.3, …)` de `DynamicShadowLayer.redraw` — vive
 * acá (módulo puro) y lo importa el glue de Phaser, no al revés.
 */
export const LIGHT_CLEAR_ALPHA_FLOOR = 0.3;

/**
 * Fracción del radio a partir de la cual la contribución empieza a caer. Dentro
 * de ese núcleo la luz aporta pleno, igual que el `erase` de la RT (que es
 * uniforme dentro del polígono); el desvanecido del borde es solo para que un
 * sprite no salte de golpe a brillo pleno al cruzar el radio.
 */
const FALLOFF_START = 0.6;

/** Luz activa, en píxeles de mundo. Forma mínima de una `Phaser.GameObjects.PointLight`. */
export interface LightSample {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly intensity: number;
}

export interface LightLevelGridInput {
  readonly lights: readonly LightSample[];
  /** Oclusores (paredes ∪ objetos Tiled ∪ casters móviles), los mismos de la capa de sombras. */
  readonly edges: readonly Segment[];
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly cellSize: number;
  /**
   * Brillo donde no llega ninguna luz (0..1). Debe ser
   * `1 - darknessAlpha` de la capa de sombras, para que un sprite en penumbra
   * se lea igual de oscuro que el suelo que pisa.
   */
  readonly ambient: number;
}

export interface LightLevelGrid {
  readonly width: number;
  readonly height: number;
  /** Nivel 0..1 de la celda. Fuera de la grilla devuelve el ambiente. */
  levelAt(cellX: number, cellY: number): number;
  /** Igual que `levelAt`, tomando coordenadas de MUNDO en píxeles. */
  levelAtPixel(px: number, py: number): number;
}

/**
 * Calcula el nivel de luz de cada celda. Coste acotado por dos recortes: cada
 * luz solo visita las celdas de su bounding box de radio, y solo prueba las
 * aristas que cruzan esa misma caja (sin ese filtro, una nave con cientos de
 * aristas haría un raycast completo por celda y por luz).
 */
export function computeLightLevelGrid(input: LightLevelGridInput): LightLevelGrid {
  const { lights, edges, gridWidth, gridHeight, cellSize } = input;
  const ambient = clamp01(input.ambient);

  // Mejor aporte de CUALQUIER luz sobre cada celda. Se acumula con `max` y no
  // con suma: dos focos solapados iluminan mejor que uno, no al doble — sumar
  // saturaba a blanco cualquier sala con dos plafones.
  const best = new Float32Array(gridWidth * gridHeight);

  for (const light of lights) {
    if (light.radius <= 0 || light.intensity <= 0) continue;
    const nearbyEdges = edgesNear(edges, light);
    const clearAlpha = Math.min(1, Math.max(LIGHT_CLEAR_ALPHA_FLOOR, light.intensity));

    const minCellX = Math.max(0, Math.floor((light.x - light.radius) / cellSize));
    const maxCellX = Math.min(gridWidth - 1, Math.floor((light.x + light.radius) / cellSize));
    const minCellY = Math.max(0, Math.floor((light.y - light.radius) / cellSize));
    const maxCellY = Math.min(gridHeight - 1, Math.floor((light.y + light.radius) / cellSize));

    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      for (let cx = minCellX; cx <= maxCellX; cx += 1) {
        const target = { x: (cx + 0.5) * cellSize, y: (cy + 0.5) * cellSize };
        const distance = Math.hypot(target.x - light.x, target.y - light.y);
        if (distance > light.radius) continue;
        if (isOccluded(light, target, distance, nearbyEdges)) continue;

        const contribution = clearAlpha * falloff(distance / light.radius);
        const index = cy * gridWidth + cx;
        if (contribution > best[index]!) best[index] = contribution;
      }
    }
  }

  return {
    width: gridWidth,
    height: gridHeight,
    levelAt(cellX: number, cellY: number): number {
      if (cellX < 0 || cellY < 0 || cellX >= gridWidth || cellY >= gridHeight) return ambient;
      // El ambiente es el PISO y la luz cubre lo que queda hasta 1: así una
      // celda a pleno foco vale exactamente 1 (sin tinte) sea cual sea el
      // ambiente, y ninguna combinación se pasa de rango.
      return ambient + (1 - ambient) * best[cellY * gridWidth + cellX]!;
    },
    levelAtPixel(px: number, py: number): number {
      return this.levelAt(Math.floor(px / cellSize), Math.floor(py / cellSize));
    },
  };
}

/** ¿Alguna arista corta el trayecto luz → punto antes de llegar? */
function isOccluded(light: Vec2, target: Vec2, distance: number, edges: readonly Segment[]): boolean {
  if (distance < 1e-6) return false;
  const dir = { x: (target.x - light.x) / distance, y: (target.y - light.y) / distance };
  for (const edge of edges) {
    const hit = raySegmentIntersection(light, dir, edge.a, edge.b);
    // El ε evita que la propia arista sobre la que se apoya la celda (una pieza
    // ocupa su celda y la ocluye) se cuente como oclusor de sí misma.
    if (hit !== null && hit < distance - 1e-6) return true;
  }
  return false;
}

/** Aristas cuya bounding box toca la caja de radio de la luz. Recorte barato previo al raycast. */
function edgesNear(edges: readonly Segment[], light: LightSample): Segment[] {
  const left = light.x - light.radius;
  const right = light.x + light.radius;
  const top = light.y - light.radius;
  const bottom = light.y + light.radius;
  return edges.filter(
    (edge) =>
      Math.max(edge.a.x, edge.b.x) >= left &&
      Math.min(edge.a.x, edge.b.x) <= right &&
      Math.max(edge.a.y, edge.b.y) >= top &&
      Math.min(edge.a.y, edge.b.y) <= bottom,
  );
}

/** 1 en el núcleo, desvanecido suave hasta 0 en el radio. */
function falloff(t: number): number {
  if (t <= FALLOFF_START) return 1;
  if (t >= 1) return 0;
  const k = (t - FALLOFF_START) / (1 - FALLOFF_START);
  return 1 - k * k;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
