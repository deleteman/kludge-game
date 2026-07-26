import type Phaser from "phaser";
import type { ShipArchetype } from "engine";

import { TILESET_IMAGE_KEY, TILESET_NAME_IN_MAP } from "./tile-layer-registry.js";
import { RENDER_DEPTH } from "./render-depths.js";

/**
 * Crea las tile layers del arquetipo dado, si el mapa precargado
 * (`FloorplanScene.preload`, key = `ShipArchetype`) trae tileset/tile layers
 * pintadas en Tiled. Devuelve las capas creadas (para añadir al container del
 * llamador) o `[]` si el mapa todavía no tiene arte — en ese caso el
 * renderer sigue con el fallback de `Graphics` de Fase 5, no deja un hueco en
 * blanco (GDD §17: no todas las naves tienen tile layers todavía).
 *
 * Cada capa se ancla a su `RENDER_DEPTH` por NOMBRE (`render-depths.ts`), no
 * por orden de inserción — un nombre de capa de Tiled fuera de la tabla
 * conocida (`background`/`objects`/`walls`) cae en depth 0 con un aviso, en
 * vez de quedar en un orden silenciosamente incorrecto.
 */
export function createTileLayers(
  scene: Phaser.Scene,
  archetype: ShipArchetype,
): readonly Phaser.Tilemaps.TilemapLayer[] {
  if (!scene.cache.tilemap.exists(archetype)) return [];
  const map = scene.make.tilemap({ key: archetype });
  if (map.tilesets.length === 0) return []; // Mapa sin tileset embebido todavía (GDD §17).

  const tileset = map.addTilesetImage(TILESET_NAME_IN_MAP, TILESET_IMAGE_KEY);
  if (!tileset) {
    // El mapa SÍ trae un tileset (a diferencia del caso de arriba, esperado
    // mientras no haya arte) pero no coincide con TILESET_NAME_IN_MAP/
    // TILESET_IMAGE_KEY — señal real de desincronización, no un hueco normal.
    console.warn(
      `[tile-layers] "${archetype}" trae un tileset pero no matchea "${TILESET_NAME_IN_MAP}"/"${TILESET_IMAGE_KEY}" — revisar el nombre del tileset en Tiled.`,
    );
    return [];
  }

  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  for (const layerData of map.layers) {
    const layer = map.createLayer(layerData.name, tileset, 0, 0);
    if (!layer) continue;
    const depth = (RENDER_DEPTH as Record<string, number>)[layerData.name];
    if (depth === undefined) {
      console.warn(
        `[tile-layers] "${archetype}" trae una tile layer "${layerData.name}" sin depth conocido en RENDER_DEPTH — usando 0 (revisar render-depths.ts).`,
      );
    }
    layer.setDepth(depth ?? RENDER_DEPTH.background);
    layers.push(layer);
  }
  return layers;
}
