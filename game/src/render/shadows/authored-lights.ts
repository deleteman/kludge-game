import type Phaser from "phaser";
import type { ShipArchetype } from "engine";

/**
 * Luces focales autoradas en Tiled (Fase 12d, iteración post-playtest). El
 * operador coloca focos por sección (1-2 por pared) en una capa de OBJETOS
 * llamada `luces`; cada objeto es un Point donde va el foco, con propiedades
 * opcionales `color`/`radius`/`intensity`. Se cargan en `/game` como
 * `PointLight` reales (iluminan Y proyectan sombras), reemplazando la ambiental
 * global de 12d.3 que lavaba el contraste.
 *
 * Concern puramente de render: `/engine` NO conoce luces (se mantiene sin capa
 * visual). Se lee del tilemap ya parseado por Phaser, mismo patrón que
 * `extractOccluderGrid` / `extractWalkableGrid`.
 */

export const AUTHORED_LIGHTS_LAYER = "luces";

/** Default cálido de plafón industrial cuando el objeto no fija `color`. */
export const AUTHORED_LIGHT_DEFAULT_COLOR = 0xffd9a0;
export const AUTHORED_LIGHT_DEFAULT_RADIUS_PX = 140;
export const AUTHORED_LIGHT_DEFAULT_INTENSITY = 0.7;

export interface AuthoredLightSpec {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly radius: number;
  readonly intensity: number;
}

/** Forma mínima de un objeto de Tiled que nos interesa (agnóstica de Phaser). */
export interface TiledObjectLike {
  readonly x: number;
  readonly y: number;
  readonly properties?: ReadonlyArray<{ readonly name: string; readonly value: unknown }>;
}

/**
 * Convierte un objeto Tiled en un spec de luz, aplicando defaults. PURO
 * (unit-testeable): `color` acepta hex string (`#ffd9a0` o `0xffd9a0`) o número.
 */
export function toAuthoredLightSpec(object: TiledObjectLike): AuthoredLightSpec {
  const props = new Map((object.properties ?? []).map((p) => [p.name, p.value]));
  return {
    x: object.x,
    y: object.y,
    color: parseColor(props.get("color")) ?? AUTHORED_LIGHT_DEFAULT_COLOR,
    radius: numberOr(props.get("radius"), AUTHORED_LIGHT_DEFAULT_RADIUS_PX),
    intensity: numberOr(props.get("intensity"), AUTHORED_LIGHT_DEFAULT_INTENSITY),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** `"#ffd9a0"` / `"0xffd9a0"` / `"ffd9a0"` / número → 0xRRGGBB, o undefined. */
function parseColor(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const hex = value.trim().replace(/^#/, "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return Number.parseInt(hex, 16);
}

/**
 * Lee la capa de objetos `luces` del arquetipo dado y devuelve los specs de
 * luz. `[]` si el arquetipo no tiene tiles todavía o no autoró la capa —
 * señal explícita de "sin luces focales" (las salas quedarán oscuras hasta que
 * el operador las autore).
 */
export function loadAuthoredLights(scene: Phaser.Scene, archetype: ShipArchetype): AuthoredLightSpec[] {
  if (!scene.cache.tilemap.exists(archetype)) return [];
  const map = scene.make.tilemap({ key: archetype });
  const layer = map.getObjectLayer(AUTHORED_LIGHTS_LAYER);
  const specs = (layer?.objects ?? []).map((object) =>
    toAuthoredLightSpec(object as unknown as TiledObjectLike),
  );
  map.destroy();
  return specs;
}
