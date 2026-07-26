import type Phaser from "phaser";

/**
 * Registro de sprites de componente físico (Fase 10d, post-playtest #6). Un
 * PNG por id del catálogo atómico en `game/assets/sprites/components/<id>.png`
 * (convención de CLAUDE.md, arte de pack externo — GDD §17, no generado por
 * código).
 *
 * A diferencia de `particle-texture-registry.ts`/`tile-layer-registry.ts` (que
 * importan cada PNG estáticamente), acá se usa `import.meta.glob` de Vite para
 * descubrir SOLO los archivos que existen en build time — importar un id que
 * todavía no tiene arte rompería el build. Con la carpeta vacía el glob no
 * matchea nada: nada se precarga, `hasComponentSprite` da siempre false, y los
 * renderers caen a su placeholder actual. Al agregar un PNG y recargar la
 * página, aparece solo (el preload corre una vez por arranque de escena).
 */
const spriteModules = import.meta.glob("../../assets/sprites/components/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** `id → url`, con el id derivado del basename del archivo (sin `.png`). */
export const COMPONENT_SPRITE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(spriteModules).map(([path, url]) => [basename(path), url]),
);

/** Key de textura de Phaser namespaced, para no chocar con tiles/partículas/UI. */
export function componentTextureKey(id: string): string {
  return `component:${id}`;
}

/** Precarga los sprites de componente que existan (no-op si la carpeta está vacía). */
export function preloadComponentSprites(scene: Phaser.Scene): void {
  for (const [id, url] of Object.entries(COMPONENT_SPRITE_URLS)) {
    scene.load.image(componentTextureKey(id), url);
  }
}

/** ¿Existe un sprite cargado para este id? Si no, el llamador usa su placeholder. */
export function hasComponentSprite(scene: Phaser.Scene, id: string): boolean {
  return scene.textures.exists(componentTextureKey(id));
}

function basename(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.png$/i, "");
}
