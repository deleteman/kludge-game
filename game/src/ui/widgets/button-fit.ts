/**
 * Geometría pura de botones, sin Phaser, para poder testearla.
 *
 * Causa raíz que resuelve: un `rexUI Label` NO respeta el `width` que se le pide
 * si el texto no entra — crece hasta abarcarlo. En una fila de botones de columna
 * angosta (panel de cable, panel de nodo, 14b-3) eso hacía que los vecinos se
 * pisaran, y cada botón nuevo con un label largo lo volvía a romper. Dos
 * defensas, una por capa:
 *  - PREVENCIÓN: `fitTextToWidth` achica la fuente y, si ni así entra, pide
 *    partir el texto en líneas (el botón crece en alto). Nunca recorta.
 *  - DETECCIÓN: `findOverlappingPairs` es lo que usa el chequeo de paneles para
 *    avisar cuando, aun así, dos botones se solapan (p.ej. mala aritmética de
 *    posiciones al apilar).
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Márgenes horizontales que el botón reserva a cada lado del texto (ver `space` en `kenney-button.ts`). */
export const BUTTON_TEXT_PADDING_X = 10;
/** Por debajo de esto el pixel-font deja de leerse: se parte en líneas en vez de seguir achicando. */
const MIN_FONT_PX = 9;

export interface FittedText {
  readonly fontPx: number;
  /** El texto NO entra en una línea ni con la fuente mínima: hay que partirlo y dejar crecer el botón. */
  readonly wrap: boolean;
}

/**
 * Elige el tamaño de fuente para que el texto entre en `availableWidth`; si ni
 * con la fuente mínima entra, pide partirlo en líneas. NUNCA recorta: un botón
 * con "…" no se puede leer ni entender, y sin tooltip no hay forma de ver el
 * resto (decisión del operador). Perder alto es preferible a perder texto.
 *
 * `measure(text, fontPx)` devuelve el ancho renderizado en una línea (en
 * Phaser: medir un Text; en tests: una función lineal).
 */
export function fitTextToWidth(
  text: string,
  startFontPx: number,
  availableWidth: number,
  measure: (text: string, fontPx: number) => number,
): FittedText {
  let fontPx = startFontPx;
  while (fontPx > MIN_FONT_PX && measure(text, fontPx) > availableWidth) fontPx -= 1;
  return { fontPx, wrap: measure(text, fontPx) > availableWidth };
}

/** Tolerancia: bordes que se tocan (o difieren por redondeo) no cuentan como solape. */
const OVERLAP_EPSILON = 1;

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x + a.width - OVERLAP_EPSILON > b.x &&
    b.x + b.width - OVERLAP_EPSILON > a.x &&
    a.y + a.height - OVERLAP_EPSILON > b.y &&
    b.y + b.height - OVERLAP_EPSILON > a.y
  );
}

/** Pares de índices cuyos rectángulos se solapan. */
export function findOverlappingPairs(rects: ReadonlyArray<Rect>): ReadonlyArray<readonly [number, number]> {
  const pairs: Array<readonly [number, number]> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i]!, rects[j]!)) pairs.push([i, j]);
    }
  }
  return pairs;
}
