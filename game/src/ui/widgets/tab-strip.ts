import type Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { createKenneyButton, setButtonHighlighted } from "./kenney-button.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export interface TabDefinition {
  readonly id: string;
  readonly label: string;
}

const TAB_HEIGHT = 30;
const TAB_FONT_SIZE = "12px";
const TAB_HORIZONTAL_PADDING = 32;
const TAB_MIN_WIDTH = 140;
const TAB_GAP = 8;

/**
 * Fila de pestañas de ancho variable (playtest ronda 2: dos `createKenneyButton`
 * de ancho fijo 200px se solapaban con labels largos como "Catálogo — Requiere
 * Síntesis", porque el texto de un botón Kenney no hace `wordWrap` ni se
 * recorta — se desborda más allá de su propio botón). El pack Kenney no trae
 * un asset de tab dedicado (única textura "tipo pestaña" disponible es el
 * botón normal, confirmado por búsqueda exhaustiva), así que se reutiliza
 * `createKenneyButton` para el look pero con el ANCHO de cada botón calculado
 * a partir del ancho real del texto (medido con un `Text` temporal, mismo
 * font/tamaño, antes de crear el botón definitivo) en vez de un valor fijo, y
 * la fila se centra como grupo en vez de usar offsets simétricos que asumían
 * anchos iguales.
 */
export function renderTabStrip(
  scene: SceneWithRexUI,
  centerX: number,
  y: number,
  tabs: ReadonlyArray<TabDefinition>,
  activeId: string,
  onSelect: (id: string) => void,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  const widths = tabs.map((tab) => {
    const measure = scene.add.text(0, 0, tab.label, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: TAB_FONT_SIZE,
    });
    const width = Math.max(TAB_MIN_WIDTH, measure.width + TAB_HORIZONTAL_PADDING);
    measure.destroy();
    return width;
  });

  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + TAB_GAP * (tabs.length - 1);
  let cursorX = centerX - totalWidth / 2;

  tabs.forEach((tab, index) => {
    const width = widths[index]!;
    const button = createKenneyButton(scene, cursorX + width / 2, y, tab.label, {
      width,
      height: TAB_HEIGHT,
      fontSize: TAB_FONT_SIZE,
      onClick: () => onSelect(tab.id),
    });
    setButtonHighlighted(button, tab.id === activeId);
    container.add(button);
    cursorX += width + TAB_GAP;
  });

  return container;
}
