import Phaser from "phaser";
import { CANONICAL_SHIP_FLOORPLANS, CONDUIT_KINDS, SHIP_ARCHETYPES } from "engine";
import type { ShipArchetype } from "engine";

import { t } from "../i18n/i18n.js";
import { renderFloorplan } from "../render/floorplan-renderer.js";
import {
  ANCHOR_COLOR,
  CONDUIT_COLORS,
  HEADER_COLOR,
  SEALED_VALVE_COLOR,
} from "../render/palette.js";

/**
 * Visor estático de los 4 planos canónicos (Fase 5). Única interacción:
 * teclas 1-4 para cambiar de nave — el plano en sí no es interactivo todavía
 * (la colocación/conexión de componentes llega con el core loop y la mesa de
 * creación, Fases 6-7). Sin `preload`: no existe ningún asset, todo es
 * placeholder generado por código.
 */
const MAP_OFFSET_Y = 16;

export class FloorplanScene extends Phaser.Scene {
  private shipContainer?: Phaser.GameObjects.Container;
  private headerText?: Phaser.GameObjects.Text;

  constructor() {
    super("floorplan");
  }

  create(): void {
    this.headerText = this.add
      .text(8, 2, "", { fontFamily: "monospace", fontSize: "12px", color: HEADER_COLOR })
      .setDepth(1);
    this.buildLegend();

    const keyByIndex = ["ONE", "TWO", "THREE", "FOUR"] as const;
    SHIP_ARCHETYPES.forEach((archetype, index) => {
      this.input.keyboard?.on(`keydown-${keyByIndex[index]}`, () => this.showShip(archetype));
    });

    this.showShip(SHIP_ARCHETYPES[0]);
  }

  private showShip(archetype: ShipArchetype): void {
    const ship = CANONICAL_SHIP_FLOORPLANS[archetype];
    this.shipContainer?.destroy(true);
    this.shipContainer = renderFloorplan(this, ship);
    this.shipContainer.setY(MAP_OFFSET_Y);
    this.headerText?.setText(`${t(ship.nameKey)}  —  ${t("ui.floorplan.ship-selector")}`);
  }

  /** Leyenda de marcadores (esquina superior derecha, zona libre de secciones). */
  private buildLegend(): void {
    const graphics = this.add.graphics().setDepth(1);
    let x = 640;
    const y = 9;
    const label = (text: string) =>
      this.add
        .text(x + 10, y, text, { fontFamily: "monospace", fontSize: "10px", color: HEADER_COLOR })
        .setOrigin(0, 0.5)
        .setDepth(1);

    for (const kind of CONDUIT_KINDS) {
      graphics.fillStyle(CONDUIT_COLORS[kind], 1);
      graphics.fillCircle(x, y, 4);
      x += 14 + label(t(`ui.floorplan.legend.${kind}`)).width + 10;
    }

    graphics.lineStyle(2, SEALED_VALVE_COLOR, 1);
    graphics.strokeCircle(x, y, 5);
    graphics.lineBetween(x - 3, y - 3, x + 3, y + 3);
    graphics.lineBetween(x - 3, y + 3, x + 3, y - 3);
    x += 14 + label(t("ui.floorplan.legend.sellado")).width + 10;

    graphics.lineStyle(1, ANCHOR_COLOR, 1);
    graphics.strokeRect(x - 4, y - 4, 8, 8);
    label(t("ui.floorplan.legend.anclaje"));
  }
}
