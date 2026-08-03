import Phaser from "phaser";
import { SHIP_ARCHETYPES } from "engine";
import type { ShipArchetype } from "engine";
import { t } from "../i18n/i18n.js";
import { HEADER_COLOR } from "../render/palette.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { preloadShipImages } from "../render/ship-image-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { renderShipArchetypeCard } from "../ui/widgets/ship-archetype-card.js";
import { popIn } from "../ui/ui-effects.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

const CARD_COLUMNS = 2;
const CARD_WIDTH = 560;
const CARD_HEIGHT = 230;
const CARD_GAP_X = 40;
const CARD_GAP_Y = 16;
const GRID_START_Y = 150;

/** Selección de arquetipo de nave (Fase 9.5, punto 2) — una campaña usa UN arquetipo por partida (GDD, decisión FTL-style). */
export class ArchetypeSelectScene extends Phaser.Scene {
  private chosen: ShipArchetype = SHIP_ARCHETYPES[0];

  constructor() {
    super(SCENE_KEYS.archetypeSelect);
  }

  preload(): void {
    preloadUiAssets(this);
    preloadAudioAssets(this);
    preloadShipImages(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.chosen = SHIP_ARCHETYPES[0];

    this.add
      .text(640, 60, t("ui.menu.archetype.header"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "28px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5);

    const gridWidth = CARD_COLUMNS * CARD_WIDTH + (CARD_COLUMNS - 1) * CARD_GAP_X;
    const gridStartX = 640 - gridWidth / 2;

    const cards = new Map<ShipArchetype, ReturnType<typeof renderShipArchetypeCard>>();
    const refreshSelection = () => {
      for (const [archetype, card] of cards) {
        card.setSelected(archetype === this.chosen);
      }
    };

    let lastRowBottom = GRID_START_Y;
    SHIP_ARCHETYPES.forEach((archetype, index) => {
      const col = index % CARD_COLUMNS;
      const row = Math.floor(index / CARD_COLUMNS);
      const cardX = gridStartX + col * (CARD_WIDTH + CARD_GAP_X);
      const cardY = GRID_START_Y + row * (CARD_HEIGHT + CARD_GAP_Y);
      lastRowBottom = Math.max(lastRowBottom, cardY + CARD_HEIGHT);
      const card = renderShipArchetypeCard(this, cardX, cardY, CARD_WIDTH, CARD_HEIGHT, archetype, false, () => {
        this.chosen = archetype;
        refreshSelection();
      });
      popIn(this, card.container, { duration: 160 + index * 30 });
      cards.set(archetype, card);
    });
    refreshSelection();

    const buttonY = lastRowBottom + 44;
    createKenneyButton(self, 480, buttonY, t("ui.menu.archetype.back"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("title"),
    });
    createKenneyButton(self, 800, buttonY, t("ui.menu.archetype.confirm"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("crew-select"),
    });
  }

  /** El resto del flujo (crew-select) necesita saber qué arquetipo se eligió. */
  getChosenArchetype(): ShipArchetype {
    return this.chosen;
  }
}
