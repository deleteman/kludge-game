import Phaser from "phaser";
import { t } from "../i18n/i18n.js";
import { HEADER_COLOR } from "../render/palette.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { listCampaignSaves, loadCampaignSave } from "../meta/save-adapter.js";
import { campaignSession } from "../meta/campaign-session.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

/** Pantalla de título (Fase 9.5, punto 1): Nueva Partida / Continuar / Modo Creativo / Opciones / Créditos / Salir. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.title);
  }

  preload(): void {
    preloadUiAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;

    this.add
      .text(640, 140, t("ui.menu.title.header"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "48px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5);

    let y = 260;
    const step = 56;

    createKenneyButton(self, 640, y, t("ui.menu.title.new-game"), {
      onClick: () => metaGameStateMachine.transition("archetype-select"),
    });
    y += step;

    void listCampaignSaves().then((saves) => {
      // Simplificación: "Continuar" carga la primera partida listada, sin
      // selector por fecha (`list()` no trae metadata, solo ids). Suficiente
      // para el smoke test de guardar→cerrar→continuar del plan de Fase 9.5.
      const hasSaves = saves.length > 0;
      createKenneyButton(self, 640, y, t("ui.menu.title.continue"), {
        enabled: hasSaves,
        onClick: () => {
          if (!hasSaves) return;
          void loadCampaignSave(saves[0]!).then((state) => {
            campaignSession.load(state);
            metaGameStateMachine.transition("in-mission");
          });
        },
      });
    });
    y += step;

    createKenneyButton(self, 640, y, t("ui.menu.title.creative-mode"), {
      onClick: () => metaGameStateMachine.transition("creative-hub"),
    });
    y += step;

    createKenneyButton(self, 640, y, t("ui.menu.title.options"), {
      onClick: () => metaGameStateMachine.transition("options"),
    });
    y += step;

    createKenneyButton(self, 640, y, t("ui.menu.title.credits"), {
      onClick: () => metaGameStateMachine.transition("credits"),
    });
    y += step;

    createKenneyButton(self, 640, y, t("ui.menu.title.quit"), {
      onClick: () => window.close(),
    });
  }
}
