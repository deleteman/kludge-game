import type Phaser from "phaser";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { HEADER_COLOR } from "../render/palette.js";

const BUBBLE_MAX_WIDTH = 160;
/** Tiempo FIJO al 100% de opacidad antes de empezar a salir (legibilidad, feedback playtest). */
const BUBBLE_HOLD_MS = 4000;
/** Duración del efecto de salida (sube + desvanece) tras el hold. */
const BUBBLE_FADEOUT_MS = 900;

/**
 * Burbuja de bark (frase de personalidad, GDD 6.7.1) sobre un tripulante. Objeto
 * de MUNDO (el llamador hace `markAsWorldObject` + `setDepth`) para que paneé
 * con el mapa y quede sobre la tripulación. Se mantiene FIJA y opaca unos
 * segundos y recién entonces sube y se desvanece (para poder leerla), luego se
 * autodestruye — misma idea que el texto flotante de `abortUnreachable`.
 *
 * Devuelve el container; el llamador decide profundidad/cámara.
 */
export function showBarkBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
): Phaser.GameObjects.Container {
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "11px",
      color: HEADER_COLOR,
      align: "center",
      wordWrap: { width: BUBBLE_MAX_WIDTH },
    })
    .setOrigin(0.5, 1);

  // Caja de fondo ajustada al texto (padding), con borde suave — "globo" simple.
  const padX = 8;
  const padY = 5;
  const bg = scene.add
    .rectangle(0, 0, label.width + padX * 2, label.height + padY * 2, 0x0a0a0f, 0.86)
    .setOrigin(0.5, 1)
    .setStrokeStyle(1, 0x2a3040, 1);
  // El texto se ancla en la base de la caja, subido por el padding inferior.
  label.setPosition(0, -padY);

  const container = scene.add.container(x, y - 30, [bg, label]);

  // Queda fija y al 100% durante el hold (`delay`), luego sube y se desvanece.
  scene.tweens.add({
    targets: container,
    y: y - 50,
    alpha: 0,
    delay: BUBBLE_HOLD_MS,
    duration: BUBBLE_FADEOUT_MS,
    ease: "Quad.easeOut",
    onComplete: () => container.destroy(true),
  });

  return container;
}
