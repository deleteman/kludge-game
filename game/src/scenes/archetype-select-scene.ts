import Phaser from "phaser";
import { SHIP_ARCHETYPES } from "engine";
import type { ShipArchetype } from "engine";
import { t } from "../i18n/i18n.js";
import { HEADER_COLOR } from "../render/palette.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton, setButtonHighlighted } from "../ui/widgets/kenney-button.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

const STARTING_Y = 260;
const BUTTON_HEIGHT = 60;
/** Selección de arquetipo de nave (Fase 9.5, punto 2) — una campaña usa UN arquetipo por partida (GDD, decisión FTL-style). */
export class ArchetypeSelectScene extends Phaser.Scene {
  private chosen: ShipArchetype = SHIP_ARCHETYPES[0];

  constructor() {
    super(SCENE_KEYS.archetypeSelect);
  }

  preload(): void {
    preloadUiAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.chosen = SHIP_ARCHETYPES[0];

    this.add
      .text(640, 90, t("ui.menu.archetype.header"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "28px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5);

    const buttons = new Map<ShipArchetype, ReturnType<typeof createKenneyButton>>();
    const refreshSelection = () => {
      for (const [archetype, button] of buttons) {
        setButtonHighlighted(button, archetype === this.chosen);
      }
    };

    const x = 650;
    let y = STARTING_Y;
    for (const archetype of SHIP_ARCHETYPES) {
      const button = createKenneyButton(self, x, y, t(`ship.${archetype}.name`), {
        width: 300,
        onClick: () => {
          this.chosen = archetype;
          refreshSelection();
        },
      });
      buttons.set(archetype, button);
      y += BUTTON_HEIGHT;
      //x += 220;
    }
    refreshSelection();

    createKenneyButton(self, 480, y + BUTTON_HEIGHT , t("ui.menu.archetype.back"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("title"),
    });
    createKenneyButton(self, 800, y + BUTTON_HEIGHT , t("ui.menu.archetype.confirm"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("crew-select"),
    });
  }

  /** El resto del flujo (crew-select) necesita saber qué arquetipo se eligió. */
  getChosenArchetype(): ShipArchetype {
    return this.chosen;
  }
}
