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

/** Textura blanca de 1×1 que sirve de lienzo para el placeholder tinteable. */
export const COMPONENT_PLACEHOLDER_TEXTURE_KEY = "component:__placeholder";

/**
 * Garantiza la textura del placeholder (deuda #38, Subfase 13g).
 *
 * Por qué existe: las piezas sin arte se dibujaban en el `Graphics` batcheado
 * del overlay, o sea que NO eran objetos por instancia y no podían recibir ni
 * tinte vivo ni el sombreado por luz. Eso era invisible mientras el único
 * estado era `unpowered` y el único consumidor de energía era la compuerta (que
 * sí tiene sprite); 13g le da `powerDraw` a chips, sensores y mesas, o sea
 * justo a las piezas sin arte. Con un `Image` sobre una textura blanca el
 * placeholder recorre EL MISMO camino que un sprite real —`setBaseTint`,
 * `applyLightShading`, `updateComponentStateTints`— en vez de tener el suyo.
 */
export function ensureComponentPlaceholderTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists(COMPONENT_PLACEHOLDER_TEXTURE_KEY)) {
    const canvas = scene.textures.createCanvas(COMPONENT_PLACEHOLDER_TEXTURE_KEY, 1, 1);
    const ctx = canvas?.context;
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1, 1);
      canvas?.refresh();
    }
  }
  return COMPONENT_PLACEHOLDER_TEXTURE_KEY;
}

function basename(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.png$/i, "");
}
