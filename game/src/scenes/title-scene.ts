import Phaser from "phaser";
import { t } from "../i18n/i18n.js";
import { preloadUiAssets, UI_TEXTURE_KEYS } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { popIn } from "../ui/ui-effects.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { listCampaignSaves, loadCampaignSave } from "../meta/save-adapter.js";
import { campaignSession } from "../meta/campaign-session.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";
import { PARTICLE_TEXTURE_URLS, SPARK_TEXTURES } from "../particles/particle-texture-registry.js";
import { spawnBurst, spreadRange, textureScale } from "../particles/particle-utils.js";

/** Pantalla de título (Fase 9.5, punto 1): Nueva Partida / Continuar / Modo Creativo / Opciones / Créditos / Salir. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.title);
  }

  preload(): void {
    preloadUiAssets(this);
    preloadAudioAssets(this);
    for (const [key, url] of Object.entries(PARTICLE_TEXTURE_URLS)) {
      this.load.image(key, url);
    }
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.cameras.main.fadeIn(220, 0, 0, 0);

    /** Entrada escalonada de los botones del menú (12g, fine-tunning: título sin animación de entrada). */
    let staggerIndex = 0;
    const animateButtonIn = (button: ReturnType<typeof createKenneyButton>): void => {
      button.alpha = 0;
      const delay = staggerIndex * 60;
      staggerIndex += 1;
      this.time.delayedCall(delay, () => popIn(this, button, { duration: 180 }));
    };

    const background = this.add
      .image(640, 360, UI_TEXTURE_KEYS.menuBackground)
      .setDisplaySize(1280, 720)
      .setDepth(-1);
    background.postFX.addBlur(0, 2, 2, 1, 0xffffff, 2);

    const menuX = 220;

    const logoWidth = 450;
    const logoHeight = logoWidth * (768 / 1408);
    const logo = this.add
      .image(menuX, 150, UI_TEXTURE_KEYS.titleLogo)
      .setDisplaySize(logoWidth, logoHeight);
    logo.postFX.addShadow(4, 6, 0.1, 1, 0x000000, 6, 0.8);

    this.tweens.add({
      targets: logo,
      y: logo.y - 8,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const emitLogoSpark = (): void => {
      spawnBurst(
        this,
        logo.x + Phaser.Math.Between(-logoWidth / 2, logoWidth / 2),
        logo.y + Phaser.Math.Between(-logoHeight / 2, logoHeight / 2),
        {
          lifespan: 350,
          speed: { min: 40, max: 120 },
          scale: { start: textureScale(16), end: 0 },
          quantity: 6,
          frequency: 15,
          tint: 0xf2d24b,
          x: spreadRange(4),
          y: spreadRange(4),
        },
        350,
        SPARK_TEXTURES,
      );
      this.time.delayedCall(Phaser.Math.Between(2500, 5000), emitLogoSpark);
    };
    this.time.delayedCall(Phaser.Math.Between(1000, 2500), emitLogoSpark);

    let y = 290;
    const step = 56;

    animateButtonIn(
      createKenneyButton(self, menuX, y, t("ui.menu.title.new-game"), {
        onClick: () => metaGameStateMachine.transition("archetype-select"),
      }),
    );
    y += step;

    // Captura la Y de este botón AHORA: el callback corre en un microtask que
    // dispara después de que el resto de los botones sync ya avanzó `y` (bug
    // de playtest 12g: sin esto "Continuar" terminaba dibujado encima de "Salir").
    const continueY = y;
    void listCampaignSaves().then((saves) => {
      // Simplificación: "Continuar" carga la primera partida listada, sin
      // selector por fecha (`list()` no trae metadata, solo ids). Suficiente
      // para el smoke test de guardar→cerrar→continuar del plan de Fase 9.5.
      const hasSaves = saves.length > 0;
      animateButtonIn(
        createKenneyButton(self, menuX, continueY, t("ui.menu.title.continue"), {
          enabled: hasSaves,
          onClick: () => {
            if (!hasSaves) return;
            void loadCampaignSave(saves[0]!).then((state) => {
              campaignSession.load(state);
              metaGameStateMachine.transition("in-mission");
            });
          },
        }),
      );
    });
    y += step;

    animateButtonIn(
      createKenneyButton(self, menuX, y, t("ui.menu.title.creative-mode"), {
        onClick: () => metaGameStateMachine.transition("creative-hub"),
      }),
    );
    y += step;

    animateButtonIn(
      createKenneyButton(self, menuX, y, t("ui.menu.title.options"), {
        onClick: () => metaGameStateMachine.transition("options"),
      }),
    );
    y += step;

    animateButtonIn(
      createKenneyButton(self, menuX, y, t("ui.menu.title.credits"), {
        onClick: () => metaGameStateMachine.transition("credits"),
      }),
    );
    y += step;

    animateButtonIn(
      createKenneyButton(self, menuX, y, t("ui.menu.title.quit"), {
        onClick: () => window.close(),
      }),
    );
  }
}
