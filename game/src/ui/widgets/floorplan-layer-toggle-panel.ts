import type Phaser from "phaser";

import { FLOORPLAN_LAYER_IDS, type FloorplanLayerId } from "../../render/floorplan-renderer.js";
import { t } from "../../i18n/i18n.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { createKenneyButton, setButtonHighlighted } from "./kenney-button.js";

/**
 * Panel de toggles de capa del plano (Fase 11f, GDD §10): un botón por
 * `FloorplanLayerId` (las 4 `ConduitKind` reales + `"estructural"`
 * placeholder). Capa activa = botón resaltado (`setButtonHighlighted`, mismo
 * criterio visual que el resto de selecciones exclusivas del proyecto); capa
 * inactiva = atenuado, NUNCA oculto — el estado del botón espeja la opacidad
 * reducida que el toggle aplica sobre el plano.
 */
const BUTTON_WIDTH = 126;
const BUTTON_HEIGHT = 28;
const BUTTON_GAP = 6;

export interface FloorplanLayerTogglePanelOptions {
  readonly x: number;
  readonly y: number;
  readonly activeLayers: ReadonlySet<FloorplanLayerId>;
  readonly onToggle: (layer: FloorplanLayerId) => void;
}

export function renderFloorplanLayerTogglePanel(
  scene: SceneWithRexUI,
  options: FloorplanLayerTogglePanelOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  FLOORPLAN_LAYER_IDS.forEach((layerId, index) => {
    const x = options.x + index * (BUTTON_WIDTH + BUTTON_GAP);
    const button = createKenneyButton(scene, x, options.y, labelFor(layerId), {
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      fontSize: "10px",
      onClick: () => options.onToggle(layerId),
    });
    setButtonHighlighted(button, options.activeLayers.has(layerId));
    container.add(button);
  });
  return container;
}

function labelFor(layerId: FloorplanLayerId): string {
  return t(`ui.floorplan.layer.${layerId}`);
}
