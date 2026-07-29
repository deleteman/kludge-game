import Phaser from "phaser";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";

/**
 * Slider de 0..1 construido con primitivas (rectángulos), NO con un asset del
 * pack Kenney: el pack no incluye track/thumb (`ui-asset-registry.ts`). Un
 * archivo = una responsabilidad (CLAUDE.md): el único slider de las escenas de
 * menú. Usado por `options-scene.ts` para los controles de accesibilidad del CRT.
 *
 * `onChange` se llama en vivo mientras se arrastra (para que el efecto se vea al
 * instante en el plano); la persistencia a disco la hace el llamador al cerrar.
 */
export interface KenneySliderOptions {
  readonly width?: number;
  readonly value: number; // 0..1 inicial
  readonly onChange: (value: number) => void;
}

export interface KenneySliderHandle {
  readonly container: Phaser.GameObjects.Container;
  setValue(value: number): void;
}

const TRACK_HEIGHT = 8;
const THUMB_RADIUS = 10;
const TRACK_COLOR = 0x3a4152;
const FILL_COLOR = 0x6fb4ff;
const THUMB_COLOR = 0xd8dce8;

export function createKenneySlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: KenneySliderOptions,
): KenneySliderHandle {
  const width = options.width ?? 160;
  const left = -width / 2;
  let value = Math.min(1, Math.max(0, options.value));

  const container = scene.add.container(x, y);
  const track = scene.add.rectangle(0, 0, width, TRACK_HEIGHT, TRACK_COLOR).setOrigin(0.5);
  const fill = scene.add.rectangle(left, 0, width * value, TRACK_HEIGHT, FILL_COLOR).setOrigin(0, 0.5);
  const thumb = scene.add.circle(left + width * value, 0, THUMB_RADIUS, THUMB_COLOR);
  container.add([track, fill, thumb]);

  const redraw = (): void => {
    fill.width = width * value;
    thumb.x = left + width * value;
  };

  const applyFromPointerX = (worldX: number): void => {
    const local = worldX - container.x - left;
    value = Math.min(1, Math.max(0, local / width));
    redraw();
    options.onChange(value);
  };

  // Zona interactiva algo más alta que el track para que sea fácil de agarrar.
  const hitZone = scene.add
    .zone(0, 0, width + THUMB_RADIUS * 2, THUMB_RADIUS * 2 + 8)
    .setOrigin(0.5)
    .setInteractive({ cursor: UI_POINTER_CURSOR_CSS });
  container.add(hitZone);

  let dragging = false;
  hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    dragging = true;
    applyFromPointerX(pointer.x);
  });
  // Handlers con referencia propia para desregistrar SOLO estos en el shutdown
  // (un `off("pointermove")` sin handler borraría los de otros sistemas).
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (dragging) applyFromPointerX(pointer.x);
  };
  const onUp = (): void => {
    dragging = false;
  };
  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off("pointermove", onMove);
    scene.input.off("pointerup", onUp);
  });

  return {
    container,
    setValue(next: number): void {
      value = Math.min(1, Math.max(0, next));
      redraw();
    },
  };
}
