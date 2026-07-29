import type Phaser from "phaser";
import type { ShipStatusIndicator, ShipStatusSnapshot } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR, healthFractionColor, sectionScarFlickerAlpha } from "../../render/palette.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";

const BAR_HEIGHT = 8;
const BAR_TRACK_COLOR = 0x1a2030;
const ROW_HEIGHT = 30;

export interface ShipStatusHudLabels {
  readonly atmosphere: string;
  readonly lifeSupport: string;
  readonly hullIntegrity: string;
  readonly energy: string;
  readonly substancesButton: (count: number) => string;
}

export interface ShipStatusHudCallbacks {
  readonly onOpenSubstances: () => void;
}

/**
 * HUD de estado permanente de la nave (Subfase 11g): reemplaza el panel de
 * acciones como elemento SIEMPRE visible en la columna lateral — 4 filas
 * (atmósfera/soporte vital/integridad de casco/energía), cada una con una
 * barra de color por fracción (`healthFractionColor`, extraída de
 * `crew-strip.ts` para no duplicar el corte de 3 niveles) más un botón para
 * abrir la lista de sustancias sintetizadas (antes embebida en el estado
 * `idle` del panel de acciones, Fase 11e — ver `mission-action-panel.ts`).
 * Parpadea en `critical` con el mismo patrón sinusoidal que la cicatriz de
 * sección sin energía (`sectionScarFlickerAlpha`), para paridad visual con
 * una alerta ya establecida (principio 6 de CLAUDE.md).
 */
export function renderShipStatusHud(
  scene: SceneWithRexUI,
  x: number,
  y: number,
  width: number,
  height: number,
  snapshot: ShipStatusSnapshot,
  substancesCount: number,
  labels: ShipStatusHudLabels,
  callbacks: ShipStatusHudCallbacks,
  elapsedSeconds: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  container.add(
    scene.add
      .rectangle(x - 10, y - 8, width + 20, height, 0x0a0a0f, 0.72)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x2a3040, 1),
  );

  const rows: ReadonlyArray<readonly [string, ShipStatusIndicator]> = [
    [labels.atmosphere, snapshot.atmosphere],
    [labels.lifeSupport, snapshot.lifeSupport],
    [labels.hullIntegrity, snapshot.hullIntegrity],
    [labels.energy, snapshot.energy],
  ];

  const barWidth = width - 20;
  let rowY = y;
  for (const [label, indicator] of rows) {
    container.add(
      scene.add.text(x, rowY, label, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: LABEL_COLOR,
      }),
    );
    const barY = rowY + 14;
    container.add(scene.add.rectangle(x, barY, barWidth, BAR_HEIGHT, BAR_TRACK_COLOR, 1).setOrigin(0, 0));
    const fillAlpha = indicator.level === "critical" ? sectionScarFlickerAlpha(elapsedSeconds) : 1;
    container.add(
      scene.add
        .rectangle(x, barY, barWidth * indicator.fraction, BAR_HEIGHT, healthFractionColor(indicator.fraction), fillAlpha)
        .setOrigin(0, 0),
    );
    rowY += ROW_HEIGHT;
  }

  const button = scene.add
    .text(x, rowY + 4, labels.substancesButton(substancesCount), {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "11px",
      color: substancesCount > 0 ? HEADER_COLOR : LABEL_COLOR,
    })
    .setInteractive({ cursor: substancesCount > 0 ? UI_POINTER_CURSOR_CSS : "default" })
    .on("pointerdown", () => {
      if (substancesCount > 0) callbacks.onOpenSubstances();
    });
  container.add(button);
  container.setDepth(RENDER_DEPTH.hudContent);

  return container;
}
