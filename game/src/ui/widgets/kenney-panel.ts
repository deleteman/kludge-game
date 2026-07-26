import type Phaser from "phaser";
import { UI_TEXTURE_KEYS } from "../ui-asset-registry.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR } from "../../render/palette.js";

/**
 * Fondo de panel/diálogo reutilizable (pausa, opciones, resultado de crisis,
 * explorador de blueprints). `NineSlice` nativo de Phaser 3.60+ para que el
 * mismo asset (`panel_rectangle.png`) escale a cualquier tamaño sin
 * deformarse. Insets aproximados (24px) — pendiente de ajuste visual fino por
 * el operador una vez inspeccionado el pack a nivel de píxel; no bloquea la
 * función del panel.
 */
const PANEL_INSET_PX = 24;

export function createKenneyPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  titleKey?: string,
): { readonly panel: Phaser.GameObjects.NineSlice; readonly title?: Phaser.GameObjects.Text } {
  const panel = scene.add.nineslice(
    x,
    y,
    UI_TEXTURE_KEYS.panelRectangle,
    undefined,
    width,
    height,
    PANEL_INSET_PX,
    PANEL_INSET_PX,
    PANEL_INSET_PX,
    PANEL_INSET_PX,
  );

  const title = titleKey
    ? scene.add
        .text(x, y - height / 2 + 16, titleKey, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "20px",
          color: HEADER_COLOR,
        })
        .setOrigin(0.5, 0)
    : undefined;

  return { panel, title };
}
