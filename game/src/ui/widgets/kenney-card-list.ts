import Phaser from "phaser";
import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR } from "../../render/palette.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";

/** Alpha de fondo de tarjeta: base vs. realce al pasar el cursor (12c.7, obs #7). */
const CARD_BG_ALPHA = 0.7;
const CARD_BG_ALPHA_HOVER = 0.95;

export interface KenneyCardItem {
  /** Color del swatch/borde de la tarjeta (ej. color curado por elemento, o por tag del resultado). */
  readonly color: number;
  readonly title: string;
  /** Líneas de detalle (tags químicos ya traducidos) — se muestran debajo del título, una tarjeta puede no tener ninguna. */
  readonly detailLines?: ReadonlyArray<string>;
  readonly onClick?: () => void;
}

/**
 * Alto MÍNIMO de tarjeta (13e ronda 1 de fixes). Antes era un alto FIJO y el
 * título se pintaba sin `wordWrap`, así que un nombre largo se salía por la
 * derecha de la tarjeta — reportado en el playtest de 13e sobre la paleta
 * química, que además ganó un sufijo de stock (`×N`). Ahora la tarjeta crece
 * hasta contener su contenido real.
 */
const CARD_MIN_HEIGHT = 54;
const SWATCH_SIZE = 20;
/** Margen del texto respecto del swatch, y respiro superior/inferior. */
const TEXT_LEFT = 10 + SWATCH_SIZE / 2 + 12;
const CARD_PADDING_Y = 8;

/**
 * Lista vertical con scroll de "tarjetas" (swatch de color + nombre + líneas
 * de detalle) — hermana de `createKenneyList` (mismo esqueleto de
 * `scrollablePanel`/`slider`/`mouseWheelScroller`), pero cada fila es un
 * `Phaser.GameObjects.Container` nativo en vez de un `rexUI.label` de una
 * sola línea de texto (Fase 11c.3, feedback de playtest: la paleta de
 * elementos químicos necesita mostrar color + nombre + tags, no solo texto).
 *
 * IMPORTANTE (lección de 11c.3): el llamador DEBE destruir el panel devuelto
 * con `.destroy()` **sin** `true`. `ScrollablePanel` (como todo objeto
 * `rexUI`) es un `ContainerLite`, cuyo `destroy(fromScene)` NO significa
 * "destrucción profunda" — significa "la Scene me está destruyendo a mí", y
 * en ese caso deliberadamente NO destruye a sus hijos (evita trabajo
 * redundante cuando el propio teardown de la Scene ya los va a destruir).
 * Llamar `.destroy(true)` dejaba huérfanos visuales (filas/scrollbar) y un
 * listener de `wheel` a nivel de escena que sobrevivía al panel, crasheando
 * al scrollear un panel recreado. `.destroy()` (sin argumento) sí cascada la
 * destrucción real. Mismos `track`/`thumb` shape-based que `createKenneyList`
 * (el pack Kenney no trae asset de scrollbar).
 */
export function createKenneyCardList(
  scene: SceneWithRexUI,
  x: number,
  y: number,
  width: number,
  height: number,
  items: ReadonlyArray<KenneyCardItem>,
): ScrollablePanel {
  const track = scene.add.rectangle(0, 0, 8, 10, 0x1a2030, 1);
  const thumb = scene.add.rectangle(0, 0, 8, 40, 0x8890a8, 1);

  const sizer = scene.rexUI.add.sizer({ orientation: "y", space: { item: 6 } });

  if (items.length === 0) {
    sizer.add(
      scene.add.text(0, 0, "—", {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "14px",
        color: LABEL_COLOR,
      }),
      { padding: { top: 8, bottom: 8 } },
    );
  }

  const cardWidth = width - 24;
  const textWidth = cardWidth - TEXT_LEFT - 10;
  for (const item of items) {
    const card = scene.add.container(0, 0);
    /*
     * Los hijos se posicionan RELATIVOS AL CENTRO del container, no a su
     * esquina (13e ronda 1 de fixes). rexUI ancla cada hijo de un sizer por su
     * centro; como antes los hijos usaban `origin(0,0)` a partir de ese punto,
     * la tarjeta entera se dibujaba hacia la DERECHA del centro y la máscara
     * del `scrollablePanel` le cortaba la mitad derecha — que es exactamente el
     * "se ve cortado a la derecha de cada tarjeta" del playtest.
     */
    const left = -cardWidth / 2;
    // Los textos se crean ANTES que el fondo para poder medir su alto real y
    // dimensionar la tarjeta a su contenido (antes el fondo tenía alto fijo y
    // el texto largo lo desbordaba).
    const title = scene.add
      .text(left + TEXT_LEFT, 0, item.title, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "13px",
        color: HEADER_COLOR,
        wordWrap: { width: textWidth, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    const detail =
      item.detailLines && item.detailLines.length > 0
        ? scene.add
            .text(left + TEXT_LEFT, 0, item.detailLines.join(" · "), {
              fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
              fontSize: "10px",
              color: LABEL_COLOR,
              wordWrap: { width: textWidth, useAdvancedWrap: true },
            })
            .setOrigin(0, 0)
        : undefined;
    // Alto real del contenido ya envuelto, con un mínimo para que una tarjeta
    // de una sola línea no quede raquítica.
    const contentHeight = title.height + (detail ? detail.height + 4 : 0);
    const cardHeight = Math.max(CARD_MIN_HEIGHT, contentHeight + CARD_PADDING_Y * 2);
    const top = -cardHeight / 2;
    title.setY(top + CARD_PADDING_Y);
    detail?.setY(title.y + title.height + 4);

    const cardBg = scene.add
      .rectangle(left, top, cardWidth, cardHeight, 0x1a2030, CARD_BG_ALPHA)
      .setOrigin(0, 0)
      .setStrokeStyle(1, item.color, 0.9);
    card.add(cardBg);
    card.add(
      scene.add.rectangle(left + 10 + SWATCH_SIZE / 2, 0, SWATCH_SIZE, SWATCH_SIZE, item.color, 1).setOrigin(0.5),
    );
    card.add(title);
    if (detail) {
      card.add(detail);
    }
    card.setSize(cardWidth, cardHeight);
    if (item.onClick) {
      const onClick = item.onClick;
      card.setInteractive(
        new Phaser.Geom.Rectangle(left, top, cardWidth, cardHeight),
        Phaser.Geom.Rectangle.Contains,
      );
      if (card.input) {
        // Cursor custom en vez del puntero del sistema (12c.7, obs #2).
        card.input.cursor = UI_POINTER_CURSOR_CSS;
      }
      // Feedback de hover/click (12c.7, obs #7): sonido + realce del fondo.
      card
        .on("pointerover", () => {
          cardBg.setFillStyle(0x1a2030, CARD_BG_ALPHA_HOVER);
          scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonHover), { volume: 0.25 });
        })
        .on("pointerout", () => cardBg.setFillStyle(0x1a2030, CARD_BG_ALPHA))
        .on("pointerdown", () => {
          scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonClick), { volume: 0.4 });
          onClick();
        });
    }
    sizer.add(card, { padding: { left: 4, right: 4 } });
  }

  const panel = scene.rexUI.add
    .scrollablePanel({
      x,
      y,
      width,
      height,
      scrollMode: 0,
      panel: { child: sizer, mask: { padding: 2 } },
      slider: { track, thumb },
      mouseWheelScroller: { focus: 2, speed: 0.3 },
      space: { left: 8, right: 8, top: 8, bottom: 8, panel: 8 },
    })
    .layout();

  return panel;
}
