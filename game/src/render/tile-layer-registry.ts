import type { ShipArchetype } from "engine";

import naveInvestigacionMapUrl from "engine-maps/nave-investigacion.json?url";
import naveGuerraMapUrl from "engine-maps/nave-guerra.json?url";
import naveExploracionMapUrl from "engine-maps/nave-exploracion.json?url";
import naveMedicaMapUrl from "engine-maps/nave-medica.json?url";

/**
 * URL del JSON crudo de Tiled por arquetipo (Fase 8): se le pasa tal cual a
 * `scene.load.tilemapTiledJSON` para que Phaser lo parsee con su propio
 * lector de tilemaps — independiente del parser lógico de `/engine`
 * (`floorplan-parser.ts`, que solo lee object layers). No todos los mapas
 * tienen tile layers pintadas todavía (GDD §17, pendiente por nave); el
 * renderer detecta en runtime si un mapa concreto trae tileset/tile layers y
 * si no, sigue con el fallback de `Graphics` de Fase 5 — no falla ni deja un
 * hueco en blanco.
 */
export const SHIP_MAP_URLS: Readonly<Record<ShipArchetype, string>> = {
  investigacion: naveInvestigacionMapUrl,
  guerra: naveGuerraMapUrl,
  exploracion: naveExploracionMapUrl,
  medica: naveMedicaMapUrl,
};

/** Nombre del tileset embebido dentro del JSON de Tiled (ver "name" del tileset en Tiled Map Editor). */
export const TILESET_NAME_IN_MAP = "interior";

/** Key de Phaser para la imagen del tileset, precargada una sola vez en `FloorplanScene.preload()`. */
export const TILESET_IMAGE_KEY = "tileset-nave";
