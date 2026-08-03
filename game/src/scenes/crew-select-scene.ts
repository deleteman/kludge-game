import Phaser from "phaser";
import { CREW_CAPACITY_BY_ARCHETYPE, selectActiveCrew } from "engine";
import type { CrewActor, CrewActorId } from "engine";
import { t } from "../i18n/i18n.js";
import { HEADER_COLOR, LABEL_COLOR } from "../render/palette.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { preloadCrewPortraits } from "../render/crew-portrait-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { renderCrewSelectCard } from "../ui/widgets/crew-select-card.js";
import { popIn } from "../ui/ui-effects.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { buildPlaceholderRoster } from "../meta/placeholder-roster.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { ArchetypeSelectScene } from "./archetype-select-scene.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

const CARD_COLUMNS = 2;
const CARD_WIDTH = 560;
const CARD_HEIGHT = 148;
const CARD_GAP_X = 40;
const CARD_GAP_Y = 16;
const GRID_START_Y = 150;

/**
 * Selección pre-misión de tripulación (GDD 6.2, Fase 9.5 punto 3) — primera
 * UI real sobre `selectActiveCrew`/`CREW_CAPACITY_BY_ARCHETYPE` (Fase 9), que
 * eran solo datos hasta ahora. La validación de capacidad la hace el motor,
 * no se reimplementa el conteo acá.
 */
export class CrewSelectScene extends Phaser.Scene {
  private chosenIds: CrewActorId[] = [];
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.crewSelect);
  }

  preload(): void {
    preloadUiAssets(this);
    preloadAudioAssets(this);
    preloadCrewPortraits(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.chosenIds = [];

    const archetypeScene = this.scene.get(SCENE_KEYS.archetypeSelect) as ArchetypeSelectScene;
    const archetype = archetypeScene.getChosenArchetype();
    const capacity = CREW_CAPACITY_BY_ARCHETYPE[archetype];
    const roster = buildPlaceholderRoster();

    this.add
      .text(640, 60, t("ui.menu.crew.header"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "26px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(640, 100, "", {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "14px",
        color: LABEL_COLOR,
      })
      .setOrigin(0.5);

    const gridWidth = CARD_COLUMNS * CARD_WIDTH + (CARD_COLUMNS - 1) * CARD_GAP_X;
    const gridStartX = 640 - gridWidth / 2;

    const cards = new Map<CrewActorId, ReturnType<typeof renderCrewSelectCard>>();
    const refresh = () => {
      this.statusText?.setText(`${this.chosenIds.length} / ${capacity}`);
      for (const [id, card] of cards) {
        card.setSelected(this.chosenIds.includes(id));
      }
    };

    roster.available.forEach((actor, index) => {
      const col = index % CARD_COLUMNS;
      const row = Math.floor(index / CARD_COLUMNS);
      const cardX = gridStartX + col * (CARD_WIDTH + CARD_GAP_X);
      const cardY = GRID_START_Y + row * (CARD_HEIGHT + CARD_GAP_Y);
      const card = renderCrewSelectCard(this, cardX, cardY, CARD_WIDTH, CARD_HEIGHT, actor, index, false, () => {
        const idx = this.chosenIds.indexOf(actor.id);
        if (idx >= 0) {
          this.chosenIds.splice(idx, 1);
        } else if (this.chosenIds.length < capacity) {
          this.chosenIds.push(actor.id);
        }
        refresh();
      });
      popIn(this, card.container, { duration: 160 + index * 30 });
      cards.set(actor.id, card);
    });
    refresh();

    createKenneyButton(self, 480, 660, t("ui.menu.crew.back"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("archetype-select"),
    });
    createKenneyButton(self, 800, 660, t("ui.menu.crew.confirm"), {
      width: 200,
      onClick: () => {
        // Valida existencia/capacidad reutilizando el motor — no se reimplementa el conteo.
        try {
          selectActiveCrew(roster, archetype, this.chosenIds);
        } catch (error) {
          console.warn(error);
          return;
        }
        campaignSession.startNew({
          id: `campaign-${Date.now()}`,
          name: `Campaña ${archetype}`,
          archetype,
          roster,
          chosenCrewIds: this.chosenIds as ReadonlyArray<CrewActor["id"]>,
        });
        metaGameStateMachine.transition("in-mission");
      },
    });
  }
}
