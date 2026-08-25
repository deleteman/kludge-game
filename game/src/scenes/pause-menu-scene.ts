import Phaser from "phaser";
import { t } from "../i18n/i18n.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyPanel } from "../ui/widgets/kenney-panel.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { captureLiveMissionSave } from "../meta/live-mission-save.js";
import { saveCampaignSave } from "../meta/save-adapter.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

/**
 * Menú de pausa in-game (Fase 9.5, punto 4) — overlay sobre la misión
 * congelada (`scene.launch`+`pause`, ver `scene-flow-manager.ts`).
 * DISTINTO de la futura pausa táctica del core loop (GDD sección 4, motor,
 * Fase 10): esto es meta-juego (salir/opciones/guardar), no el modo
 * planificación/ejecución de `CoreLoopModeMachine`.
 */
export class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.pauseMenu);
  }

  preload(): void {
    preloadUiAssets(this);
    preloadAudioAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;

    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.5);
    createKenneyPanel(this, 640, 360, 420, 320, t("ui.menu.pause.header"));

    createKenneyButton(self, 640, 260, t("ui.menu.pause.resume"), {
      width: 320,
      onClick: () => metaGameStateMachine.transition("in-mission"),
    });
    createKenneyButton(self, 640, 316, t("ui.menu.pause.options"), {
      width: 320,
      onClick: () => metaGameStateMachine.transition("options"),
    });
    createKenneyButton(self, 640, 372, t("ui.menu.pause.save-and-quit"), {
      width: 320,
      onClick: () => {
        // Ronda 1 de playtest de 13f (bug PREEXISTENTE): esto guardaba
        // `campaignSession.touch()`, que solo reescribe `updatedAt`. El estado
        // vivo de la misión —atmósfera, desgaste, `condition`, stock, química,
        // HP y la cicatriz de casco— solo se volcaba al resolver una crisis, así
        // que salir a mitad de misión tiraba TODO el progreso en silencio.
        const state = captureLiveMissionSave(campaignSession.touch());
        campaignSession.load(state);
        void saveCampaignSave(state).then(() => metaGameStateMachine.transition("title"));
      },
    });
    createKenneyButton(self, 640, 428, t("ui.menu.pause.exit-no-save"), {
      width: 320,
      onClick: () => metaGameStateMachine.transition("title"),
    });
  }
}
