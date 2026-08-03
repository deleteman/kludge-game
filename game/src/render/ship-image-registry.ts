import type Phaser from "phaser";
import type { ShipArchetype } from "engine";

/**
 * Registro de imágenes exteriores de nave por arquetipo (Fase 12g, tarjeta de
 * selección de arquetipo). Mismo patrón que `crew-portrait-registry.ts`: un
 * PNG por arquetipo en `game/assets/sprites/ships/<archetype>.png`,
 * descubierto vía `import.meta.glob` solo si existe en build time. Carpeta
 * creada vacía en esta fase (ningún sprite todavía) — `hasShipImage` da
 * siempre false y el llamador cae a su placeholder de color, por convención de
 * CLAUDE.md (nunca placeholder silencioso: la escena debe avisar la ruta
 * esperada).
 */
const shipImageModules = import.meta.glob("../../assets/sprites/ships/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** `archetype → url`, derivado del basename del archivo (sin `.png`). */
export const SHIP_IMAGE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(shipImageModules).map(([path, url]) => [basename(path), url]),
);

/** Key de textura de Phaser namespaced, para no chocar con tiles/componentes/UI/crew. */
export function shipImageTextureKey(archetype: ShipArchetype): string {
  return `ship:${archetype}`;
}

/** Precarga las imágenes de nave que existan (no-op si la carpeta está vacía). */
export function preloadShipImages(scene: Phaser.Scene): void {
  for (const [archetype, url] of Object.entries(SHIP_IMAGE_URLS)) {
    scene.load.image(shipImageTextureKey(archetype as ShipArchetype), url);
  }
}

/** ¿Existe una imagen cargada para este arquetipo? Si no, el llamador usa su placeholder. */
export function hasShipImage(scene: Phaser.Scene, archetype: ShipArchetype): boolean {
  return scene.textures.exists(shipImageTextureKey(archetype));
}

function basename(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.png$/i, "");
}
