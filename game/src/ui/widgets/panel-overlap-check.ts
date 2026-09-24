import type Phaser from "phaser";
import { findOverlappingPairs, type Rect } from "./button-fit.js";
import { KENNEY_BUTTON_DATA_KEY } from "./kenney-button.js";

/**
 * Chequeo de solapes de un panel ya armado: avisa por consola si dos botones se
 * pisan. Es la segunda defensa (la primera es que `createKenneyButton` ajuste el
 * texto al ancho): atrapa el error de aritmética al apilar bloques, que ninguna
 * medida de texto puede prevenir. Se llama una vez al final de cada render de
 * panel; con ~20 botones el costo es despreciable.
 *
 * Avisa en vez de lanzar: un panel con dos botones pisados sigue siendo
 * jugable, y romper la partida por un defecto de layout sería peor que el defecto.
 */
export function warnOnOverlappingButtons(container: Phaser.GameObjects.Container, panelName: string): void {
  const buttons = container.list.filter(
    (child): child is Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.GetBounds =>
      child.getData(KENNEY_BUTTON_DATA_KEY) === true && typeof (child as { getBounds?: unknown }).getBounds === "function",
  );
  const rects: Rect[] = buttons.map((button) => {
    const bounds = button.getBounds();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  for (const [i, j] of findOverlappingPairs(rects)) {
    console.warn(`[ui] Botones solapados en el panel "${panelName}"`, { a: rects[i], b: rects[j] });
  }
}
