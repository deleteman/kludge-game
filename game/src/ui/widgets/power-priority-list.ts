import Phaser from "phaser";
import type { PlacedComponentInstanceId } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR, SECTION_FILL_COLORS } from "../../render/palette.js";
import { createKenneyButton } from "./kenney-button.js";
import { createKenneyPanel } from "./kenney-panel.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

const PANEL_WIDTH = 360;
const ROW_HEIGHT = 34;
const ROW_GAP = 6;
const HEADER_SPACE = 60;
const FOOTER_SPACE = 56;
const ARROW_BUTTON_SIZE = 22;

export interface PowerPriorityRow {
  readonly instanceId: PlacedComponentInstanceId;
  readonly label: string;
  readonly powered: boolean;
}

export interface PowerPriorityListLabels {
  readonly title: string;
  readonly close: string;
  readonly hint: string;
}

/**
 * Inspector de prioridad de energía de una sección (Fase 13b): lista simple
 * con botones ↑/↓ por fila — opción MÁS SIMPLE del diseño cerrado (no
 * drag-and-drop, sin precedente de reordenamiento en el proyecto). Se abre al
 * clickear una sección con la capa "energia" activa, en modo pausa. Panel
 * autocontenido en un `Container` para que el llamador lo destruya de una vez.
 */
export function renderPowerPriorityList(
  scene: SceneWithRexUI,
  centerX: number,
  centerY: number,
  rows: ReadonlyArray<PowerPriorityRow>,
  labels: PowerPriorityListLabels,
  onMoveUp: (instanceId: PlacedComponentInstanceId) => void,
  onMoveDown: (instanceId: PlacedComponentInstanceId) => void,
  onClose: () => void,
): Phaser.GameObjects.Container {
  const height = HEADER_SPACE + FOOTER_SPACE + rows.length * (ROW_HEIGHT + ROW_GAP);
  const container = scene.add.container(centerX, centerY);

  const { panel, title } = createKenneyPanel(scene, 0, 0, PANEL_WIDTH, height, labels.title);
  container.add(panel);
  if (title) container.add(title);

  const top = -height / 2 + HEADER_SPACE;
  rows.forEach((row, index) => {
    const rowY = top + index * (ROW_HEIGHT + ROW_GAP);
    const rowBg = scene.add
      .rectangle(0, rowY, PANEL_WIDTH - 48, ROW_HEIGHT, SECTION_FILL_COLORS[0], row.powered ? 0.5 : 0.85)
      .setOrigin(0.5);
    const text = scene.add
      .text(-PANEL_WIDTH / 2 + 30, rowY, `${index + 1}. ${row.label}`, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: row.powered ? LABEL_COLOR : "#e0a33f",
      })
      .setOrigin(0, 0.5);
    const upButton = createKenneyButton(scene, PANEL_WIDTH / 2 - 62, rowY, "↑", {
      width: ARROW_BUTTON_SIZE,
      height: ARROW_BUTTON_SIZE,
      fontSize: "12px",
      enabled: index > 0,
      onClick: () => onMoveUp(row.instanceId),
    });
    const downButton = createKenneyButton(scene, PANEL_WIDTH / 2 - 34, rowY, "↓", {
      width: ARROW_BUTTON_SIZE,
      height: ARROW_BUTTON_SIZE,
      fontSize: "12px",
      enabled: index < rows.length - 1,
      onClick: () => onMoveDown(row.instanceId),
    });
    container.add([rowBg, text, upButton, downButton]);
  });

  if (rows.length === 0) {
    container.add(
      scene.add
        .text(0, top, "—", { fontFamily: `${UI_FONT_FAMILY}, sans-serif`, fontSize: "14px", color: LABEL_COLOR })
        .setOrigin(0.5),
    );
  }

  const closeButton = createKenneyButton(scene, 0, height / 2 - 34, labels.close, {
    width: 140,
    height: 32,
    fontSize: "13px",
    onClick: onClose,
  });
  container.add(closeButton);

  const hint = scene.add
    .text(0, -height / 2 + 36, labels.hint, {
      fontFamily: "sans-serif",
      fontSize: "11px",
      color: HEADER_COLOR,
    })
    .setOrigin(0.5);
  container.add(hint);

  return container;
}
