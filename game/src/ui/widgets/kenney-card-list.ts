import Phaser from "phaser";
import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR } from "../../render/palette.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export interface KenneyCardItem {
  /** Color del swatch/borde de la tarjeta (ej. color curado por elemento, o por tag del resultado). */
  readonly color: number;
  readonly title: string;
  /** Líneas de detalle (tags químicos ya traducidos) — se muestran debajo del título, una tarjeta puede no tener ninguna. */
  readonly detailLines?: ReadonlyArray<string>;
  readonly onClick?: () => void;
}

const CARD_HEIGHT = 54;
const SWATCH_SIZE = 20;

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
  for (const item of items) {
    const card = scene.add.container(0, 0);
    card.add(
      scene.add
        .rectangle(0, 0, cardWidth, CARD_HEIGHT, 0x1a2030, 0.7)
        .setOrigin(0, 0)
        .setStrokeStyle(1, item.color, 0.9),
    );
    card.add(
      scene.add.rectangle(10, CARD_HEIGHT / 2, SWATCH_SIZE, SWATCH_SIZE, item.color, 1).setOrigin(0.5),
    );
    card.add(
      scene.add
        .text(10 + SWATCH_SIZE / 2 + 12, 8, item.title, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "13px",
          color: HEADER_COLOR,
        })
        .setOrigin(0, 0),
    );
    if (item.detailLines && item.detailLines.length > 0) {
      card.add(
        scene.add
          .text(10 + SWATCH_SIZE / 2 + 12, 28, item.detailLines.join(" · "), {
            fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
            fontSize: "10px",
            color: LABEL_COLOR,
            wordWrap: { width: cardWidth - SWATCH_SIZE - 34 },
          })
          .setOrigin(0, 0),
      );
    }
    card.setSize(cardWidth, CARD_HEIGHT);
    if (item.onClick) {
      card.setInteractive(new Phaser.Geom.Rectangle(0, 0, cardWidth, CARD_HEIGHT), Phaser.Geom.Rectangle.Contains);
      if (card.input) {
        card.input.cursor = "pointer";
      }
      card.on("pointerdown", item.onClick);
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
