import type Phaser from "phaser";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR } from "../../render/palette.js";
import { createKenneyButton } from "./kenney-button.js";
import { createKenneyPanel } from "./kenney-panel.js";
import { createScrollableText } from "./scrollable-text.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

const MODAL_WIDTH = 560;
const MODAL_HEIGHT = 360;

/**
 * Briefing de crisis al entrar a la misión (Fase 10d, ajuste post-playtest,
 * GDD §4 paso 1: "crisis se dispara" ocurre ANTES de que arranque la
 * planificación) — modal centrado, `scrollFactor(0)` fijado por el llamador
 * (vive en coordenadas de pantalla, no de mundo/cámara). Se muestra una vez;
 * el botón la destruye.
 */
export function renderMissionBriefingModal(
  scene: SceneWithRexUI,
  title: string,
  body: string,
  understoodLabel: string,
  onUnderstood: () => void,
): Phaser.GameObjects.Container {
  const centerX = 640;
  const centerY = 360;
  const container = scene.add.container(0, 0);

  container.add(scene.add.rectangle(centerX, centerY, 1280, 720, 0x000000, 0.55));

  const panel = createKenneyPanel(scene, centerX, centerY, MODAL_WIDTH, MODAL_HEIGHT);
  container.add(panel.panel);

  container.add(
    scene.add
      .text(centerX, centerY - MODAL_HEIGHT / 2 + 26, title, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "22px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5, 0),
  );

  // Cuerpo en una caja scrolleable de alto fijo entre el título y el botón — un
  // briefing largo se lee scrolleando en vez de desbordar el modal (playtest #16).
  const bodyTop = centerY - MODAL_HEIGHT / 2 + 58;
  const bodyBottom = centerY + MODAL_HEIGHT / 2 - 64;
  container.add(
    createScrollableText(
      scene,
      centerX,
      (bodyTop + bodyBottom) / 2,
      MODAL_WIDTH - 48,
      bodyBottom - bodyTop,
      body,
      { fontSize: "14px", align: "center" },
    ),
  );

  container.add(
    createKenneyButton(scene, centerX, centerY + MODAL_HEIGHT / 2 - 32, understoodLabel, {
      width: 220,
      onClick: onUnderstood,
    }),
  );

  return container;
}
