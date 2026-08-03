import type Phaser from "phaser";

/**
 * Registro de retratos de tripulante (playtest #16b). Un PNG por tripulante en
 * `game/assets/sprites/crew/<slug>.png`, nombrado por el NOMBRE del tripulante
 * en minúscula y sin acentos (`"Ríos" → "rios"`) — decisión del operador.
 *
 * Mismo patrón que `component-sprite-registry.ts`: `import.meta.glob` descubre
 * SOLO los archivos que existen en build time (importar un slug sin arte
 * rompería el build). Con la carpeta vacía el glob no matchea nada: nada se
 * precarga, `hasCrewPortrait` da siempre false y la tira cae a su placeholder
 * de color. Al agregar un PNG y recargar, aparece solo.
 */
const portraitModules = import.meta.glob("../../assets/sprites/crew/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/**
 * Basename del sprite genérico compartido (no un retrato por-nombre): lo carga
 * `crew-sprite.ts` para los tokens del plano. El glob de esta carpeta lo
 * matchea igual, así que se excluye aquí para no crear una textura de retrato
 * `crew:tripulante` inútil ni confundirlo con un tripulante llamado así.
 */
const GENERIC_SPRITE_SLUG = "tripulante";

/** `slug → url`, con el slug derivado del basename del archivo (sin `.png`). */
export const CREW_PORTRAIT_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(portraitModules)
    .map(([path, url]) => [basename(path), url] as const)
    .filter(([slug]) => slug !== GENERIC_SPRITE_SLUG),
);

/**
 * Normaliza un nombre de tripulante al slug de archivo: minúsculas + sin
 * acentos/diacríticos. Es la convención de nombrado de los PNG y de las claves
 * i18n `crew.<slug>.*`.
 */
export function crewPortraitSlug(name: string): string {
  // ̀-ͯ = marcas diacríticas combinantes que deja NFD (p.ej. la tilde de "Ríos").
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Key de textura de Phaser namespaced, para no chocar con tiles/componentes/UI. */
export function crewPortraitTextureKey(slug: string): string {
  return `crew:${slug}`;
}

/** Precarga los retratos que existan (no-op si la carpeta está vacía). */
export function preloadCrewPortraits(scene: Phaser.Scene): void {
  for (const [slug, url] of Object.entries(CREW_PORTRAIT_URLS)) {
    scene.load.image(crewPortraitTextureKey(slug), url);
  }
}

/** ¿Existe un retrato cargado para este tripulante? Si no, el llamador usa su placeholder. */
export function hasCrewPortrait(scene: Phaser.Scene, name: string): boolean {
  return scene.textures.exists(crewPortraitTextureKey(crewPortraitSlug(name)));
}

function basename(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.png$/i, "");
}
