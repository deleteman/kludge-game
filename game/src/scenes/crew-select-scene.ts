import Phaser from "phaser";
import { CREW_CAPACITY_BY_ARCHETYPE, selectActiveCrew } from "engine";
import type { CrewActor, CrewActorId } from "engine";
import { t } from "../i18n/i18n.js";
import { HEADER_COLOR, LABEL_COLOR } from "../render/palette.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { createKenneyButton, setButtonHighlighted } from "../ui/widgets/kenney-button.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { buildPlaceholderRoster } from "../meta/placeholder-roster.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { ArchetypeSelectScene } from "./archetype-select-scene.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

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

    const buttons = new Map<CrewActorId, ReturnType<typeof createKenneyButton>>();
    const refresh = () => {
      this.statusText?.setText(`${this.chosenIds.length} / ${capacity}`);
      for (const [id, button] of buttons) {
        setButtonHighlighted(button, this.chosenIds.includes(id));
      }
    };

    let y = 150;
    for (const actor of roster.available) {
      const label = `${actor.name} — ${actor.specialty} (${actor.tier})`;
      const button = createKenneyButton(self, 640, y, label, {
        width: 420,
        height: 36,
        fontSize: "14px",
        onClick: () => {
          const idx = this.chosenIds.indexOf(actor.id);
          if (idx >= 0) {
            this.chosenIds.splice(idx, 1);
          } else if (this.chosenIds.length < capacity) {
            this.chosenIds.push(actor.id);
          }
          refresh();
        },
      });
      buttons.set(actor.id, button);
      y += 44;
    }
    refresh();

    createKenneyButton(self, 480, 630, t("ui.menu.crew.back"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("archetype-select"),
    });
    createKenneyButton(self, 800, 630, t("ui.menu.crew.confirm"), {
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
