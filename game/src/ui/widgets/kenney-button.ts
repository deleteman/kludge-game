import type Phaser from "phaser";
import type Label from "phaser3-rex-plugins/templates/ui/label/Label.js";
import { UI_TEXTURE_KEYS } from "../ui-asset-registry.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

/**
 * El pack Kenney "Grey" es claro (gris plateado) — texto claro (`LABEL_COLOR`,
 * pensado para fondos oscuros del plano/mesa) queda ilegible encima. Colores
 * oscuros propios del botón, no reutilizados de `palette.ts` (esa paleta es
 * para el canvas de juego, no para UI de menú sobre estos assets).
 */
const BUTTON_TEXT_COLOR = "#20242c";
const BUTTON_TEXT_COLOR_DISABLED = "#6b7280";

export interface KenneyButtonOptions {
  readonly width?: number;
  readonly height?: number;
  readonly fontSize?: string;
  readonly enabled?: boolean;
  readonly square?: boolean;
  readonly onClick: () => void;
}

/**
 * Wrapper fino sobre `rexUI.add.label` con fondo del pack Kenney ya colocado
 * (`ui-asset-registry.ts`) — un único punto de estilo para todos los botones
 * de las escenas de menú (CLAUDE.md: un archivo = una responsabilidad).
 */
export function createKenneyButton(
  scene: SceneWithRexUI,
  x: number,
  y: number,
  label: string,
  options: KenneyButtonOptions,
): Label {
  const width = options.width ?? 240;
  const height = options.height ?? 44;
  const enabled = options.enabled ?? true;
  const textureKey = options.square ? UI_TEXTURE_KEYS.buttonLargeSquare : UI_TEXTURE_KEYS.buttonLarge;

  const background = scene.add.image(0, 0, textureKey).setDisplaySize(width, height);
  if (!enabled) {
    background.setAlpha(0.4);
  }

  const button = scene.rexUI.add
    .label({
      x,
      y,
      width,
      height,
      background,
      text: scene.add.text(0, 0, label, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: options.fontSize ?? "16px",
        color: enabled ? BUTTON_TEXT_COLOR : BUTTON_TEXT_COLOR_DISABLED,
      }),
      align: "center",
      space: { left: 10, right: 10, top: 8, bottom: 8 },
    })
    .layout();

  if (enabled) {
    button.setInteractive({ useHandCursor: true }).on("pointerdown", options.onClick);
  }

  return button;
}

/** Resalta/atenúa un botón ya creado (selección exclusiva entre varios, ej. arquetipo/tripulante). */
export function setButtonHighlighted(button: Label, highlighted: boolean): void {
  const background = button.getElement("background") as Phaser.GameObjects.Image | undefined;
  background?.setAlpha(highlighted ? 1 : 0.5);
}
