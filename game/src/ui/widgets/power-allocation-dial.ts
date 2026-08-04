import Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { LABEL_COLOR } from "../../render/palette.js";
import { createKenneyButton } from "./kenney-button.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

const DIAL_BUTTON_SIZE = 22;
const DIAL_GAP = 4;

export interface PowerAllocationDialOptions {
  readonly x: number;
  readonly y: number;
  readonly units: number;
  /** Gateado a modo `"planning"` (Fase 13b) — mismo criterio que `createWorkbenchButton`. */
  readonly enabled: boolean;
  readonly onIncrement: () => void;
  readonly onDecrement: () => void;
}

/**
 * Dial +1/-1 por sección (Fase 13b), primer control tipo stepper del
 * proyecto — sin plantilla directa (ver `PENDIENTES_OBSERVACIONES.md`/plan de
 * la subfase). Compuesto a mano con dos `createKenneyButton` pequeños en par
 * más un texto central, en vez de un widget rexUI dedicado que no existe en
 * el pack. Anclado a la posición dada (centroide de sección en mundo, no HUD
 * fijo) — "sin panel de barras abstracto" del diseño cerrado.
 */
export function renderPowerAllocationDial(
  scene: SceneWithRexUI,
  options: PowerAllocationDialOptions,
): Phaser.GameObjects.Container {
  const { x, y, units, enabled } = options;

  const label = scene.add
    .text(0, 0, String(units), {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "16px",
      color: LABEL_COLOR,
    })
    .setOrigin(0.5);

  const minusButton = createKenneyButton(scene, -(DIAL_BUTTON_SIZE / 2 + DIAL_GAP + 16), 0, "-", {
    width: DIAL_BUTTON_SIZE,
    height: DIAL_BUTTON_SIZE,
    fontSize: "14px",
    enabled,
    onClick: options.onDecrement,
  });
  const plusButton = createKenneyButton(scene, DIAL_BUTTON_SIZE / 2 + DIAL_GAP + 16, 0, "+", {
    width: DIAL_BUTTON_SIZE,
    height: DIAL_BUTTON_SIZE,
    fontSize: "14px",
    enabled,
    onClick: options.onIncrement,
  });

  return scene.add.container(x, y, [minusButton, label, plusButton]);
}
