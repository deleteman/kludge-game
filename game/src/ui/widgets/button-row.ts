import type Label from "phaser3-rex-plugins/templates/ui/label/Label.js";
import type Phaser from "phaser";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { createKenneyButton } from "./kenney-button.js";

export interface ButtonRowSpec {
  readonly label: string;
  readonly enabled?: boolean;
  readonly fontSize?: string;
  readonly onClick: () => void;
}

const MIN_BUTTON_HEIGHT = 26;
const ROW_GAP = 6;

/**
 * Fila de botones de igual ancho, repartidos en `columns` columnas dentro de
 * `[left, left + totalWidth]`, que se apila por su alto REAL.
 *
 * Existe porque un botón con texto largo se parte en líneas y crece en alto
 * (`kenney-button.ts`): con alto fijo por fila la siguiente fila lo pisaba. Acá
 * se crean todos, se mide el más alto de la fila, se igualan y se colocan por su
 * borde superior. Devuelve el alto que ocupa la fila (con separación) para que
 * el llamador avance su cursor — no debe asumir un alto propio.
 */
export function layoutButtonRow(
  scene: SceneWithRexUI,
  container: Phaser.GameObjects.Container,
  specs: ReadonlyArray<ButtonRowSpec>,
  layout: { readonly left: number; readonly totalWidth: number; readonly top: number; readonly columns: number },
): number {
  const columnWidth = layout.totalWidth / layout.columns;
  const buttons: Label[] = specs.map((spec, index) => {
    const button = createKenneyButton(scene, layout.left + columnWidth * (index + 0.5), layout.top, spec.label, {
      width: columnWidth - 4,
      height: MIN_BUTTON_HEIGHT,
      fontSize: spec.fontSize ?? "11px",
      enabled: spec.enabled,
      onClick: spec.onClick,
    });
    container.add(button);
    return button;
  });
  const rowHeight = Math.max(MIN_BUTTON_HEIGHT, ...buttons.map((button) => button.displayHeight));
  for (const button of buttons) {
    button.setMinHeight(rowHeight).layout();
    button.setPosition(button.x, layout.top + rowHeight / 2);
  }
  return rowHeight + ROW_GAP;
}

/** Filas sucesivas de una rejilla; devuelve el alto total. */
export function layoutButtonGrid(
  scene: SceneWithRexUI,
  container: Phaser.GameObjects.Container,
  specs: ReadonlyArray<ButtonRowSpec>,
  layout: { readonly left: number; readonly totalWidth: number; readonly top: number; readonly columns: number },
): number {
  let used = 0;
  for (let start = 0; start < specs.length; start += layout.columns) {
    used += layoutButtonRow(scene, container, specs.slice(start, start + layout.columns), {
      ...layout,
      top: layout.top + used,
    });
  }
  return used;
}
