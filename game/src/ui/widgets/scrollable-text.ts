import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import { LABEL_COLOR } from "../../render/palette.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export interface ScrollableTextStyle {
  readonly fontSize?: string;
  readonly color?: string;
  readonly align?: "left" | "center";
  readonly lineSpacing?: number;
}

/**
 * Caja de texto de tamaño FIJO que hace wrap y scrollea su contenido (rueda +
 * slider) cuando excede el alto — para cuerpos de largo variable (briefing de
 * crisis, panel de objetivos) que antes se desbordaban del cuadro. Reusa el
 * mismo `scrollablePanel` de rexUI que `kenney-list.ts`, con sus mismas
 * precauciones ya depuradas: track/thumb como `Rectangle` (no `Graphics`, que
 * crashea `setDraggable`), `mouseWheelScroller.focus: 2` (bounds del wheel en
 * vivo), y `(x, y)` como CENTRO del panel (no el borde superior).
 *
 * Para ubicarlo en una caja `[top, bottom]`: `y = (top + bottom) / 2`,
 * `height = bottom - top`.
 */
export function createScrollableText(
  scene: SceneWithRexUI,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  style: ScrollableTextStyle = {},
): ScrollablePanel {
  const track = scene.add.rectangle(0, 0, 8, 10, 0x1a2030, 1);
  const thumb = scene.add.rectangle(0, 0, 8, 40, 0x8890a8, 1);

  // Ancho de wrap = ancho de la caja menos el espacio del slider y los paddings
  // laterales, para que ninguna línea pase por debajo de la barra de scroll.
  const wrapWidth = width - 28;
  // "sans-serif" (playtest ronda 2), no `UI_FONT_FAMILY`: esta caja SIEMPRE
  // es cuerpo de texto largo (descripción de la crisis, briefing) — la fuente
  // Kenney es de display en mayúsculas por diseño, ilegible para párrafos.
  const content = scene.add.text(0, 0, text, {
    fontFamily: "sans-serif",
    fontSize: style.fontSize ?? "14px",
    color: style.color ?? LABEL_COLOR,
    align: style.align ?? "left",
    lineSpacing: style.lineSpacing ?? 6,
    wordWrap: { width: wrapWidth },
  });

  return scene.rexUI.add
    .scrollablePanel({
      x,
      y,
      width,
      height,
      scrollMode: 0,
      panel: { child: content, mask: { padding: 2 } },
      slider: { track, thumb },
      mouseWheelScroller: { focus: 2, speed: 0.3 },
      space: { left: 8, right: 8, top: 8, bottom: 8, panel: 8 },
    })
    .layout();
}
