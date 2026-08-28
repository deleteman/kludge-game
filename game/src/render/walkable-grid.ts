import type Phaser from "phaser";
import type { Footprint, ShipArchetype } from "engine";

/**
 * Grilla booleana de transitabilidad para el pathfinding de tripulación
 * (Fase 10d, ajuste post-playtest #4): `walkable[y][x]` indica si un
 * tripulante puede pisar esa celda. Se deriva de las tile layers reales de
 * Tiled (`background` = piso, `walls` = pared) — puramente visual, el motor
 * no la conoce (el `go-to` sigue siendo una duración abstracta, ver
 * `task-parameters.ts`).
 */
export interface WalkableGrid {
  readonly width: number;
  readonly height: number;
  isWalkable(x: number, y: number): boolean;
}

/**
 * Extrae la grilla transitable del arquetipo dado leyendo sus tile layers ya
 * parseadas por Phaser (mismo criterio de disponibilidad que
 * `createTileLayers`). Una celda es transitable si tiene piso
 * (`background` con tile) y NO tiene pared (`walls` sin tile). `objects` es
 * decorativo y no bloquea (decisión de diseño: el mapa de Tiled no fue
 * pintado pensando en pathing, tratar `objects` como obstáculo podría cerrar
 * pasos no intencionalmente).
 *
 * Devuelve `undefined` si el arquetipo todavía no tiene tile layers pintadas
 * (naves sin arte, GDD §17) — señal explícita de "sin datos", para que el
 * llamador caiga al salto directo en línea recta.
 */
export function extractWalkableGrid(
  scene: Phaser.Scene,
  archetype: ShipArchetype,
  gridSize: Footprint,
): WalkableGrid | undefined {
  if (!scene.cache.tilemap.exists(archetype)) return undefined;
  const map = scene.make.tilemap({ key: archetype });
  if (map.tilesets.length === 0) {
    map.destroy();
    return undefined;
  }

  // `getLayer` lee los datos de celda (`LayerData.data[y][x].index`, -1 =
  // vacío) sin crear TilemapLayers visibles — esas las crea `tile-layers.ts`
  // aparte. El tilemap efímero solo se usa para extraer la grilla y se
  // descarta enseguida.
  const background = map.getLayer("background");
  const walls = map.getLayer("walls");
  if (!background) {
    // Sin capa de piso no hay forma de saber qué es interior de la nave.
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
      const walkable = hasTile(background, x, y) && !hasTile(walls, x, y);
      cells[y * width + x] = walkable ? 1 : 0;
    }
  }

  map.destroy();

  return {
    width,
    height,
    isWalkable(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return cells[y * width + x] === 1;
    },
  };
}

/**
 * Decora una grilla con el estado VIVO de las puertas (Subfase 13h).
 *
 * Decora en vez de copiar a propósito: `extractWalkableGrid` produce un
 * `Uint8Array` congelado en el momento de la carga, y una puerta cambia de
 * estado varias veces por minuto. Copiar la grilla en cada cambio exigiría un
 * punto de invalidación que hoy no existe; consultar el estado vivo en cada
 * llamada no exige ninguno.
 *
 * El resultado se le pasa al pathfinding Y al `CellBlockedQuery` de línea de
 * visión y proyectiles, de modo que los tres lean la MISMA fuente: si no, un
 * proyectil atravesaría una puerta cerrada que un tripulante no puede cruzar.
 */
export function withDoorState(
  grid: WalkableGrid,
  isDoorBlocked: (x: number, y: number) => boolean,
): WalkableGrid {
  return {
    width: grid.width,
    height: grid.height,
    isWalkable: (x, y) => grid.isWalkable(x, y) && !isDoorBlocked(x, y),
  };
}
