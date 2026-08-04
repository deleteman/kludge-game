import Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { LABEL_COLOR } from "../../render/palette.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";

const TRACK_WIDTH = 80;
const TRACK_HEIGHT = 6;
const THUMB_RADIUS = 8;
const TRACK_COLOR = 0x3a4152;
const FILL_COLOR = 0x6fb4ff;
const THUMB_COLOR = 0xd8dce8;
const DISABLED_ALPHA = 0.5;

export interface PowerAllocationSliderOptions {
  readonly x: number;
  readonly y: number;
  readonly maxUnits: number;
  readonly units: number;
  /** Gateado a modo `"planning"` (Fase 13b) — mismo criterio que `createWorkbenchButton`. */
  readonly enabled: boolean;
  readonly onChange: (units: number) => void;
}

export interface PowerAllocationSliderHandle {
  readonly container: Phaser.GameObjects.Container;
  destroy(): void;
}

/**
 * Slider entero por sección (Fase 13b, ronda 2 de playtest — reemplaza el
 * stepper +/- de `power-allocation-dial.ts`, sentido "incómodo como UX").
 * Molde: `kenney-slider.ts` (mismo estilo visual, track+fill+thumb a mano —
 * el pack Kenney no trae este componente), pero NO es reusable tal cual:
 * - Objeto de MUNDO (pan/zoom con el mapa), no HUD fijo — la posición de
 *   arrastre se resuelve con `scene.cameras.main.getWorldPoint(...)`, nunca
 *   `pointer.x` crudo (que asume coordenadas de pantalla).
 * - Entero, no continuo: arrastra en fracción 0..1 internamente, redondea a
 *   entero de `maxUnits`, y solo llama `onChange` cuando el entero cambia
 *   (evita spamear `setSectionPowerUnits` en cada pixel de arrastre).
 * - Limpieza explícita vía `destroy()`: a diferencia del slider de
 *   `options-scene.ts` (vive toda la escena), este se destruye/recrea muchas
 *   veces por sesión (`redrawEnergyControls`, cada toggle de capa/cambio de
 *   modo) — sin sacar sus propios listeners de `scene.input`, cada
 *   reconstrucción deja un handler huérfano apuntando a un container ya
 *   destruido.
 */
export function renderPowerAllocationSlider(
  scene: Phaser.Scene,
  options: PowerAllocationSliderOptions,
): PowerAllocationSliderHandle {
  const { x, y, maxUnits, enabled } = options;
  const safeMax = Math.max(1, maxUnits);
  let units = Phaser.Math.Clamp(Math.round(options.units), 0, safeMax);

  const left = -TRACK_WIDTH / 2;
  const container = scene.add.container(x, y);

  const label = scene.add
    .text(0, -16, `${units}/${maxUnits}`, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "12px",
      color: LABEL_COLOR,
    })
    .setOrigin(0.5);
  const track = scene.add.rectangle(0, 0, TRACK_WIDTH, TRACK_HEIGHT, TRACK_COLOR).setOrigin(0.5);
  const fill = scene.add
    .rectangle(left, 0, TRACK_WIDTH * (units / safeMax), TRACK_HEIGHT, FILL_COLOR)
    .setOrigin(0, 0.5);
  const thumb = scene.add.circle(left + TRACK_WIDTH * (units / safeMax), 0, THUMB_RADIUS, THUMB_COLOR);
  container.add([label, track, fill, thumb]);

  if (!enabled) {
    container.setAlpha(DISABLED_ALPHA);
  }

  const redraw = (): void => {
    const fraction = units / safeMax;
    fill.width = TRACK_WIDTH * fraction;
    thumb.x = left + TRACK_WIDTH * fraction;
    label.setText(`${units}/${maxUnits}`);
  };

  const applyFromWorldX = (worldX: number): void => {
    const local = worldX - container.x - left;
    const fraction = Phaser.Math.Clamp(local / TRACK_WIDTH, 0, 1);
    const next = Math.round(fraction * safeMax);
    if (next === units) return;
    units = next;
    redraw();
    options.onChange(units);
  };

  const hitZone = scene.add
    .zone(0, 0, TRACK_WIDTH + THUMB_RADIUS * 2, THUMB_RADIUS * 2 + 8)
    .setOrigin(0.5)
    .setInteractive(enabled ? { cursor: UI_POINTER_CURSOR_CSS } : undefined);
  container.add(hitZone);

  let dragging = false;
  const worldXOf = (pointer: Phaser.Input.Pointer): number => scene.cameras.main.getWorldPoint(pointer.x, pointer.y).x;

  const onDown = (pointer: Phaser.Input.Pointer): void => {
    if (!enabled) return;
    dragging = true;
    applyFromWorldX(worldXOf(pointer));
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (dragging) applyFromWorldX(worldXOf(pointer));
  };
  const onUp = (): void => {
    dragging = false;
  };
  hitZone.on("pointerdown", onDown);
  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);

  return {
    container,
    destroy(): void {
      hitZone.off("pointerdown", onDown);
      scene.input.off("pointermove", onMove);
      scene.input.off("pointerup", onUp);
      container.destroy();
    },
  };
}
