import type Phaser from "phaser";
import tripulanteUrl from "../../assets/sprites/crew/tripulante.png";

/**
 * Sprite genérico de tripulante para los tokens del PLANO (no la tira UI, que
 * mantiene sus retratos por-nombre). Un único PNG compartido por toda la
 * tripulación (`crew/tripulante.png`, figura mirando a la IZQUIERDA), teñido en
 * runtime con un color por personaje — el principio de "tinte en runtime para
 * adaptar sprites genéricos" (CLAUDE.md, arte).
 *
 * El PNG viene con un traje AMARILLO saturado, y `setTint` de Phaser es
 * MULTIPLICATIVO (color_final = color_textura × tinte): teñir amarillo por azul
 * daría un verdoso oscuro, no azul. Para que cada personaje se distinga con su
 * color nítido, generamos una vez una versión GRIS CLARA de la textura y
 * teñimos sobre esa — sobre gris claro el tinte rinde como su propio color.
 */

/** Textura cruda tal como se carga del PNG (traje amarillo). No se dibuja directo: es la fuente del gris. */
export const CREW_SPRITE_RAW_TEXTURE = "crew-sprite-raw";
/** Versión gris clara (derivada de la cruda), lista para `setTint(colorDelPersonaje)`. */
export const CREW_SPRITE_TINT_TEXTURE = "crew-sprite-tint";

/**
 * Altura del token en el plano (px). Huella similar al círculo placeholder de
 * radio 11 que reemplaza; el ancho se deriva conservando el aspecto del PNG.
 */
export const CREW_TOKEN_HEIGHT_PX = 50;

/** Precarga el PNG crudo (llamar desde `Scene.preload`). */
export function preloadCrewSprite(scene: Phaser.Scene): void {
  scene.load.image(CREW_SPRITE_RAW_TEXTURE, tripulanteUrl);
}

/**
 * Genera (una sola vez) la textura gris clara tint-ready a partir de la cruda.
 * Idempotente: si ya existe, no hace nada. Requiere que el PNG crudo ya esté
 * cargado (llamar en `create`, tras el `preload`). Reemplaza cada píxel por su
 * LUMINANCIA (Rec. 601) empujada hacia claro para que el tinte multiplicativo
 * rinda vivo, conservando el canal alfa (el recorte de la figura no se pierde).
 */
export function ensureCrewTintTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(CREW_SPRITE_TINT_TEXTURE)) return;
  if (!scene.textures.exists(CREW_SPRITE_RAW_TEXTURE)) return;

  const source = scene.textures.get(CREW_SPRITE_RAW_TEXTURE).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const w = source.width;
  const h = source.height;
  const canvasTexture = scene.textures.createCanvas(CREW_SPRITE_TINT_TEXTURE, w, h);
  const ctx = canvasTexture?.getContext();
  if (!canvasTexture || !ctx) return;

  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    // Empuje hacia claro (base ~[96,255]): sobre gris claro el tinte se lee como
    // su color pleno; sin el empuje, un gris medio apagaría todos los colores.
    const lightened = Math.round(96 + luminance * 0.62);
    data[i] = lightened;
    data[i + 1] = lightened;
    data[i + 2] = lightened;
    // data[i + 3] (alfa) intacto: preserva el recorte de la silueta.
  }
  ctx.putImageData(image, 0, 0);
  canvasTexture.refresh();
}

/**
 * `flipX` correcto para que el sprite "mire hacia donde camina". El PNG mira a
 * la IZQUIERDA por defecto, así que moverse a la DERECHA requiere voltear
 * (`flipX = true`); a la izquierda, no. Un desplazamiento vertical puro (mismo
 * x) conserva la última cara. Función pura para poder testearla aislada.
 */
export function faceX(fromX: number, toX: number, current: boolean): boolean {
  if (toX > fromX) return true;
  if (toX < fromX) return false;
  return current;
}
