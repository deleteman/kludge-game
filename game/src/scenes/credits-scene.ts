import Phaser from "phaser";
import { t } from "../i18n/i18n.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyPanel } from "../ui/widgets/kenney-panel.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import { LABEL_COLOR } from "../render/palette.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.credits);
  }

  preload(): void {
    preloadUiAssets(this);
    preloadAudioAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6);
    createKenneyPanel(this, 640, 360, 420, 260, t("ui.menu.credits.header"));
    this.add
      .text(640, 340, t("ui.menu.credits.body"), { fontSize: "14px", color: LABEL_COLOR })
      .setOrigin(0.5);
    createKenneyButton(self, 640, 430, t("ui.menu.credits.back"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("title"),
    });
  }
}
