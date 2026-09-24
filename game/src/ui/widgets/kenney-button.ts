import type Phaser from "phaser";
import type Label from "phaser3-rex-plugins/templates/ui/label/Label.js";
import { UI_TEXTURE_KEYS } from "../ui-asset-registry.js";
import { UI_FONT_FAMILY } from "../fonts.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";
import { attachHoverJuice } from "../ui-effects.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import { BUTTON_TEXT_PADDING_X, fitTextToWidth } from "./button-fit.js";

/** Marca en `getData` para que el chequeo de solapes de un panel reconozca sus botones. */
export const KENNEY_BUTTON_DATA_KEY = "kludgeButton";

/**
 * El pack Kenney "Grey" es claro (gris plateado) — texto claro (`LABEL_COLOR`,
 * pensado para fondos oscuros del plano/mesa) queda ilegible encima. Colores
 * oscuros propios del botón, no reutilizados de `palette.ts` (esa paleta es
 * para el canvas de juego, no para UI de menú sobre estos assets).
 */
const BUTTON_TEXT_COLOR = "#20242c";
/**
 * Deshabilitado tiene que LEERSE, no adivinarse (ronda 3 de fixes de 13e). Era
 * `#6b7280` sobre un fondo que además se atenuaba a `alpha 0.4`: las dos
 * atenuaciones se sumaban y el texto desaparecía. Desde 13e los labels
 * deshabilitados llevan el MOTIVO ("Extraer (requiere análisis)", "Fabricar
 * (pausá primero)"), así que un label ilegible anula el propio patrón: el
 * jugador ve un botón gris mudo, que es exactamente lo que se quiso evitar.
 */
const BUTTON_TEXT_COLOR_DISABLED = "#3c4250";
/** Atenuación del fondo en estado deshabilitado: suficiente para distinguirlo, no para borrarlo. */
const DISABLED_BACKGROUND_ALPHA = 0.75;

export interface KenneyButtonOptions {
  readonly width?: number;
  readonly height?: number;
  readonly fontSize?: string;
  readonly enabled?: boolean;
  readonly square?: boolean;
  /** Texture key de un icono opcional a la izquierda del texto (12c.1). */
  readonly iconTextureKey?: string;
  /** Tamaño del icono en px (cuadrado). Por defecto se ajusta al alto del botón. */
  readonly iconSize?: number;
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
    background.setAlpha(DISABLED_BACKGROUND_ALPHA);
  }

  // Icono opcional a la izquierda del texto (12c.1). rexUI lo coloca antes del
  // texto en un label horizontal; si la texture no existe, se omite sin romper.
  const iconSize = options.iconSize ?? Math.min(height - 10, 24);
  const icon =
    options.iconTextureKey && scene.textures.exists(options.iconTextureKey)
      ? scene.add.image(0, 0, options.iconTextureKey).setDisplaySize(iconSize, iconSize)
      : undefined;
  if (icon && !enabled) icon.setAlpha(DISABLED_BACKGROUND_ALPHA);

  // Un rexUI Label crece hasta abarcar su texto en vez de respetar `width`, y en
  // una fila de botones eso los solapa (ver `button-fit.ts`). Se ajusta el texto
  // al ancho pedido ANTES de crear el label: fuente menor y, si no alcanza, en
  // varias líneas — nunca recortado. Un botón con varias líneas crece en alto,
  // por eso las filas de botones se apilan con `layoutButtonRow`.
  const labelText = scene.add.text(0, 0, label, {
    fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
    fontSize: options.fontSize ?? "16px",
    color: enabled ? BUTTON_TEXT_COLOR : BUTTON_TEXT_COLOR_DISABLED,
    align: "center",
  });
  const availableTextWidth = width - 2 * BUTTON_TEXT_PADDING_X - (icon ? iconSize + 6 : 0);
  const fitted = fitTextToWidth(
    label,
    Number.parseInt(options.fontSize ?? "16px", 10),
    availableTextWidth,
    (candidate, fontPx) => {
      labelText.setFontSize(fontPx).setText(candidate);
      return labelText.width;
    },
  );
  labelText.setFontSize(fitted.fontPx).setText(label);
  if (fitted.wrap) labelText.setWordWrapWidth(availableTextWidth, true);

  const button = scene.rexUI.add
    .label({
      x,
      y,
      width,
      height,
      background,
      icon,
      text: labelText,
      align: "center",
      space: { left: 10, right: 10, top: 8, bottom: 8, icon: icon ? 6 : 0 },
    })
    .layout();
  button.setData(KENNEY_BUTTON_DATA_KEY, true);

  if (enabled) {
    button
      // Cursor custom (12c.7, obs #2) en vez de `useHandCursor` (puntero del sistema, más chico).
      .setInteractive({ cursor: UI_POINTER_CURSOR_CSS })
      .on("pointerover", () => scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonHover), { volume: 0.3 }))
      .on("pointerdown", () => {
        scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonClick), { volume: 0.5 });
        options.onClick();
      });
    // Feedback VISUAL de hover/click (12c.1) — antes solo había sonido en hover
    // (deuda de PENDIENTES "falta efecto hover visual en los botones").
    attachHoverJuice(scene, button);
  }

  return button;
}

/** Resalta/atenúa un botón ya creado (selección exclusiva entre varios, ej. arquetipo/tripulante). */
export function setButtonHighlighted(button: Label, highlighted: boolean): void {
  const background = button.getElement("background") as Phaser.GameObjects.Image | undefined;
  background?.setAlpha(highlighted ? 1 : 0.5);
}
