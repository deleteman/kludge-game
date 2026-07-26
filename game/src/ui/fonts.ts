import kenneyFutureUrl from "../../assets/sprites/ui/Font/Kenney Future.ttf?url";

/**
 * Phaser 3 no tiene `load.font` nativo para TTF arbitrario (solo bitmap
 * fonts). Se carga vía `FontFace` API y se registra en `document.fonts` antes
 * de crear cualquier `Text` que la use — mismo criterio que cargar una
 * textura antes de usarla, pero para fuentes.
 */
export const UI_FONT_FAMILY = "Kenney Future";

let fontsLoadedPromise: Promise<void> | undefined;

export function loadUiFonts(): Promise<void> {
  if (!fontsLoadedPromise) {
    const face = new FontFace(UI_FONT_FAMILY, `url(${kenneyFutureUrl})`);
    fontsLoadedPromise = face
      .load()
      .then((loaded) => {
        // lib.dom.d.ts no tipa `FontFaceSet.add` (limitación conocida de TS) aunque existe en runtime.
        (document.fonts as unknown as { add(font: FontFace): void }).add(loaded);
      })
      .catch((error: unknown) => {
        console.warn(`[fonts] No se pudo cargar "${UI_FONT_FAMILY}", se usa el fallback:`, error);
      });
  }
  return fontsLoadedPromise;
}
